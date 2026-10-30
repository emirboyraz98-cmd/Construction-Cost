import "server-only";
import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import type { ConnectionStatus, PaymentMethod } from "@/generated/prisma/enums";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { connectionAlerts, type ConnectionAlert } from "@/lib/connections/alerts";
import { advanceBalance, itemBalance, planDraw, validateAllocations, type ItemBalance } from "@/lib/connections/balance";
import { invoiceAmounts, invoiceWarnings, type ItemRef } from "@/lib/connections/invoices";
import { initialApprovalStatus } from "@/lib/expenses/access";
import { computeExpenseAmounts, roundMoney } from "@/lib/expenses/amounts";
import { CURRENCY_LABELS } from "@/lib/expenses/labels";
import type { ConnectionData } from "@/lib/validation/purchasing";
import { ActionError, getAccess, requireGlobalCapability } from "./access";
import { writeAudit } from "./audit";
import { db, type Tx } from "./db";
import { latestRate, requireRateOn } from "./rates";
import { discardFiles, documentRows, removeOrphanFiles, storeFiles } from "./uploads";

// Malzeme bağlantıları (PLAN.md Bölüm 9). Bağlantılar şirket genelidir; çekişler (Expense.kind =
// DELIVERY) projeye bağlıdır ve maliyeti bağlantı fiyatıyla oluşturur.

const zero = () => new Decimal(0);
const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);

// ---------------------------------------------------------------------------
// Özet: bakiye, avans, faturalar, uyarılar
// ---------------------------------------------------------------------------

const summaryInclude = {
  supplier: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" }, include: { allocations: { select: { projectId: true, quantity: true } } } },
  payments: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
  invoices: {
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { lines: true, documents: { select: { id: true, fileName: true } } },
  },
} satisfies Prisma.ConnectionInclude;

type ConnectionRow = Prisma.ConnectionGetPayload<{ include: typeof summaryInclude }>;

/** Reddedilmemiş, silinmemiş çekişler ve bağlantıya bağlanmış avanslar. */
async function loadActivity(connectionIds: string[]) {
  const [draws, advances] = await Promise.all([
    db.expense.findMany({
      where: { connectionId: { in: connectionIds }, kind: "DELIVERY", deletedAt: null, approvalStatus: { not: "REJECTED" } },
      select: { connectionItemId: true, projectId: true, quantity: true, approvalStatus: true, totalAmount: true, totalAmountTry: true },
    }),
    db.expense.findMany({
      where: { connectionId: { in: connectionIds }, kind: "ADVANCE", deletedAt: null, approvalStatus: { not: "REJECTED" } },
      select: { connectionId: true, totalAmount: true, totalAmountTry: true, paymentStatus: true },
    }),
  ]);
  return { draws, advances };
}

type Activity = Awaited<ReturnType<typeof loadActivity>>;

export type ItemSummary = ConnectionRow["items"][number] & { balance: ItemBalance; deliveredValue: Decimal };

function summarize<T extends ConnectionRow>(c: T, activity: Activity, today: Date) {
  const items: ItemSummary[] = c.items.map((item) => {
    const draws = activity.draws.filter((d) => d.connectionItemId === item.id);
    const balance = itemBalance(
      dec(item.quantity),
      item.allocations.map((a) => ({ projectId: a.projectId, quantity: dec(a.quantity) })),
      draws.map((d) => ({ projectId: d.projectId, quantity: dec(d.quantity), approvalStatus: d.approvalStatus })),
    );
    const deliveredValue = draws
      .filter((d) => d.approvalStatus === "APPROVED")
      .reduce((sum, d) => sum.plus(dec(d.totalAmount)), zero());
    return { ...item, balance, deliveredValue };
  });

  let contractNet = zero();
  let contractTotal = zero();
  for (const item of c.items) {
    const net = roundMoney(dec(item.quantity).times(dec(item.unitPrice)));
    contractNet = contractNet.plus(net);
    contractTotal = contractTotal.plus(net).plus(roundMoney(net.times(dec(item.vatRate)).div(100)));
  }
  const delivered = items.reduce((sum, item) => sum.plus(item.deliveredValue), zero());
  const advances = activity.advances.filter((a) => a.connectionId === c.id);
  const paidPlan = c.payments.filter((p) => p.paymentStatus === "PAID").reduce((s, p) => s.plus(dec(p.amount)), zero());
  const paidAdvances = advances.filter((a) => a.paymentStatus === "PAID").reduce((s, a) => s.plus(dec(a.totalAmount)), zero());
  const paid = paidPlan.plus(paidAdvances);
  const unpaidPlan = c.payments.filter((p) => p.paymentStatus === "UNPAID").reduce((s, p) => s.plus(dec(p.amount)), zero());
  const advance = advanceBalance(paid, delivered);

  // Faturalar tarih sırasıyla; her biri kendinden öncekilerin faturaladığı miktarla karşılaştırılır.
  const invoiced = new Map<string, Decimal>();
  const invoices = c.invoices.map((invoice) => {
    const refs = new Map<string, ItemRef>(
      items.map((item) => [
        item.id,
        {
          id: item.id,
          description: item.description,
          unit: item.unit,
          quantity: dec(item.quantity),
          unitPrice: dec(item.unitPrice),
          invoiced: invoiced.get(item.id) ?? zero(),
          drawnApproved: item.balance.drawnApproved,
        },
      ]),
    );
    const lines = invoice.lines.map((l) => ({ itemId: l.itemId, quantity: dec(l.quantity), unitPrice: dec(l.unitPrice), vatRate: dec(l.vatRate) }));
    const warnings = invoiceWarnings(lines, refs);
    for (const line of lines) invoiced.set(line.itemId, (invoiced.get(line.itemId) ?? zero()).plus(line.quantity));
    return { ...invoice, warnings };
  });

  const alerts: ConnectionAlert[] = connectionAlerts(
    {
      status: c.status,
      lastDrawDate: c.lastDrawDate,
      validUntil: c.validUntil,
      priceFixedUntil: c.priceType === "FIXED_UNTIL" ? c.priceFixedUntil : null,
      items: items.map((item) => ({ description: item.description, unit: item.unit, total: item.balance.total, remaining: item.balance.remaining })),
      payments: c.payments,
      advanceBalance: advance,
      currencyLabel: CURRENCY_LABELS[c.currency],
      invoiceWarningCount: invoices.filter((i) => i.warnings.length > 0).length,
    },
    today,
  );

  return {
    ...(c as Omit<T, "items" | "invoices">),
    items,
    invoices,
    totals: { contractNet, contractTotal, delivered, paid, unpaidPlan, advance, invoiced: invoices.reduce((s, i) => s.plus(dec(i.totalAmount)), zero()) },
    alerts,
  };
}

