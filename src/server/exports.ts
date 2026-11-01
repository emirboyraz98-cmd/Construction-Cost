import "server-only";
import Decimal from "decimal.js";
import ExcelJS from "exceljs";
import { zipSync, type Zippable } from "fflate";
import { projectIdsWithCapability } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import {
  CURRENCY_LABELS,
  DOCUMENT_TYPE_LABELS,
  EXPENSE_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  APPROVAL_STATUS_LABELS,
} from "@/lib/expenses/labels";
import { ALLOWED_UPLOADS, type AllowedMime } from "@/lib/files";
import { ActionError, getAccess } from "./access";
import { writeAudit } from "./audit";
import { db } from "./db";
import { readStoredFile } from "./storage";

const MONEY = '#,##0.00;[Red]-#,##0.00';
const RATE = "#,##0.0000";
const num = (value: { toString(): string } | null | undefined) => (value == null ? null : Number(value.toString()));

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF7" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

type ExportExpense = Awaited<ReturnType<typeof import("./expenses").listExpensesForExport>>[number];

/** Harcama listesini (filtrelenmiş) Excel'e çevirir. */
export async function expensesWorkbook(projectName: string, rows: ExportExpense[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "İnşaat Maliyet";
  const sheet = workbook.addWorksheet("Harcamalar");
  sheet.columns = [
    { header: "Tarih", key: "date", width: 12, style: { numFmt: "dd.mm.yyyy" } },
    { header: "Tür", key: "kind", width: 12 },
    { header: "Maliyet kalemi", key: "costItem", width: 36 },
    { header: "Blok", key: "block", width: 10 },
    { header: "Tedarikçi", key: "supplier", width: 28 },
    { header: "Vergi / TC no", key: "taxNumber", width: 14 },
    { header: "Belge türü", key: "documentType", width: 11 },
    { header: "Belge no", key: "documentNo", width: 18 },
    { header: "Açıklama", key: "description", width: 30 },
    { header: "Miktar", key: "quantity", width: 10 },
    { header: "Birim", key: "unit", width: 8 },
    { header: "Para birimi", key: "currency", width: 8 },
    { header: "Kur", key: "rate", width: 10, style: { numFmt: RATE } },
    { header: "KDV %", key: "vatRate", width: 7 },
    { header: "Matrah (TL)", key: "net", width: 15, style: { numFmt: MONEY } },
    { header: "KDV (TL)", key: "vat", width: 13, style: { numFmt: MONEY } },
    { header: "Toplam (TL)", key: "total", width: 15, style: { numFmt: MONEY } },
    { header: "Onay", key: "approval", width: 13 },
    { header: "Ödeme", key: "payment", width: 10 },
    { header: "Vade", key: "due", width: 12, style: { numFmt: "dd.mm.yyyy" } },
    { header: "Belge sayısı", key: "docs", width: 8 },
    { header: "Giren", key: "createdBy", width: 16 },
  ];
  for (const row of rows) {
    sheet.addRow({
      date: row.date,
      kind: EXPENSE_KIND_LABELS[row.kind],
      costItem: row.costItem ? `${row.costItem.code} ${row.costItem.name}` : "",
      block: row.block?.name ?? "",
      supplier: row.supplier?.name ?? "",
      taxNumber: row.supplier?.taxNumber ?? "",
      documentType: DOCUMENT_TYPE_LABELS[row.documentType],
      documentNo: row.documentNo ?? "",
      description: row.description ?? "",
      quantity: num(row.quantity),
      unit: row.unit ?? "",
      currency: CURRENCY_LABELS[row.currency],
      rate: num(row.exchangeRate),
      vatRate: num(row.vatRate),
      net: num(row.netAmountTry),
      vat: num(row.vatAmountTry),
      total: num(row.totalAmountTry),
      approval: APPROVAL_STATUS_LABELS[row.approvalStatus],
      payment: PAYMENT_STATUS_LABELS[row.paymentStatus],
      due: row.dueDate,
      docs: row._count.documents,
      createdBy: row.createdBy.name,
    });
  }
  const totals = sheet.addRow({ description: `${projectName} — toplam (${rows.length} kayıt)` });
  for (const key of ["net", "vat", "total"]) {
    const column = sheet.getColumn(key);
    totals.getCell(key).value = { formula: `SUM(${column.letter}2:${column.letter}${rows.length + 1})` };
  }
  totals.font = { bold: true };
  styleHeader(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** ZIP içindeki dosya adı: Türkçe karakterler sadeleştirilir, güvensiz karakterler atılır. */
function safeName(text: string): string {
  return text
    .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Muhasebeci paketi (PLAN.md 8.4): dönemdeki onaylı harcamaların fatura listesi, tedarikçi
 * özetleri ve belge görselleri tek ZIP dosyasında. Projelere bölünmüş fatura tek satırdır.
 */
export async function accountantPackage(options: { from: Date; to: Date; projectIds: string[] | null }) {
  const { user, scope } = await getAccess();
  const allowed = projectIdsWithCapability(scope, "accountant.export");
  const projectFilter = { ...allowed, ...(options.projectIds ? { AND: [{ projectId: { in: options.projectIds } }] } : {}) };
  // Bağlantı faturaları ve ödemeleri şirket geneli: yalnızca tüm projeler seçiliyken pakete girer.
  const includeCompany = !options.projectIds && hasCapability(user.role, "connection.view");
  const period = { gte: options.from, lte: options.to };
  const [connectionInvoices, connectionPayments, billings] = await Promise.all([
    includeCompany
      ? db.connectionInvoice.findMany({
          where: { date: period },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          include: {
            connection: { select: { no: true, currency: true, supplier: { select: { name: true, taxNumber: true, taxOffice: true } } } },
            documents: { orderBy: { createdAt: "asc" } },
          },
        })
      : [],
    includeCompany
      ? db.connectionPayment.findMany({
          where: { paymentStatus: "PAID", paidAt: period },
          orderBy: { paidAt: "asc" },
          include: { connection: { select: { no: true, currency: true, supplier: { select: { name: true, taxNumber: true } } } } },
        })
      : [],
    db.progressBilling.findMany({
      where: { ...projectFilter, status: "APPROVED", date: period },
      orderBy: [{ date: "asc" }, { seq: "asc" }],
      include: {
        project: { select: { name: true } },
        contract: { select: { no: true, title: true, supplier: { select: { name: true, taxNumber: true, taxOffice: true } } } },
        documents: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  const expenses = await db.expense.findMany({
    where: {
      ...projectFilter,
      deletedAt: null,
      // Çekiş, hakediş ve transfer satırları fatura değildir; hakedişler ayrı sayfada.
      kind: { in: ["EXPENSE", "ADVANCE"] },
      approvalStatus: "APPROVED",
      date: period,
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      project: { select: { name: true } },
      supplier: { select: { name: true, taxNumber: true, taxOffice: true } },
      costItem: { select: { code: true, name: true } },
      documents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (expenses.length + connectionInvoices.length + connectionPayments.length + billings.length === 0) {
    throw new ActionError("Seçilen dönemde onaylı harcama, bağlantı faturası veya hakediş yok.");
  }

  // Bölünmüş faturaları birleştir: tutarlar toplanır, projeler yan yana yazılır.
  type Invoice = (typeof expenses)[number] & { projects: string[]; sums: Record<"net" | "vat" | "total" | "netTry" | "vatTry" | "totalTry", Decimal> };
  const invoices: Invoice[] = [];
  const byGroup = new Map<string, Invoice>();
  for (const expense of expenses) {
    const sums = {
      net: new Decimal(expense.netAmount.toString()),
      vat: new Decimal(expense.vatAmount.toString()),
      total: new Decimal(expense.totalAmount.toString()),
      netTry: new Decimal(expense.netAmountTry.toString()),
      vatTry: new Decimal(expense.vatAmountTry.toString()),
      totalTry: new Decimal(expense.totalAmountTry.toString()),
    };
    const existing = expense.splitGroupId ? byGroup.get(expense.splitGroupId) : undefined;
    if (existing) {
      existing.projects.push(expense.project.name);
      for (const key of Object.keys(sums) as (keyof typeof sums)[]) existing.sums[key] = existing.sums[key].plus(sums[key]);
      continue;
    }
    const invoice = { ...expense, projects: [expense.project.name], sums };
    invoices.push(invoice);
    if (expense.splitGroupId) byGroup.set(expense.splitGroupId, invoice);
  }

  const files: Zippable = {};
  const usedNames = new Set<string>();
  const documentNames = new Map<string, string[]>();
  async function addDocuments(id: string, baseText: string, documents: { mimeType: string; storageKey: string; fileName: string }[]) {
    const names: string[] = [];
    for (const [index, doc] of documents.entries()) {
      const base = safeName(baseText);
      let name = `belgeler/${base}${documents.length > 1 ? `_${index + 1}` : ""}${ALLOWED_UPLOADS[doc.mimeType as AllowedMime] ?? ""}`;
      for (let n = 2; usedNames.has(name); n++) name = name.replace(/(\.[a-z]+)?$/, `_${n}$1`);
      usedNames.add(name);
      try {
        files[name] = [new Uint8Array(await readStoredFile(doc.storageKey)), { level: 0 }];
        names.push(name.replace("belgeler/", ""));
      } catch {
        names.push(`(dosya bulunamadı: ${doc.fileName})`);
      }
    }
    documentNames.set(id, names);
  }
  for (const invoice of invoices) {
    await addDocuments(invoice.id, `${iso(invoice.date)}_${invoice.supplier?.name ?? "tedarikcisiz"}_${invoice.documentNo ?? invoice.id.slice(-6)}`, invoice.documents);
  }
  for (const invoice of connectionInvoices) {
    await addDocuments(invoice.id, `${iso(invoice.date)}_${invoice.connection.supplier.name}_${invoice.documentNo}`, invoice.documents);
  }
  for (const billing of billings) {
    await addDocuments(billing.id, `${iso(billing.date)}_${billing.contract.supplier.name}_hakedis_${billing.contract.no}_${billing.seq}`, billing.documents);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "İnşaat Maliyet";
  const list = workbook.addWorksheet("Faturalar");
  list.columns = [
    { header: "Tarih", key: "date", width: 12, style: { numFmt: "dd.mm.yyyy" } },
    { header: "Tedarikçi", key: "supplier", width: 30 },
    { header: "Vergi / TC no", key: "taxNumber", width: 14 },
    { header: "Vergi dairesi", key: "taxOffice", width: 16 },
    { header: "Belge türü", key: "documentType", width: 11 },
    { header: "Belge no", key: "documentNo", width: 18 },
    { header: "Proje", key: "project", width: 26 },
    { header: "Maliyet kalemi", key: "costItem", width: 32 },
    { header: "Açıklama", key: "description", width: 30 },
    { header: "Para birimi", key: "currency", width: 8 },
    { header: "Kur", key: "rate", width: 10, style: { numFmt: RATE } },
    { header: "Matrah", key: "net", width: 14, style: { numFmt: MONEY } },
    { header: "KDV %", key: "vatRate", width: 7 },
    { header: "KDV", key: "vat", width: 12, style: { numFmt: MONEY } },
    { header: "Toplam", key: "total", width: 14, style: { numFmt: MONEY } },
    { header: "Matrah (TL)", key: "netTry", width: 14, style: { numFmt: MONEY } },
    { header: "KDV (TL)", key: "vatTry", width: 12, style: { numFmt: MONEY } },
    { header: "Toplam (TL)", key: "totalTry", width: 14, style: { numFmt: MONEY } },
    { header: "Ödeme durumu", key: "payment", width: 11 },
    { header: "Ödeme tarihi", key: "paidAt", width: 12, style: { numFmt: "dd.mm.yyyy" } },
    { header: "Ödeme şekli", key: "method", width: 12 },
    { header: "Belge dosyası", key: "files", width: 40 },
  ];
  const advances = workbook.addWorksheet("Avanslar");
  advances.columns = list.columns.map((c) => ({ header: c.header as string, key: c.key as string, width: c.width, style: c.style }));
  for (const invoice of invoices) {
    const target = invoice.kind === "ADVANCE" ? advances : list;
    target.addRow({
      date: invoice.date,
      supplier: invoice.supplier?.name ?? "",
      taxNumber: invoice.supplier?.taxNumber ?? "",
      taxOffice: invoice.supplier?.taxOffice ?? "",
      documentType: DOCUMENT_TYPE_LABELS[invoice.documentType],
      documentNo: invoice.documentNo ?? "",
      project: invoice.projects.length > 1 ? `Ortak: ${invoice.projects.join(", ")}` : invoice.projects[0],
      costItem: invoice.costItem ? `${invoice.costItem.code} ${invoice.costItem.name}` : "",
      description: invoice.description ?? "",
      currency: CURRENCY_LABELS[invoice.currency],
      rate: num(invoice.exchangeRate),
      net: num(invoice.sums.net),
      vatRate: num(invoice.vatRate),
      vat: num(invoice.sums.vat),
      total: num(invoice.sums.total),
      netTry: num(invoice.sums.netTry),
      vatTry: num(invoice.sums.vatTry),
      totalTry: num(invoice.sums.totalTry),
      payment: PAYMENT_STATUS_LABELS[invoice.paymentStatus],
      paidAt: invoice.paidAt,
      method: invoice.paymentMethod ? PAYMENT_METHOD_LABELS[invoice.paymentMethod] : "",
      files: (documentNames.get(invoice.id) ?? []).join(", ") || "—",
    });
  }

  const summary = workbook.addWorksheet("Tedarikçi özeti");
  summary.columns = [
    { header: "Tedarikçi", key: "supplier", width: 32 },
    { header: "Vergi / TC no", key: "taxNumber", width: 14 },
    { header: "Belge sayısı", key: "count", width: 10 },
    { header: "Matrah (TL)", key: "net", width: 15, style: { numFmt: MONEY } },
    { header: "KDV (TL)", key: "vat", width: 13, style: { numFmt: MONEY } },
    { header: "Toplam (TL)", key: "total", width: 15, style: { numFmt: MONEY } },
    { header: "Ödenen (TL)", key: "paid", width: 15, style: { numFmt: MONEY } },
    { header: "Ödenmemiş (TL)", key: "unpaid", width: 15, style: { numFmt: MONEY } },
    { header: "Avans (TL)", key: "advance", width: 14, style: { numFmt: MONEY } },
  ];
  const bySupplier = new Map<string, { name: string; taxNumber: string; count: number; net: Decimal; vat: Decimal; total: Decimal; paid: Decimal; unpaid: Decimal; advance: Decimal }>();
  for (const invoice of invoices) {
    const key = invoice.supplierId ?? "-";
    const entry =
      bySupplier.get(key) ??
      bySupplier
        .set(key, {
          name: invoice.supplier?.name ?? "Tedarikçi belirtilmemiş",
          taxNumber: invoice.supplier?.taxNumber ?? "",
          count: 0,
          net: new Decimal(0),
          vat: new Decimal(0),
          total: new Decimal(0),
          paid: new Decimal(0),
          unpaid: new Decimal(0),
          advance: new Decimal(0),
        })
        .get(key)!;
    entry.count += 1;
    if (invoice.kind === "ADVANCE") {
      entry.advance = entry.advance.plus(invoice.sums.totalTry);
      continue;
    }
    entry.net = entry.net.plus(invoice.sums.netTry);
    entry.vat = entry.vat.plus(invoice.sums.vatTry);
    entry.total = entry.total.plus(invoice.sums.totalTry);
    if (invoice.paymentStatus === "PAID") entry.paid = entry.paid.plus(invoice.sums.totalTry);
    else entry.unpaid = entry.unpaid.plus(invoice.sums.totalTry);
  }
  for (const entry of [...bySupplier.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"))) {
    summary.addRow({
      supplier: entry.name,
      taxNumber: entry.taxNumber,
      count: entry.count,
      net: num(entry.net),
      vat: num(entry.vat),
      total: num(entry.total),
      paid: num(entry.paid),
      unpaid: num(entry.unpaid),
      advance: num(entry.advance),
    });
  }
  const sheets = [list, advances, summary];

  if (includeCompany) {
    const sheet = workbook.addWorksheet("Bağlantı faturaları");
    sheet.columns = [
      { header: "Tarih", key: "date", width: 12, style: { numFmt: "dd.mm.yyyy" } },
      { header: "Tedarikçi", key: "supplier", width: 30 },
      { header: "Vergi / TC no", key: "taxNumber", width: 14 },
      { header: "Vergi dairesi", key: "taxOffice", width: 16 },
      { header: "Fatura no", key: "documentNo", width: 18 },
      { header: "Bağlantı no", key: "connection", width: 14 },
      { header: "Para birimi", key: "currency", width: 8 },
      { header: "Kur", key: "rate", width: 10, style: { numFmt: RATE } },
      { header: "Matrah", key: "net", width: 14, style: { numFmt: MONEY } },
      { header: "KDV", key: "vat", width: 12, style: { numFmt: MONEY } },
      { header: "Toplam", key: "total", width: 14, style: { numFmt: MONEY } },
      { header: "Toplam (TL)", key: "totalTry", width: 14, style: { numFmt: MONEY } },
      { header: "Belge dosyası", key: "files", width: 40 },
    ];
    for (const invoice of connectionInvoices) {
      sheet.addRow({
        date: invoice.date,
        supplier: invoice.connection.supplier.name,
        taxNumber: invoice.connection.supplier.taxNumber ?? "",
        taxOffice: invoice.connection.supplier.taxOffice ?? "",
        documentNo: invoice.documentNo,
        connection: invoice.connection.no,
        currency: CURRENCY_LABELS[invoice.connection.currency],
        rate: num(invoice.exchangeRate),
        net: num(invoice.netAmount),
        vat: num(invoice.vatAmount),
        total: num(invoice.totalAmount),
        totalTry: num(invoice.totalAmountTry),
        files: (documentNames.get(invoice.id) ?? []).join(", ") || "—",
      });
    }
    const payments = workbook.addWorksheet("Bağlantı ödemeleri");
    payments.columns = [
      { header: "Ödeme tarihi", key: "paidAt", width: 12, style: { numFmt: "dd.mm.yyyy" } },
      { header: "Vade", key: "dueDate", width: 12, style: { numFmt: "dd.mm.yyyy" } },
      { header: "Tedarikçi", key: "supplier", width: 30 },
      { header: "Vergi / TC no", key: "taxNumber", width: 14 },
      { header: "Bağlantı no", key: "connection", width: 14 },
      { header: "Açıklama", key: "description", width: 24 },
      { header: "Ödeme şekli", key: "method", width: 12 },
      { header: "Çek / senet no", key: "instrument", width: 14 },
      { header: "Para birimi", key: "currency", width: 8 },
      { header: "Tutar", key: "amount", width: 14, style: { numFmt: MONEY } },
      { header: "Kur", key: "rate", width: 10, style: { numFmt: RATE } },
      { header: "Tutar (TL)", key: "amountTry", width: 14, style: { numFmt: MONEY } },
    ];
    for (const p of connectionPayments) {
      payments.addRow({
        paidAt: p.paidAt,
        dueDate: p.dueDate,
        supplier: p.connection.supplier.name,
        taxNumber: p.connection.supplier.taxNumber ?? "",
        connection: p.connection.no,
        description: p.description ?? "",
        method: p.paymentMethod ? PAYMENT_METHOD_LABELS[p.paymentMethod] : "",
        instrument: p.instrumentNo ?? "",
        currency: CURRENCY_LABELS[p.connection.currency],
        amount: num(p.amount),
        rate: num(p.exchangeRate),
        amountTry: num(p.amountTry),
      });
    }
    sheets.push(sheet, payments);
  }

  const progress = workbook.addWorksheet("Hakedişler");
  progress.columns = [
    { header: "Tarih", key: "date", width: 12, style: { numFmt: "dd.mm.yyyy" } },
    { header: "Taşeron", key: "supplier", width: 30 },
    { header: "Vergi / TC no", key: "taxNumber", width: 14 },
    { header: "Vergi dairesi", key: "taxOffice", width: 16 },
    { header: "Proje", key: "project", width: 24 },
    { header: "Sözleşme", key: "contract", width: 28 },
    { header: "Hakediş no", key: "seq", width: 9 },
    { header: "Brüt (KDV hariç)", key: "gross", width: 15, style: { numFmt: MONEY } },
    { header: "KDV %", key: "vatRate", width: 7 },
    { header: "KDV", key: "vat", width: 12, style: { numFmt: MONEY } },
    { header: "KDV tevkifatı", key: "withheld", width: 13, style: { numFmt: MONEY } },
    { header: "Teminat kesintisi", key: "retention", width: 14, style: { numFmt: MONEY } },
    { header: "Avans mahsubu", key: "advance", width: 14, style: { numFmt: MONEY } },
    { header: "Malzeme mahsubu", key: "material", width: 14, style: { numFmt: MONEY } },
    { header: "Diğer kesintiler", key: "other", width: 14, style: { numFmt: MONEY } },
    { header: "Net ödeme", key: "payable", width: 15, style: { numFmt: MONEY } },
    { header: "Ödeme durumu", key: "payment", width: 11 },
    { header: "Ödeme tarihi", key: "paidAt", width: 12, style: { numFmt: "dd.mm.yyyy" } },
    { header: "Belge dosyası", key: "files", width: 40 },
  ];
  for (const b of billings) {
    progress.addRow({
      date: b.date,
      supplier: b.contract.supplier.name,
      taxNumber: b.contract.supplier.taxNumber ?? "",
      taxOffice: b.contract.supplier.taxOffice ?? "",
      project: b.project.name,
      contract: `${b.contract.no} ${b.contract.title}`,
      seq: b.seq,
      gross: num(b.grossAmount),
      vatRate: num(b.vatRate),
      vat: num(b.vatAmount),
      withheld: num(b.vatWithheld),
      retention: num(b.retention),
      advance: num(b.advanceOffset),
      material: num(b.materialOffset),
      other: num(b.otherDeductions),
      payable: num(b.payableAmount),
      payment: PAYMENT_STATUS_LABELS[b.paymentStatus],
      paidAt: b.paidAt,
      files: (documentNames.get(b.id) ?? []).join(", ") || "—",
    });
  }
  sheets.push(progress);
  for (const sheet of sheets) styleHeader(sheet);

  const periodName = `${iso(options.from)}_${iso(options.to)}`;
  files[`harcamalar_${periodName}.xlsx`] = new Uint8Array(await workbook.xlsx.writeBuffer());
  files["OKUBENI.txt"] = new TextEncoder().encode(
    [
      `İnşaat Maliyet — muhasebeci paketi`,
      `Dönem: ${iso(options.from)} – ${iso(options.to)}`,
      `Onaylı kayıt: ${invoices.length} (projelere bölünmüş faturalar tek satır)`,
      `Hazırlayan: ${user.name}, ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`,
      "",
      `Bağlantı faturası: ${connectionInvoices.length}, bağlantı ödemesi: ${connectionPayments.length}, hakediş: ${billings.length}`,
      "",
      "harcamalar_*.xlsx: Faturalar, Avanslar, Tedarikçi özeti, Hakedişler; tüm projeler seçiliyse",
      "Bağlantı faturaları ve Bağlantı ödemeleri (malzeme bağlantıları şirket genelidir).",
      "belgeler/: Fatura / fiş görselleri; dosya adları Excel'deki “Belge dosyası” sütununda.",
    ].join("\r\n"),
  );

  await db.$transaction((tx) =>
    writeAudit(tx, {
      userId: user.id,
      action: "export",
      entity: "AccountantPackage",
      changes: { from: iso(options.from), to: iso(options.to), invoices: invoices.length },
    }),
  );
  return { zip: zipSync(files, { level: 6 }), fileName: `muhasebeci-paketi_${periodName}.zip` };
}
