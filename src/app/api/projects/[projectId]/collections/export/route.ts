import ExcelJS from "exceljs";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { CHEQUE_STATUS_LABELS, INSTALLMENT_KIND_LABELS, INSTALLMENT_STATE_LABELS } from "@/lib/sales/labels";
import { ActionError } from "@/server/access";
import { getCollectionsExport } from "@/server/sales";
import { getSessionUser } from "@/server/session";

const MONEY = "#,##0.00";
const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));

/** Taksit takvimi ve tahsilatlar (Excel). */
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/collections/export">) {
  if (!(await getSessionUser())) return new Response("Oturum açın.", { status: 401 });
  const { projectId } = await params;
  try {
    const data = await getCollectionsExport(projectId);
    const wb = new ExcelJS.Workbook();
    wb.creator = "İnşaat Maliyet";
    const plan = wb.addWorksheet("Taksit takvimi");
    plan.columns = [
      { header: "Vade", key: "due", width: 12, style: { numFmt: "dd.mm.yyyy" } },
      { header: "Blok", key: "block", width: 10 },
      { header: "No", key: "door", width: 7 },
      { header: "Müşteri", key: "customer", width: 26 },
      { header: "Telefon", key: "phone", width: 15 },
      { header: "Tür", key: "kind", width: 14 },
      { header: "Para birimi", key: "currency", width: 8 },
      { header: "Tutar", key: "amount", width: 14, style: { numFmt: MONEY } },
      { header: "Ödenen", key: "paid", width: 14, style: { numFmt: MONEY } },
      { header: "Kalan", key: "remaining", width: 14, style: { numFmt: MONEY } },
      { header: "Durum", key: "state", width: 12 },
      { header: "Gecikme (gün)", key: "days", width: 10 },
    ];
    for (const { contract: c, installment: i } of data.installments) {
      plan.addRow({
        due: i.dueDate,
        block: c.unit.block.name,
        door: c.unit.doorNo,
        customer: c.customer.name,
        phone: c.customer.phone ?? "",
        kind: INSTALLMENT_KIND_LABELS[i.kind],
        currency: c.currency,
        amount: num(i.amount),
        paid: num(i.paid),
        remaining: num(i.remaining),
        state: INSTALLMENT_STATE_LABELS[i.state],
        days: i.daysOverdue || null,
      });
    }
    plan.getRow(1).font = { bold: true };
    plan.views = [{ state: "frozen", ySplit: 1 }];
    const col = wb.addWorksheet("Tahsilatlar");
    col.columns = [
      { header: "Tarih", key: "date", width: 12, style: { numFmt: "dd.mm.yyyy" } },
      { header: "Blok", key: "block", width: 10 },
      { header: "No", key: "door", width: 7 },
      { header: "Müşteri", key: "customer", width: 26 },
      { header: "Şekil", key: "method", width: 14 },
      { header: "Belge no", key: "doc", width: 12 },
      { header: "Çek / senet vadesi", key: "chequeDue", width: 12, style: { numFmt: "dd.mm.yyyy" } },
      { header: "Çek / senet durumu", key: "chequeStatus", width: 14 },
      { header: "Para birimi", key: "currency", width: 8 },
      { header: "Tutar", key: "amount", width: 14, style: { numFmt: MONEY } },
      { header: "TL", key: "amountTry", width: 14, style: { numFmt: MONEY } },
    ];
    for (const { contract: c, collection: x } of data.collections) {
      col.addRow({
        date: x.date,
        block: c.unit.block.name,
        door: c.unit.doorNo,
        customer: c.customer.name,
        method: PAYMENT_METHOD_LABELS[x.method],
        doc: x.documentNo ?? "",
        chequeDue: x.chequeDueDate,
        chequeStatus: x.chequeStatus ? CHEQUE_STATUS_LABELS[x.chequeStatus] : "",
        currency: c.currency,
        amount: num(x.amount),
        amountTry: num(x.amountTry),
      });
    }
    col.getRow(1).font = { bold: true };
    col.views = [{ state: "frozen", ySplit: 1 }];
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tahsilatlar_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof ActionError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