export type ConnectionSummary = ReturnType<typeof summarize<ConnectionRow>>;

async function summaries(where: Prisma.ConnectionWhereInput) {
  const rows = await db.connection.findMany({ where, include: summaryInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  const activity = await loadActivity(rows.map((r) => r.id));
  const today = new Date();
  return rows.map((row) => summarize(row, activity, today));
}

/** Proje adları; kullanıcının göremediği projeler "Diğer proje" olarak gösterilir. */
async function projectNames(ids: string[]) {
  const { scope } = await getAccess();
  const projects = await db.project.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
  return new Map(projects.map((p) => [p.id, projectRole(scope, p.id) ? p.name : "Diğer proje"]));
}

// ---------------------------------------------------------------------------
// Listeleme ve ayrıntı
// ---------------------------------------------------------------------------

export async function listConnections(filters: { status?: ConnectionStatus | null; supplierId?: string | null; projectId?: string | null }) {
  const { user } = await requireGlobalCapability("connection.view");
  const rows = await summaries({
    status: filters.status ?? undefined,
    supplierId: filters.supplierId ?? undefined,
    items: filters.projectId ? { some: { allocations: { some: { projectId: filters.projectId } } } } : undefined,
  });
  const names = await projectNames(rows.flatMap((r) => r.items.flatMap((i) => i.balance.byProject.map((p) => p.projectId))));
  return { rows, projectName: Object.fromEntries(names), canManage: hasCapability(user.role, "connection.manage") };
}

export async function getConnection(connectionId: string) {
  const { user, scope } = await requireGlobalCapability("connection.view");
  const row = await db.connection.findUnique({
    where: { id: connectionId },
    include: { ...summaryInclude, documents: { orderBy: { createdAt: "asc" } }, createdBy: { select: { name: true } } },
  });
  if (!row) return null;
  const activity = await loadActivity([row.id]);
  const summary = summarize(row, activity, new Date());
  const [draws, advances, history] = await Promise.all([
    db.expense.findMany({
      where: { connectionId, kind: "DELIVERY", deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        projectId: true,
        date: true,
        quantity: true,
        unit: true,
        documentNo: true,
        approvalStatus: true,
        totalAmount: true,
        connectionItemId: true,
        createdBy: { select: { name: true } },
        block: { select: { name: true } },
        _count: { select: { documents: true } },
      },
    }),
    db.expense.findMany({
      where: { connectionId, kind: "ADVANCE", deletedAt: null },
      orderBy: { date: "asc" },
      select: { id: true, projectId: true, date: true, totalAmount: true, currency: true, documentNo: true, paymentStatus: true, approvalStatus: true },
    }),
    db.auditLog.findMany({
      where: { entity: "ConnectionAllocation", entityId: { in: row.items.map((i) => i.id) } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
  ]);
  const names = await projectNames([
    ...summary.items.flatMap((i) => i.balance.byProject.map((p) => p.projectId)),
    ...draws.map((d) => d.projectId),
    ...advances.map((a) => a.projectId),
  ]);
  const canSeeProject = (projectId: string) => projectRole(scope, projectId) !== null;
  return {
    connection: summary,
    draws: draws.map((d) => ({ ...d, link: canSeeProject(d.projectId) })),
    advances: advances.map((a) => ({ ...a, link: canSeeProject(a.projectId) })),
    history,
    projectName: Object.fromEntries(names),
    canManage: hasCapability(user.role, "connection.manage"),
  };
}

/** Bağlantı formu ve tahsis için seçenekler. */
export async function connectionFormOptions() {
  const { scope } = await requireGlobalCapability("connection.manage");
  const [suppliers, templates, projects, resources] = await Promise.all([
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, taxNumber: true } }),
    db.costItemTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true, unit: true } }),
    db.project.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true } }),
    db.resource.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, unit: true } }),
  ]);
  return { suppliers, costItems: templates, resources, projects: projects.filter((p) => projectRole(scope, p.id) !== null) };
}

