// Örnek veri: programı denemek için ayrı "insaat_demo" veritabanına dolu bir proje yükler
// (scripts/demo.mjs çalıştırır; gerçek veritabanına dokunmaz). Tekrar çalıştırılırsa bir şey yapmaz.
// Rakamlar temsilîdir, gerçek fiyat değildir.
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { DocumentType, ExpenseKind, PaymentStatus } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/auth/password";
import { computeProgressBilling, progressCostRows } from "../src/lib/contracts/progress";
import { planCostTreeCopy } from "../src/lib/cost-tree/tree";
import { computeExpenseAmounts } from "../src/lib/expenses/amounts";
import { generateUnits } from "../src/lib/budget/units";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const d = (v: string | number) => new Decimal(v);
const DAY = 86_400_000;
const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);
const PROJECT_NAME = "Demo – Kadıköy Konutları";

async function main() {
  if (!process.env.DATABASE_URL?.includes("insaat_demo")) {
    throw new Error("Örnek veri yalnızca insaat_demo veritabanına yüklenir (npm run demo).");
  }
  if (await db.project.count({ where: { name: PROJECT_NAME } })) {
    console.log("Örnek veri zaten yüklü.");
    return;
  }
  const admin = await db.user.findFirstOrThrow({ where: { role: "yonetici" } });
  const password = await hashPassword("Demo.2026");
  const user = (email: string, name: string, role: "muhasebe" | "santiye_sefi" | "satin_alma") =>
    db.user.upsert({ where: { email }, update: {}, create: { email, name, role, passwordHash: password } });
  const [muhasebe, sef, satinAlma] = await Promise.all([
    user("muhasebe@demo.local", "Ayşe Muhasebe", "muhasebe"),
    user("sef@demo.local", "Ali Şantiye Şefi", "santiye_sefi"),
    user("satinalma@demo.local", "Can Satın Alma", "satin_alma"),
  ]);

  // Tedarikçiler
  const supplier = (name: string, taxNumber: string, kind: "SUPPLIER" | "SUBCONTRACTOR" = "SUPPLIER") =>
    db.supplier.create({ data: { name, taxNumber, kind } });
  const beton = await supplier("Akın Beton A.Ş.", "1111111111");
  const demir = await supplier("Demirci Metal Ltd.", "2222222222");
  const seramikci = await supplier("Ege Seramik", "3333333333");
  const taseron = await supplier("Yıldız Yapı (taşeron)", "4444444444", "SUBCONTRACTOR");
  const nalbur = await supplier("Merkez Nalbur", "5555555555");

  // Proje, bloklar, maliyet ağacı
  const project = await db.project.create({
    data: {
      name: PROJECT_NAME,
      type: "RESIDENTIAL",
      status: "CONSTRUCTION",
      address: "Örnek Mah. Deneme Sok. No: 1, Kadıköy / İstanbul",
      landArea: d("1250.5"),
      floorAreaRatio: d("2.07"),
      groundCoverageRatio: d("0.35"),
      landModel: "FLAT_FOR_LAND",
      startDate: daysAgo(150),
      durationMonths: 24,
      createdById: admin.id,
      blocks: {
        create: [
          { name: "A Blok", floorCount: 8, basementCount: 2, constructionArea: d(3000), sortOrder: 0 },
          { name: "B Blok", floorCount: 6, basementCount: 1, constructionArea: d("2150.75"), sortOrder: 1 },
        ],
      },
    },
    include: { blocks: true },
  });
  const [blockA, blockB] = project.blocks.sort((a, b) => a.sortOrder - b.sortOrder);
  const templates = await db.costItemTemplate.findMany();
  await db.costItem.createMany({ data: planCostTreeCopy(templates, project.id, randomUUID, true) });
  const items = new Map((await db.costItem.findMany({ where: { projectId: project.id } })).map((i) => [i.code, i]));
  const item = (code: string) => items.get(code)!.id;
  for (const u of [muhasebe, sef, satinAlma]) {
    await db.projectPermission.create({ data: { userId: u.id, projectId: project.id, role: u.role } });
  }

  // Arsa sahibi ve bağımsız bölümler
  const owner = await db.landowner.create({
    data: { projectId: project.id, name: "Mehmet Arsa Sahibi", sharePercent: d(45), monthlyRentAid: d(25000), phone: "0532 000 00 00" },
  });
  const unitsA = generateUnits({ blockId: blockA.id, fromFloor: 1, toFloor: 8, perFloor: 2, startNo: 1, usageType: "RESIDENTIAL", layout: "3+1", netArea: d(100), grossArea: d(125) });
  const unitsB = generateUnits({ blockId: blockB.id, fromFloor: 1, toFloor: 6, perFloor: 2, startNo: 1, usageType: "RESIDENTIAL", layout: "2+1", netArea: d(90), grossArea: d(115) });
  const shops = generateUnits({ blockId: blockA.id, fromFloor: 0, toFloor: 0, perFloor: 2, startNo: 101, usageType: "SHOP", layout: null, netArea: d(70), grossArea: d(85) });
  // Arsa sahibine: A Blok 1–4. katlar (8 daire) + B Blok 1–3. katlar (6 daire) + 1 dükkân
  const landownerDoors = new Set([...unitsA.slice(0, 8), ...unitsB.slice(0, 6), shops[0]]);
  await db.unit.createMany({
    data: [...unitsA, ...unitsB, ...shops].map((u) => ({
      projectId: project.id,
      ...u,
      facade: u.floor % 2 === 0 ? "G" : "K",
      owner: landownerDoors.has(u) ? ("LANDOWNER" as const) : ("CONTRACTOR" as const),
      landownerId: landownerDoors.has(u) ? owner.id : null,
    })),
  });

  // Kurlar (temsilî)
  for (const [currency, buying, selling] of [["USD", "41.80", "41.95"], ["EUR", "48.50", "48.70"]] as const) {
    await db.exchangeRate.upsert({
      where: { date_currency: { date: today, currency } },
      update: {},
      create: { date: today, currency, buying: d(buying), selling: d(selling), source: "MANUAL" },
    });
  }

  // Harcamalar
  type ExpenseSpec = {
    code: string | null;
    daysAgo: number;
    supplierId: string | null;
    description: string;
    amount?: string;
    quantity?: string;
    unit?: string;
    unitPrice?: string;
    vat?: string;
    documentNo: string;
    documentType?: DocumentType;
    kind?: ExpenseKind;
    paid?: boolean;
    dueIn?: number;
    pending?: boolean;
    by?: string;
    blockId?: string | null;
  };
  const expense = (s: ExpenseSpec) => {
    const vatRate = d(s.vat ?? "20");
    const amounts = s.unitPrice
      ? computeExpenseAmounts({ mode: "unit", quantity: d(s.quantity!), unitPrice: d(s.unitPrice), vatRate, exchangeRate: d(1) })
      : computeExpenseAmounts({ mode: "total", amount: d(s.amount!), includesVat: true, vatRate, exchangeRate: d(1) });
    const paymentStatus: PaymentStatus = s.paid ? "PAID" : "UNPAID";
    return db.expense.create({
      data: {
        projectId: project.id,
        kind: s.kind ?? "EXPENSE",
        date: daysAgo(s.daysAgo),
        costItemId: s.code ? item(s.code) : null,
        blockId: s.blockId ?? null,
        supplierId: s.supplierId,
        description: s.description,
        quantity: s.quantity ? d(s.quantity) : null,
        unit: s.unit ?? null,
        unitPrice: s.unitPrice ? d(s.unitPrice) : null,
        currency: "TRY",
        exchangeRate: d(1),
        vatRate,
        ...amounts,
        documentType: s.documentType ?? "INVOICE",
        documentNo: s.documentNo,
        paymentStatus,
        paymentMethod: s.paid ? "BANK_TRANSFER" : null,
        paidAt: s.paid ? daysAgo(Math.max(s.daysAgo - 5, 0)) : null,
        dueDate: s.dueIn != null ? new Date(today.getTime() + s.dueIn * DAY) : null,
        approvalStatus: s.pending ? "PENDING" : "APPROVED",
        approvedById: s.pending ? null : muhasebe.id,
        approvedAt: s.pending ? null : new Date(),
        createdById: s.by ?? muhasebe.id,
      },
    });
  };
  const specs: ExpenseSpec[] = [
    { code: "02.03", daysAgo: 140, supplierId: null, description: "Mimari ve statik proje bedeli", amount: "960000", documentNo: "PRJ-2026-01", paid: true },
    { code: "02.05", daysAgo: 130, supplierId: null, description: "Yapı ruhsatı harcı", amount: "185000", vat: "0", documentNo: "BLD-4471", documentType: "RECEIPT", paid: true },
    { code: "03.01", daysAgo: 120, supplierId: nalbur.id, description: "Şantiye konteyneri ve çit", amount: "420000", documentNo: "MN-0091", paid: true },
    { code: "04.01", daysAgo: 110, supplierId: null, description: "Hafriyat ve döküm sahası", quantity: "6200", unit: "m³", unitPrice: "210", documentNo: "HF-2026-12", paid: true },
    { code: "05.05", daysAgo: 70, supplierId: demir.id, description: "Nervürlü demir Ø12–Ø16", quantity: "85", unit: "ton", unitPrice: "26500", documentNo: "DM-55210", paid: true },
    { code: "05.05", daysAgo: 25, supplierId: demir.id, description: "Nervürlü demir Ø12–Ø16", quantity: "60", unit: "ton", unitPrice: "27200", documentNo: "DM-55890", dueIn: 5 },
    { code: "05.06", daysAgo: 60, supplierId: nalbur.id, description: "Kalıp malzemesi kira", amount: "650000", documentNo: "MN-0144", dueIn: -3 },
    { code: "08.05", daysAgo: 12, supplierId: seramikci.id, description: "Seramik yapıştırıcı", quantity: "2000", unit: "kg", unitPrice: "13.5", documentNo: "ES-2026-301", dueIn: 20 },
    { code: "03.05", daysAgo: 30, supplierId: null, description: "Şantiye elektrik faturası", amount: "38500", documentNo: "EL-10/2026", paid: true },
    { code: "03.06", daysAgo: 2, supplierId: nalbur.id, description: "Şantiye sarf malzemesi", amount: "12400", documentNo: "MN-0201", documentType: "RECEIPT", pending: true, by: sef.id },
    { code: null, daysAgo: 45, supplierId: taseron.id, description: "Kaba inşaat taşeron avansı", amount: "750000", vat: "0", documentNo: "AV-TS-01", documentType: "VOUCHER", kind: "ADVANCE", paid: true },
  ];
  const created = [];
  for (const s of specs) created.push(await expense(s));
  const advance = created.at(-1)!;

  // Kütüphane
  const resource = (code: string, name: string, unit: string, type: "MATERIAL" | "LABOR" = "MATERIAL", waste = "0", category = "Kaba yapı") =>
    db.resource.create({ data: { code, name, unit, type, wastePercent: d(waste), category } });
  const rBeton = await resource("M-0001", "Hazır beton C30", "m³");
  const rDemir = await resource("M-0002", "Nervürlü demir", "ton", "MATERIAL", "3");
  const rSeramik = await resource("M-0003", "Seramik 60×60", "m²", "MATERIAL", "8", "İnce işler");
  const rYapistirici = await resource("M-0004", "Seramik yapıştırıcı", "kg", "MATERIAL", "0", "İnce işler");
  const rDerz = await resource("M-0005", "Derz dolgu", "kg", "MATERIAL", "0", "İnce işler");
  const rUsta = await resource("I-0001", "Seramik ustalığı", "m²", "LABOR", "0", "İnce işler");
  await db.resourcePrice.createMany({
    data: [
      { resourceId: rSeramik.id, date: daysAgo(20), price: d(420), source: "QUOTE", supplierId: seramikci.id, note: "Teklif" },
      { resourceId: rDerz.id, date: daysAgo(20), price: d(32), source: "MARKET" },
      { resourceId: rUsta.id, date: daysAgo(15), price: d(260), source: "QUOTE", supplierId: taseron.id },
    ],
  });
  // Fatura → kütüphane eşleştirmeleri (son alım fiyatı)
  await db.expense.updateMany({ where: { projectId: project.id, documentNo: { in: ["DM-55210", "DM-55890"] } }, data: { resourceId: rDemir.id } });
  await db.expense.updateMany({ where: { projectId: project.id, documentNo: "ES-2026-301" }, data: { resourceId: rYapistirici.id } });
  const recipe = await db.recipe.create({
    data: {
      code: "R-08.05",
      name: "Zemin seramiği",
      unit: "m²",
      description: "1 m² seramik + 5 kg yapıştırıcı + 0,4 kg derz + 1 m² ustalık",
      lines: {
        create: [
          { resourceId: rSeramik.id, quantity: d(1), sortOrder: 0 },
          { resourceId: rYapistirici.id, quantity: d(5), sortOrder: 1 },
          { resourceId: rDerz.id, quantity: d("0.4"), sortOrder: 2 },
          { resourceId: rUsta.id, quantity: d(1), sortOrder: 3 },
        ],
      },
    },
  });

  // Malzeme bağlantısı: 2.500 m³ hazır beton; projeye 1.800, kalanı havuzda
  const connection = await db.connection.create({
    data: {
      no: "BG-DEMO-001",
      date: daysAgo(100),
      supplierId: beton.id,
      status: "ACTIVE",
      priceType: "FIXED",
      currency: "TRY",
      lastDrawDate: new Date(today.getTime() + 25 * DAY),
      deliveryPlace: "Şantiye teslim, pompa hariç",
      createdById: satinAlma.id,
      items: {
        create: [{ sortOrder: 0, description: "Hazır beton C30", costItemCode: "05.04.01", unit: "m³", quantity: d(2500), unitPrice: d(3200), vatRate: d(20), resourceId: rBeton.id }],
      },
      payments: {
        create: [
          { dueDate: daysAgo(95), amount: d(3000000), description: "Peşin avans", paymentStatus: "PAID", paidAt: daysAgo(95), paymentMethod: "BANK_TRANSFER", amountTry: d(3000000) },
          { dueDate: new Date(today.getTime() + 4 * DAY), amount: d(3000000), description: "2. taksit (çek)", paymentMethod: "CHEQUE", instrumentNo: "ÇK-118822", amountTry: d(3000000) },
          { dueDate: new Date(today.getTime() + 64 * DAY), amount: d(3600000), description: "Bakiye", amountTry: d(3600000) },
        ],
      },
    },
    include: { items: true },
  });
  const connectionItem = connection.items[0];
  await db.connectionAllocation.create({ data: { itemId: connectionItem.id, projectId: project.id, quantity: d(1800) } });
  for (const [ago, qty, no, block, pending] of [
    [80, "420", "IRS-0101", blockA.id, false],
    [55, "380", "IRS-0144", blockA.id, false],
    [30, "310", "IRS-0190", blockB.id, false],
    [1, "45", "IRS-0233", blockB.id, true],
  ] as const) {
    const amounts = computeExpenseAmounts({ mode: "unit", quantity: d(qty), unitPrice: d(3200), vatRate: d(20), exchangeRate: d(1) });
    await db.expense.create({
      data: {
        projectId: project.id,
        kind: "DELIVERY",
        date: daysAgo(ago),
        costItemId: item("05.04.01"),
        blockId: block,
        supplierId: beton.id,
        description: "Hazır beton C30",
        quantity: d(qty),
        unit: "m³",
        unitPrice: d(3200),
        vatRate: d(20),
        ...amounts,
        documentType: "DELIVERY_NOTE",
        documentNo: no,
        connectionId: connection.id,
        connectionItemId: connectionItem.id,
        approvalStatus: pending ? "PENDING" : "APPROVED",
        approvedById: pending ? null : muhasebe.id,
        approvedAt: pending ? null : new Date(),
        createdById: sef.id,
      },
    });
  }
  await db.connectionInvoice.create({
    data: {
      connectionId: connection.id,
      date: daysAgo(50),
      documentNo: "AKN-F-2026-0412",
      netAmount: d(2560000),
      vatAmount: d(512000),
      totalAmount: d(3072000),
      totalAmountTry: d(3072000),
      createdById: muhasebe.id,
      lines: { create: [{ itemId: connectionItem.id, quantity: d(800), unitPrice: d(3200), vatRate: d(20) }] },
    },
  });

  // Taşeron sözleşmesi ve onaylı hakediş
  const contract = await db.subcontractContract.create({
    data: {
      projectId: project.id,
      supplierId: taseron.id,
      no: "TS-01",
      date: daysAgo(90),
      title: "Kaba inşaat işçiliği",
      scope: "Kalıp, demir ve beton döküm işçiliği (malzeme bizden)",
      supplyMethod: "LABOR_ONLY",
      vatRate: d(20),
      vatWithholdingRate: d(40),
      retentionRate: d(5),
      advanceOffsetRate: d(20),
      createdById: admin.id,
      items: {
        create: [
          { sortOrder: 0, costItemId: item("05.07"), description: "Kalıp + demir + döküm işçiliği", unit: "m²", quantity: d(5150), unitPrice: d(650) },
        ],
      },
    },
    include: { items: true },
  });
  await db.expense.update({ where: { id: advance.id }, data: { contractId: contract.id } });
  const progress = computeProgressBilling({
    lines: [{ contractItemId: contract.items[0].id, description: "işçilik", unit: "m²", unitPrice: d(650), contractQuantity: d(5150), previousQuantity: d(0), cumulativeQuantity: d(1800) }],
    terms: { vatRate: d(20), vatWithholdingRate: d(40), retentionRate: d(5), advanceOffsetRate: d(20) },
    openAdvance: d(750000),
    advanceOffset: null,
    materialOffset: d(0),
    otherDeductions: d(0),
  });
  const billing = await db.progressBilling.create({
    data: {
      contractId: contract.id,
      projectId: project.id,
      seq: 1,
      date: daysAgo(20),
      periodStart: daysAgo(90),
      periodEnd: daysAgo(21),
      status: "APPROVED",
      grossAmount: progress.grossAmount,
      vatRate: d(20),
      vatAmount: progress.vatAmount,
      vatWithheld: progress.vatWithheld,
      retention: progress.retention,
      advanceOffset: progress.advanceOffset,
      materialOffset: progress.materialOffset,
      otherDeductions: progress.otherDeductions,
      payableAmount: progress.payableAmount,
      dueDate: new Date(today.getTime() + 2 * DAY),
      approvedById: muhasebe.id,
      approvedAt: new Date(),
      createdById: sef.id,
      lines: { create: progress.lines.map((l) => ({ contractItemId: l.contractItemId, cumulativeQuantity: l.cumulativeQuantity, previousQuantity: l.previousQuantity, amount: l.amount })) },
    },
  });
  for (const row of progressCostRows([{ costItemId: contract.items[0].costItemId, amount: progress.grossAmount }], progress.materialOffset, progress.vatAmount)) {
    await db.expense.create({
      data: {
        projectId: project.id,
        kind: "PROGRESS",
        date: billing.date,
        costItemId: row.costItemId,
        supplierId: taseron.id,
        description: "TS-01 Kaba inşaat işçiliği – 1. hakediş",
        vatRate: d(20),
        netAmount: row.netAmount,
        vatAmount: row.vatAmount,
        totalAmount: row.netAmount.plus(row.vatAmount),
        netAmountTry: row.netAmount,
        vatAmountTry: row.vatAmount,
        totalAmountTry: row.netAmount.plus(row.vatAmount),
        documentType: "PROGRESS_BILLING",
        documentNo: "TS-01/1",
        contractId: contract.id,
        progressBillingId: billing.id,
        approvalStatus: "APPROVED",
        approvedById: muhasebe.id,
        approvedAt: new Date(),
        createdById: muhasebe.id,
      },
    });
  }

  // Metraj katsayıları ve bütçe
  const template = await db.parametricCoefficient.findMany({ where: { projectId: null } });
  await db.parametricCoefficient.createMany({
    data: template.map((t) => ({ projectId: project.id, costItemCode: t.costItemCode, name: t.name, basis: t.basis, coefficient: t.coefficient, unit: t.unit, note: t.note, sortOrder: t.sortOrder })),
  });
  const coef = new Map((await db.parametricCoefficient.findMany({ where: { projectId: project.id } })).map((c) => [c.costItemCode, c]));
  const line = (data: Parameters<typeof db.budgetLine.create>[0]["data"]) => db.budgetLine.create({ data });
  const base = { projectId: project.id };
  await line({ ...base, costItemId: item("01.03"), description: "Kira yardımı (24 ay)", quantity: d(24), unit: "ay", unitPrice: d(25000) });
  await line({ ...base, costItemId: item("02.03"), description: "Proje bedelleri", quantity: d(1), unit: "götürü", unitPrice: d(800000) });
  await line({ ...base, costItemId: item("02.05"), description: "Yapı ruhsatı harcı", quantity: d(1), unit: "götürü", unitPrice: d(185000) });
  await line({ ...base, costItemId: item("03.01"), description: "Şantiye kurulumu", quantity: d(1), unit: "götürü", unitPrice: d(450000) });
  await line({ ...base, costItemId: item("04.01"), description: "Hafriyat", quantitySource: "FORMULA", formula: "arsa_alani * 0,35 * 3 * bodrum_sayisi", quantity: d(0), unit: "m³", unitPrice: d(200) });
  await line({ ...base, costItemId: item("05.04.01"), description: "Hazır beton C30", quantitySource: "PARAMETRIC", coefficientId: coef.get("05.04.01")!.id, quantity: d(0), unit: "m³", priceSource: "RESOURCE", resourceId: rBeton.id });
  await line({ ...base, costItemId: item("05.05"), description: "İnşaat demiri", quantitySource: "PARAMETRIC", coefficientId: coef.get("05.05")!.id, quantity: d(0), unit: "ton", priceSource: "RESOURCE", resourceId: rDemir.id, wastePercent: d(3) });
  await line({ ...base, costItemId: item("05.06"), description: "Kalıp", quantitySource: "PARAMETRIC", coefficientId: coef.get("05.06")!.id, quantity: d(0), unit: "m²", unitPrice: d(185) });
  await line({ ...base, costItemId: item("05.07"), description: "Kaba işçilik (TS-01)", supplyMethod: "LABOR_ONLY", quantity: d(5150), unit: "m²", unitPrice: d(650) });
  await line({ ...base, costItemId: item("08.01"), description: "İç sıva", quantitySource: "PARAMETRIC", coefficientId: coef.get("08.01")!.id, quantity: d(0), unit: "m²", unitPrice: d(190) });
  await line({ ...base, costItemId: item("08.05"), description: "Zemin seramiği", quantitySource: "FORMULA", formula: "net_alan * 0,9", quantity: d(0), unit: "m²", priceSource: "RECIPE", recipeId: recipe.id });
  await line({ ...base, costItemId: item("08.08"), description: "İç boya", quantitySource: "PARAMETRIC", coefficientId: coef.get("08.08")!.id, quantity: d(0), unit: "m²", unitPrice: d(95) });
  await line({ ...base, costItemId: item("11.01"), description: "Asansörler", quantity: d(3), unit: "adet", unitPrice: d(1450000) });
  await line({ ...base, costItemId: item("16.01"), description: "Öngörülemeyen giderler", quantity: d(1), unit: "götürü", unitPrice: d(2500000) });

  // Sekme: yönetici açınca demo projesi sekmede görünsün
  const last = await db.userTab.aggregate({ where: { userId: admin.id }, _max: { position: true } });
  await db.userTab.create({ data: { userId: admin.id, projectId: project.id, position: (last._max.position ?? -1) + 1 } });

  console.log(`Örnek veri yüklendi: "${PROJECT_NAME}" (net ödenecek ilk hakediş ${progress.payableAmount.toFixed(2)} TL).`);
  console.log("Ek kullanıcılar (şifre Demo.2026): muhasebe@demo.local, sef@demo.local, satinalma@demo.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