// ---------------------------------------------------------------------------
// Kaydetme
// ---------------------------------------------------------------------------

async function nextConnectionNo(tx: Tx, date: Date) {
  const prefix = `BG-${date.getUTCFullYear()}-`;
  const count = await tx.connection.count({ where: { no: { startsWith: prefix } } });
  for (let n = count + 1; ; n += 1) {
    const no = `${prefix}${String(n).padStart(3, "0")}`;
    if (!(await tx.connection.count({ where: { no } }))) return no;
  }
}

async function validateCostCodes(tx: Tx, codes: string[]) {
  for (const code of new Set(codes)) {
    const known = (await tx.costItemTemplate.count({ where: { code } })) + (await tx.costItem.count({ where: { code } }));
    if (!known) throw new ActionError(`“${code}” maliyet kalemi bulunamadı.`);
  }
}

function headerColumns(data: ConnectionData) {
  return {
    date: data.date,
    supplierId: data.supplierId,
    status: data.status,
    priceType: data.priceType,
    currency: data.currency,
    priceFixedUntil: data.priceType === "FIXED_UNTIL" ? data.priceFixedUntil : null,
    validUntil: data.validUntil,
    lastDrawDate: data.lastDrawDate,
    deliveryPlace: data.deliveryPlace,
    transportIncluded: data.transportIncluded,
    unloadingIncluded: data.unloadingIncluded,
    notes: data.notes,
  };
}

export async function createConnection(data: ConnectionData, files: File[]) {
  const { user } = await requireGlobalCapability("connection.manage");
  const saved = await storeFiles(files);
  try {
    return await db.$transaction(async (tx) => {
      if (!(await tx.supplier.count({ where: { id: data.supplierId } }))) throw new ActionError("Tedarikçi bulunamadı.");
      await validateCostCodes(tx, data.items.map((i) => i.costItemCode));
      const no = data.no ?? (await nextConnectionNo(tx, data.date));
      if (await tx.connection.count({ where: { no } })) throw new ActionError(`“${no}” numaralı bağlantı zaten var.`);
      const rate = data.payments.length ? await latestRate(tx, data.currency) : new Decimal(1);
      const created = await tx.connection.create({
        data: {
          no,
          ...headerColumns(data),
          createdById: user.id,
          items: {
            create: data.items.map((item, index) => ({
              sortOrder: index,
              description: item.description,
              costItemCode: item.costItemCode,
              resourceId: item.resourceId,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
            })),
          },
          payments: {
            create: data.payments.map((p) => ({
              dueDate: p.dueDate,
              amount: p.amount,
              description: p.description,
              paymentMethod: p.paymentMethod,
              instrumentNo: p.instrumentNo,
              exchangeRate: rate,
              amountTry: roundMoney(p.amount.times(rate)),
            })),
          },
          documents: { create: documentRows(saved, user.id) },
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "create",
        entity: "Connection",
        entityId: created.id,
        changes: { no, supplierId: data.supplierId, items: data.items.length, payments: data.payments.length },
      });
      return created.id;
    });
  } catch (error) {
    await discardFiles(saved);
    throw error;
  }
}

/** Başlık ve kalemler. Çekişi / tahsisi / faturası olan kalem silinemez, miktarı bunların altına inemez. */
export async function updateConnection(connectionId: string, data: ConnectionData, files: File[], removeDocumentIds: string[]) {
  const { user } = await requireGlobalCapability("connection.manage");
  const before = await db.connection.findUnique({ where: { id: connectionId }, include: { items: { include: { allocations: true } } } });
  if (!before) throw new ActionError("Bağlantı bulunamadı.");
  const activity = await loadActivity([connectionId]);
  const saved = await storeFiles(files);
  let removedKeys: string[] = [];
  try {
    await db.$transaction(async (tx) => {
      await validateCostCodes(tx, data.items.map((i) => i.costItemCode));
      const no = data.no ?? before.no;
      if (no !== before.no && (await tx.connection.count({ where: { no } }))) throw new ActionError(`“${no}” numaralı bağlantı zaten var.`);
      const hasDraws = activity.draws.length > 0;
      if (hasDraws && data.currency !== before.currency) throw new ActionError("Çekiş yapılmış bağlantının para birimi değiştirilemez.");
      const keep = new Set(data.items.map((i) => i.id).filter(Boolean));
      for (const item of before.items) {
        if (keep.has(item.id)) continue;
        const used =
          activity.draws.some((d) => d.connectionItemId === item.id) ||
          item.allocations.length > 0 ||
          (await tx.connectionInvoiceLine.count({ where: { itemId: item.id } })) > 0;
        if (used) throw new ActionError(`“${item.description}” kaleminin tahsisi, çekişi veya faturası var; silinemez.`);
        await tx.connectionItem.delete({ where: { id: item.id } });
      }
      for (const [index, item] of data.items.entries()) {
        const columns = {
          sortOrder: index,
          description: item.description,
          costItemCode: item.costItemCode,
          resourceId: item.resourceId,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        };
        const existing = item.id ? before.items.find((i) => i.id === item.id) : undefined;
        if (!existing) {
          await tx.connectionItem.create({ data: { connectionId, ...columns } });
          continue;
        }
        const allocated = existing.allocations.reduce((s, a) => s.plus(dec(a.quantity)), zero());
        const drawn = activity.draws.filter((d) => d.connectionItemId === existing.id).reduce((s, d) => s.plus(dec(d.quantity)), zero());
        const floor = Decimal.max(allocated, drawn);
        if (item.quantity.lt(floor)) {
          throw new ActionError(`“${item.description}”: miktar, tahsis edilen / çekilen ${floor.toString()} ${existing.unit} altına inemez.`);
        }
        if (existing.costItemCode !== item.costItemCode && drawn.gt(0)) {
          throw new ActionError(`“${item.description}”: çekiş yapılmış kalemin maliyet kalemi değiştirilemez.`);
        }
        await tx.connectionItem.update({ where: { id: existing.id }, data: columns });
      }
      const removed = await tx.document.findMany({ where: { id: { in: removeDocumentIds }, connectionId }, select: { id: true, storageKey: true } });
      removedKeys = removed.map((d) => d.storageKey);
      await tx.document.deleteMany({ where: { id: { in: removed.map((d) => d.id) } } });
      await tx.connection.update({
        where: { id: connectionId },
        data: { no, ...headerColumns(data), documents: { create: documentRows(saved, user.id) } },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "update",
        entity: "Connection",
        entityId: connectionId,
        changes: { no, items: data.items.length, addedDocuments: saved.length, removedDocuments: removed.length },
      });
    });
  } catch (error) {
    await discardFiles(saved);
    throw error;
  }
  await removeOrphanFiles(removedKeys);
}

export async function setConnectionStatus(connectionId: string, status: ConnectionStatus) {
  const { user } = await requireGlobalCapability("connection.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.connection.update({ where: { id: connectionId }, data: { status } });
    await writeAudit(tx, { userId: user.id, action: "status", entity: "Connection", entityId: connectionId, changes: { status: { old: before.status, new: status } } });
  });
}

/** Yanlış açılan bağlantı: çekişi, ödenmiş ödemesi, faturası ve bağlı avansı yoksa tamamen silinir. */
export async function deleteConnection(connectionId: string) {
  const { user } = await requireGlobalCapability("connection.manage");
  const used =
    (await db.expense.count({ where: { connectionId, deletedAt: null } })) +
    (await db.connectionPayment.count({ where: { connectionId, paymentStatus: "PAID" } })) +
    (await db.connectionInvoice.count({ where: { connectionId } }));
  if (used) throw new ActionError("Çekişi, ödemesi, faturası veya bağlı avansı olan bağlantı silinemez; durumunu “İptal” yapın.");
  const keys = (await db.document.findMany({ where: { connectionId }, select: { storageKey: true } })).map((d) => d.storageKey);
  await db.$transaction(async (tx) => {
    const removed = await tx.connection.delete({ where: { id: connectionId } });
    await writeAudit(tx, { userId: user.id, action: "delete", entity: "Connection", entityId: connectionId, changes: { no: removed.no } });
  });
  await removeOrphanFiles(keys);
}

// ---------------------------------------------------------------------------
// Proje tahsisi
// ---------------------------------------------------------------------------

async function lockItem(tx: Tx, itemId: string) {
  // Aynı kaleme eşzamanlı çekiş / tahsis değişikliğinde bakiye aşımını önler.
  await tx.$queryRaw`SELECT id FROM "ConnectionItem" WHERE id = ${itemId} FOR UPDATE`;
}

export async function saveAllocations(itemId: string, allocations: { projectId: string; quantity: Decimal }[]) {
  const { user, scope } = await requireGlobalCapability("connection.manage");
  const rows = allocations.filter((a) => a.quantity.gt(0));
  await db.$transaction(async (tx) => {
    await lockItem(tx, itemId);
    const item = await tx.connectionItem.findUnique({ where: { id: itemId }, include: { allocations: true, connection: { select: { status: true } } } });
    if (!item) throw new ActionError("Bağlantı kalemi bulunamadı.");
    if (item.connection.status === "CANCELLED") throw new ActionError("İptal edilen bağlantıda tahsis değiştirilemez.");
    const before = new Map(item.allocations.map((a) => [a.projectId, dec(a.quantity)]));
    for (const row of rows) {
      const changed = !before.get(row.projectId)?.eq(row.quantity);
      if (changed && !projectRole(scope, row.projectId)) throw new ActionError("Erişiminiz olmayan bir projeye tahsis yapılamaz.");
    }
    const draws = await tx.expense.groupBy({
      by: ["projectId"],
      where: { connectionItemId: itemId, kind: "DELIVERY", deletedAt: null, approvalStatus: { not: "REJECTED" } },
      _sum: { quantity: true },
    });
    const drawn = new Map(draws.map((d) => [d.projectId, dec(d._sum.quantity)]));
    const names = new Map(
      (await tx.project.findMany({ where: { id: { in: [...rows.map((r) => r.projectId), ...drawn.keys()] } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
    );
    const errors = validateAllocations(dec(item.quantity), item.unit, rows, drawn, (id) => names.get(id) ?? "Proje");
    if (errors.length) throw new ActionError(errors.join(" "));
    if (rows.some((r) => !names.has(r.projectId))) throw new ActionError("Proje bulunamadı.");

    await tx.connectionAllocation.deleteMany({ where: { itemId, projectId: { notIn: rows.map((r) => r.projectId) } } });
    for (const row of rows) {
      await tx.connectionAllocation.upsert({
        where: { itemId_projectId: { itemId, projectId: row.projectId } },
        create: { itemId, projectId: row.projectId, quantity: row.quantity },
        update: { quantity: row.quantity },
      });
    }
    await writeAudit(tx, {
      userId: user.id,
      action: "allocate",
      entity: "ConnectionAllocation",
      entityId: itemId,
      changes: {
        before: Object.fromEntries([...before].map(([id, q]) => [names.get(id) ?? id, q.toString()])),
        after: Object.fromEntries(rows.map((r) => [names.get(r.projectId) ?? r.projectId, r.quantity.toString()])),
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Çekiş ("malzeme geldi")
// ---------------------------------------------------------------------------

/** Projede çekilebilecek bağlantı kalemleri (fiyat bilgisi olmadan; şantiye şefi de kullanır). */
export async function drawOptions(projectId: string) {
  const { scope } = await getAccess();
  const role = projectRole(scope, projectId);
  if (!hasCapability(role, "expense.create")) return null;
  const connections = await db.connection.findMany({
    where: { status: "ACTIVE" },
    include: summaryInclude,
    orderBy: { date: "asc" },
  });
  const activity = await loadActivity(connections.map((c) => c.id));
  const today = new Date();
  const options = connections.flatMap((c) => {
    const summary = summarize(c, activity, today);
    return summary.items.flatMap((item) => {
      const project = item.balance.byProject.find((p) => p.projectId === projectId);
      const projectRemaining = Decimal.max(project?.remaining ?? zero(), zero());
      const available = projectRemaining.plus(Decimal.max(item.balance.pool, zero()));
      if (available.lte(0)) return [];
      return [
        {
          itemId: item.id,
          connectionNo: c.no,
          supplierName: c.supplier.name,
          description: item.description,
          unit: item.unit,
          costItemCode: item.costItemCode,
          projectRemaining: projectRemaining.toString(),
          pool: Decimal.max(item.balance.pool, zero()).toString(),
          available: available.toString(),
          lastDrawDate: c.lastDrawDate,
        },
      ];
    });
  });
  const blocks = await db.block.findMany({ where: { projectId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return { options, blocks };
}

export type DrawData = {
  itemId: string;
  date: Date;
  quantity: Decimal;
  documentNo: string | null;
  blockId: string | null;
  description: string | null;
};

export async function createDraw(projectId: string, data: DrawData, files: File[]) {
  const { user, scope } = await getAccess();
  const role = projectRole(scope, projectId);
  if (!role) throw new ActionError("Proje bulunamadı veya bu projeye erişiminiz yok.");
  if (!hasCapability(role, "expense.create")) throw new ActionError("Bu işlem için yetkiniz yok.");
  const saved = await storeFiles(files);
  try {
    return await db.$transaction(async (tx) => {
      await lockItem(tx, data.itemId);
      const item = await tx.connectionItem.findUnique({ where: { id: data.itemId }, include: { allocations: true, connection: true } });
      if (!item) throw new ActionError("Bağlantı kalemi bulunamadı.");
      const connection = item.connection;
      if (connection.status !== "ACTIVE") throw new ActionError("Bağlantı aktif değil; çekiş girilemez.");
      const draws = await tx.expense.findMany({
        where: { connectionItemId: item.id, kind: "DELIVERY", deletedAt: null, approvalStatus: { not: "REJECTED" } },
        select: { projectId: true, quantity: true, approvalStatus: true },
      });
      const balance = itemBalance(
        dec(item.quantity),
        item.allocations.map((a) => ({ projectId: a.projectId, quantity: dec(a.quantity) })),
        draws.map((d) => ({ projectId: d.projectId, quantity: dec(d.quantity), approvalStatus: d.approvalStatus })),
      );
      const plan = planDraw(balance, projectId, data.quantity, item.unit);
      if (!plan.ok) throw new ActionError(plan.error);

      const costItem = await tx.costItem.findFirst({ where: { projectId, code: item.costItemCode }, select: { id: true, active: true } });
      if (!costItem) throw new ActionError(`“${item.costItemCode}” maliyet kalemi bu projede yok; önce maliyet ağacına ekleyin.`);
      if (!costItem.active) throw new ActionError(`“${item.costItemCode}” maliyet kalemi bu projede pasif.`);
      if (data.blockId && !(await tx.block.count({ where: { id: data.blockId, projectId } }))) throw new ActionError("Blok bu projede yok.");

      if (plan.fromPool.gt(0)) {
        const current = item.allocations.find((a) => a.projectId === projectId);
        const quantity = dec(current?.quantity).plus(plan.fromPool);
        await tx.connectionAllocation.upsert({
          where: { itemId_projectId: { itemId: item.id, projectId } },
          create: { itemId: item.id, projectId, quantity },
          update: { quantity },
        });
        await writeAudit(tx, {
          userId: user.id,
          projectId,
          action: "auto_allocate",
          entity: "ConnectionAllocation",
          entityId: item.id,
          changes: { fromPool: plan.fromPool.toString(), newAllocation: quantity.toString() },
        });
      }

      const exchangeRate = await requireRateOn(tx, data.date, connection.currency);
      const unitPrice = dec(item.unitPrice);
      const amounts = computeExpenseAmounts({ mode: "unit", quantity: data.quantity, unitPrice, vatRate: dec(item.vatRate), exchangeRate });
      const approvalStatus = initialApprovalStatus(role);
      const created = await tx.expense.create({
        data: {
          projectId,
          kind: "DELIVERY",
          date: data.date,
          costItemId: costItem.id,
          blockId: data.blockId,
          supplierId: connection.supplierId,
          description: data.description ?? item.description,
          quantity: data.quantity,
          unit: item.unit,
          unitPrice,
          currency: connection.currency,
          exchangeRate,
          vatRate: item.vatRate,
          ...amounts,
          documentType: "DELIVERY_NOTE",
          documentNo: data.documentNo,
          connectionId: connection.id,
          connectionItemId: item.id,
          approvalStatus,
          approvedById: approvalStatus === "APPROVED" ? user.id : null,
          approvedAt: approvalStatus === "APPROVED" ? new Date() : null,
          createdById: user.id,
          documents: { create: documentRows(saved, user.id) },
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        projectId,
        action: "draw",
        entity: "Expense",
        entityId: created.id,
        changes: { connection: connection.no, item: item.description, quantity: data.quantity.toString(), documentNo: data.documentNo },
      });
      return created.id;
    });
  } catch (error) {
    await discardFiles(saved);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Ödeme planı
// ---------------------------------------------------------------------------

export type PaymentData = {
  dueDate: Date;
  amount: Decimal;
  description: string | null;
  paymentMethod: PaymentMethod | null;
  instrumentNo: string | null;
};

export async function addConnectionPayment(connectionId: string, data: PaymentData) {
  const { user } = await requireGlobalCapability("connection.manage");
  await db.$transaction(async (tx) => {
    const connection = await tx.connection.findUnique({ where: { id: connectionId }, select: { currency: true } });
    if (!connection) throw new ActionError("Bağlantı bulunamadı.");
    const rate = await latestRate(tx, connection.currency);
    const created = await tx.connectionPayment.create({
      data: { connectionId, ...data, exchangeRate: rate, amountTry: roundMoney(data.amount.times(rate)) },
    });
    await writeAudit(tx, { userId: user.id, action: "create", entity: "ConnectionPayment", entityId: created.id, changes: { connectionId, amount: data.amount.toString() } });
  });
}

export async function updateConnectionPayment(paymentId: string, data: PaymentData) {
  const { user } = await requireGlobalCapability("connection.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.connectionPayment.findUnique({ where: { id: paymentId }, include: { connection: { select: { currency: true } } } });
    if (!before) throw new ActionError("Ödeme bulunamadı.");
    if (before.paymentStatus === "PAID") throw new ActionError("Ödenmiş satır değiştirilemez; önce “ödenmedi” yapın.");
    const rate = await latestRate(tx, before.connection.currency);
    await tx.connectionPayment.update({ where: { id: paymentId }, data: { ...data, exchangeRate: rate, amountTry: roundMoney(data.amount.times(rate)) } });
    await writeAudit(tx, { userId: user.id, action: "update", entity: "ConnectionPayment", entityId: paymentId, changes: { amount: { old: before.amount.toString(), new: data.amount.toString() } } });
  });
}

export async function deleteConnectionPayment(paymentId: string) {
  const { user } = await requireGlobalCapability("connection.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.connectionPayment.findUnique({ where: { id: paymentId } });
    if (!before) throw new ActionError("Ödeme bulunamadı.");
    if (before.paymentStatus === "PAID") throw new ActionError("Ödenmiş satır silinemez; önce “ödenmedi” yapın.");
    await tx.connectionPayment.delete({ where: { id: paymentId } });
    await writeAudit(tx, { userId: user.id, action: "delete", entity: "ConnectionPayment", entityId: paymentId, changes: { amount: before.amount.toString() } });
  });
}

/** Ödendi / ödenmedi. Dövizde kur verilmezse ödeme günündeki kur kullanılır. */
export async function setConnectionPaymentsPaid(
  paymentIds: string[],
  payment: { paid: true; paidAt: Date; method: PaymentMethod | null; exchangeRate: Decimal | null } | { paid: false },
) {
  const { user } = await requireGlobalCapability("connection.manage");
  return db.$transaction(async (tx) => {
    const rows = await tx.connectionPayment.findMany({ where: { id: { in: paymentIds } }, include: { connection: { select: { currency: true } } } });
    if (rows.length !== new Set(paymentIds).size) throw new ActionError("Ödeme bulunamadı.");
    for (const row of rows) {
      if (payment.paid) {
        const rate =
          row.connection.currency === "TRY"
            ? new Decimal(1)
            : (payment.exchangeRate ?? (await requireRateOn(tx, payment.paidAt, row.connection.currency)));
        await tx.connectionPayment.update({
          where: { id: row.id },
          data: {
            paymentStatus: "PAID",
            paidAt: payment.paidAt,
            ...(payment.method ? { paymentMethod: payment.method } : {}),
            exchangeRate: rate,
            amountTry: roundMoney(dec(row.amount).times(rate)),
          },
        });
      } else {
        await tx.connectionPayment.update({ where: { id: row.id }, data: { paymentStatus: "UNPAID", paidAt: null } });
      }
    }
    await writeAudit(tx, {
      userId: user.id,
      action: payment.paid ? "mark_paid" : "mark_unpaid",
      entity: "ConnectionPayment",
      changes: { ids: paymentIds },
    });
    return rows.length;
  });
}

// ---------------------------------------------------------------------------
// Faturalar
// ---------------------------------------------------------------------------

export type InvoiceData = {
  date: Date;
  documentNo: string;
  exchangeRate: Decimal | null;
  notes: string | null;
  lines: { itemId: string; quantity: Decimal; unitPrice: Decimal; vatRate: Decimal }[];
};

/** Faturayı kaydeder; bağlantı fiyat / miktarından farklar uyarı olarak döner (kayıt engellenmez). */
export async function createConnectionInvoice(connectionId: string, data: InvoiceData, files: File[]) {
  const { user } = await requireGlobalCapability("connection.manage");
  const saved = await storeFiles(files);
  try {
    const id = await db.$transaction(async (tx) => {
      const connection = await tx.connection.findUnique({ where: { id: connectionId }, include: { items: { select: { id: true } } } });
      if (!connection) throw new ActionError("Bağlantı bulunamadı.");
      const itemIds = new Set(connection.items.map((i) => i.id));
      if (data.lines.some((l) => !itemIds.has(l.itemId))) throw new ActionError("Fatura satırı bu bağlantının kalemi değil.");
      if (await tx.connectionInvoice.count({ where: { connectionId, documentNo: data.documentNo } })) {
        throw new ActionError(`“${data.documentNo}” numaralı fatura bu bağlantıda zaten kayıtlı.`);
      }
      const amounts = invoiceAmounts(data.lines);
      const rate = connection.currency === "TRY" ? new Decimal(1) : (data.exchangeRate ?? (await requireRateOn(tx, data.date, connection.currency)));
      const created = await tx.connectionInvoice.create({
        data: {
          connectionId,
          date: data.date,
          documentNo: data.documentNo,
          exchangeRate: rate,
          ...amounts,
          totalAmountTry: roundMoney(amounts.totalAmount.times(rate)),
          notes: data.notes,
          createdById: user.id,
          lines: { create: data.lines },
          documents: { create: documentRows(saved, user.id) },
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "create",
        entity: "ConnectionInvoice",
        entityId: created.id,
        changes: { connectionId, documentNo: data.documentNo, total: amounts.totalAmount.toString() },
      });
      return created.id;
    });
    const detail = await getConnection(connectionId);
    return detail?.connection.invoices.find((i) => i.id === id)?.warnings ?? [];
  } catch (error) {
    await discardFiles(saved);
    throw error;
  }
}

export async function deleteConnectionInvoice(invoiceId: string) {
  const { user } = await requireGlobalCapability("connection.manage");
  const keys = (await db.document.findMany({ where: { connectionInvoiceId: invoiceId }, select: { storageKey: true } })).map((d) => d.storageKey);
  await db.$transaction(async (tx) => {
    const removed = await tx.connectionInvoice.delete({ where: { id: invoiceId } });
    await writeAudit(tx, { userId: user.id, action: "delete", entity: "ConnectionInvoice", entityId: invoiceId, changes: { documentNo: removed.documentNo } });
  });
  await removeOrphanFiles(keys);
}

// ---------------------------------------------------------------------------
// Faz 1'de girilen avansların bağlantıya bağlanması
// ---------------------------------------------------------------------------

/** Bağlanabilecek avanslar: aynı tedarikçi ve para birimi, henüz bir bağlantıya / sözleşmeye bağlı değil. */
export async function linkableAdvances(connectionId: string) {
  const { scope } = await requireGlobalCapability("connection.manage");
  const connection = await db.connection.findUnique({ where: { id: connectionId }, select: { supplierId: true, currency: true } });
  if (!connection) return [];
  const rows = await db.expense.findMany({
    where: {
      kind: "ADVANCE",
      supplierId: connection.supplierId,
      currency: connection.currency,
      connectionId: null,
      contractId: null,
      deletedAt: null,
      approvalStatus: { not: "REJECTED" },
    },
    orderBy: { date: "asc" },
    select: { id: true, projectId: true, date: true, totalAmount: true, documentNo: true, description: true, paymentStatus: true, project: { select: { name: true } } },
  });
  return rows.filter((r) => hasCapability(projectRole(scope, r.projectId), "expense.manage"));
}

export async function setAdvanceConnection(expenseId: string, connectionId: string | null) {
  const { user, scope } = await requireGlobalCapability("connection.manage");
  const expense = await db.expense.findFirst({ where: { id: expenseId, kind: "ADVANCE", deletedAt: null } });
  if (!expense) throw new ActionError("Avans kaydı bulunamadı.");
  if (!hasCapability(projectRole(scope, expense.projectId), "expense.manage")) throw new ActionError("Bu avansın projesinde yetkiniz yok.");
  if (connectionId) {
    const connection = await db.connection.findUnique({ where: { id: connectionId }, select: { supplierId: true, currency: true } });
    if (!connection) throw new ActionError("Bağlantı bulunamadı.");
    if (expense.supplierId !== connection.supplierId) throw new ActionError("Avansın tedarikçisi bağlantınınkiyle aynı değil.");
    if (expense.currency !== connection.currency) throw new ActionError("Avansın para birimi bağlantıyla aynı olmalı.");
    if (expense.contractId) throw new ActionError("Bu avans bir taşeron sözleşmesine bağlı.");
  }
  await db.$transaction(async (tx) => {
    await tx.expense.update({ where: { id: expenseId }, data: { connectionId } });
    await writeAudit(tx, {
      userId: user.id,
      projectId: expense.projectId,
      action: connectionId ? "link_connection" : "unlink_connection",
      entity: "Expense",
      entityId: expenseId,
      changes: { connectionId: { old: expense.connectionId, new: connectionId } },
    });
  });
}

// ---------------------------------------------------------------------------
// Portföy ve proje paneli
// ---------------------------------------------------------------------------

/** Uyarısı olan aktif bağlantılar (portföy kartı). Yetkisi yoksa null. */
export async function connectionAlertOverview() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "connection.view")) return null;
  const rows = await summaries({ status: "ACTIVE" });
  return rows
    .filter((r) => r.alerts.length > 0)
    .map((r) => ({ id: r.id, no: r.no, supplier: r.supplier.name, alerts: r.alerts }))
    .sort((a, b) => Number(b.alerts.some((x) => x.level === "danger")) - Number(a.alerts.some((x) => x.level === "danger")));
}

/** Projeye tahsis edilmiş / çekilmiş bağlantı kalemleri (proje paneli). */
export async function projectConnections(projectId: string) {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "connection.view")) return null;
  const rows = await summaries({
    status: { in: ["ACTIVE", "COMPLETED"] },
    items: { some: { OR: [{ allocations: { some: { projectId } } }, { draws: { some: { projectId, deletedAt: null } } }] } },
  });
  return rows.map((r) => ({
    id: r.id,
    no: r.no,
    supplier: r.supplier.name,
    status: r.status,
    alerts: r.alerts,
    items: r.items.flatMap((item) => {
      const p = item.balance.byProject.find((x) => x.projectId === projectId);
      return p ? [{ id: item.id, description: item.description, unit: item.unit, allocated: p.allocated, drawn: p.drawn, remaining: p.remaining }] : [];
    }),
  }));
}
