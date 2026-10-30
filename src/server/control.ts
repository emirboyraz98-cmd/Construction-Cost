import "server-only";
import Decimal from "decimal.js";
import { hasCapability } from "@/lib/auth/roles";
import { CONSTRUCTION_GROUPS, topCode } from "@/lib/budget/budget";
import { connectionGain, controlTotals, coverage, itemControl, type ItemControl } from "@/lib/budget/control";
import { toTry } from "@/lib/budget/pricing";
import { compareCodes } from "@/lib/cost-tree/tree";
import { COST_KINDS } from "@/lib/expenses/kinds";
import { ActionError, requireProjectAccess, requireProjectCapability } from "./access";
import { writeAudit } from "./audit";
import { computeLines, loadLines, loadMetrics } from "./budget";
import { db } from "./db";
import { latestRates, priceBook } from "./library";

// Bütçe kontrolü (PLAN.md 8.3, 9.6, Faz 4): baz bütçe, güncel bütçe, gerçekleşen, ilerleme, EAC,
// sapma, bağlantı kapsaması ve bağlantı kazancı.

const zero = () => new Decimal(0);
const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);
const normUnit = (u: string | null | undefined) => (u ?? "").trim().toLocaleLowerCase("tr-TR");

async function requireView(projectId: string) {
  const access = await requireProjectAccess(projectId);
  if (!hasCapability(access.role, "budget.view")) throw new ActionError("Bu projenin bütçesini görme yetkiniz yok.");
  return access;
}

export async function listBaselines(projectId: string) {
  await requireView(projectId);
  return db.budgetBaseline.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { lines: true } } } });
}

export type ControlRow = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  depth: number;
  unit: string | null;
  baseline: Decimal | null;
  budget: Decimal;
  budgetQuantity: Decimal | null;
  actual: Decimal;
  actualQuantity: Decimal | null;
  manualPercent: Decimal | null;
  progressNote: string | null;
  control: ItemControl;
  /** Kendisinde veya altında bütçe / gerçekleşen var */
  hasData: boolean;
  isLeaf: boolean;
};

export async function getBudgetControl(projectId: string, baselineId: string | null) {
  const { role } = await requireView(projectId);
  const baselines = await db.budgetBaseline.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, createdAt: true, total: true } });
  const baseline = baselineId ? baselines.find((b) => b.id === baselineId) : baselines[0];
  const [metrics, rawLines, items, expenses, baselineLines, progress] = await Promise.all([
    loadMetrics(projectId),
    loadLines(projectId),
    db.costItem.findMany({ where: { projectId }, select: { id: true, code: true, name: true, parentId: true, unit: true } }),
    db.expense.findMany({
      where: { projectId, deletedAt: null, approvalStatus: "APPROVED", kind: { in: [...COST_KINDS] } },
      select: { costItemId: true, netAmountTry: true, quantity: true, unit: true },
    }),
    baseline ? db.budgetBaselineLine.findMany({ where: { baselineId: baseline.id }, select: { costItemId: true, amount: true } }) : [],
    db.costItemProgress.findMany({ where: { projectId } }),
  ]);
  const lines = await computeLines(rawLines, metrics);

  // Kalemin kendi değerleri
  type Own = { budget: Decimal; qty: Decimal; unit: string | null; mixed: boolean; actual: Decimal; actualQty: Decimal; baseline: Decimal | null };
  const own = new Map<string, Own>();
  const get = (id: string) => own.get(id) ?? own.set(id, { budget: zero(), qty: zero(), unit: null, mixed: false, actual: zero(), actualQty: zero(), baseline: null }).get(id)!;
  for (const l of lines) {
    const o = get(l.costItemId);
    o.budget = o.budget.plus(l.amount);
    o.qty = o.qty.plus(l.quantityLive);
    if (o.unit === null) o.unit = l.unit;
    else if (normUnit(o.unit) !== normUnit(l.unit)) o.mixed = true;
  }
  for (const e of expenses) {
    if (!e.costItemId) continue;
    const o = get(e.costItemId);
    o.actual = o.actual.plus(dec(e.netAmountTry));
    if (e.quantity && o.unit && normUnit(e.unit) === normUnit(o.unit)) o.actualQty = o.actualQty.plus(dec(e.quantity));
  }
  for (const b of baselineLines) {
    const o = get(b.costItemId);
    o.baseline = (o.baseline ?? zero()).plus(dec(b.amount));
  }
  const progressById = new Map(progress.map((p) => [p.costItemId, p]));
  const parentIds = new Set(items.map((i) => i.parentId).filter(Boolean));

  // Yaprak hesap: kendi değerleriyle; üst kalemler alt kalemlerin toplamı (+ kendi değerleri)
  const ownControls = new Map<string, ItemControl>();
  for (const i of items) {
    const o = own.get(i.id);
    if (!o) continue;
    const qtyUsable = !o.mixed && o.qty.gt(0) && o.unit;
    ownControls.set(
      i.id,
      itemControl({
        baseline: baseline ? (o.baseline ?? zero()) : null,
        budget: o.budget,
        budgetQuantity: qtyUsable ? o.qty : null,
        actualQuantity: qtyUsable ? o.actualQty : null,
        actual: o.actual,
        manualPercent: progressById.get(i.id) ? dec(progressById.get(i.id)!.percent) : null,
      }),
    );
  }
  const children = new Map<string, string[]>();
  for (const i of items) if (i.parentId) (children.get(i.parentId) ?? children.set(i.parentId, []).get(i.parentId)!).push(i.id);
  type Sum = { baseline: Decimal; budget: Decimal; actual: Decimal; eac: Decimal; earned: Decimal; has: boolean };
  const sums = new Map<string, Sum>();
  const sumOf = (id: string): Sum => {
    const cached = sums.get(id);
    if (cached) return cached;
    const o = own.get(id);
    const c = ownControls.get(id);
    const s: Sum = {
      baseline: o?.baseline ?? zero(),
      budget: o?.budget ?? zero(),
      actual: o?.actual ?? zero(),
      eac: c?.eac ?? zero(),
      earned: c?.earned ?? zero(),
      has: Boolean(o && (o.budget.gt(0) || o.actual.gt(0) || o.baseline?.gt(0))),
    };
    for (const child of children.get(id) ?? []) {
      const cs = sumOf(child);
      s.baseline = s.baseline.plus(cs.baseline);
      s.budget = s.budget.plus(cs.budget);
      s.actual = s.actual.plus(cs.actual);
      s.eac = s.eac.plus(cs.eac);
      s.earned = s.earned.plus(cs.earned);
      s.has ||= cs.has;
    }
    sums.set(id, s);
    return s;
  };

  const rows: ControlRow[] = items
    .map((i) => {
      const o = own.get(i.id);
      const leaf = !parentIds.has(i.id);
      const s = sumOf(i.id);
      const qtyUsable = Boolean(o && !o.mixed && o.qty.gt(0) && o.unit);
      const control: ItemControl = leaf
        ? (ownControls.get(i.id) ?? itemControl({ baseline: baseline ? zero() : null, budget: zero(), budgetQuantity: null, actualQuantity: null, actual: zero(), manualPercent: null }))
        : (() => {
            const reference = baseline ? s.baseline : s.budget;
            const status: ItemControl["status"] =
              reference.isZero() && s.actual.gt(0) ? "unbudgeted" : s.actual.gt(reference) ? "over" : s.eac.gt(reference.times("1.05")) ? "risk" : "ok";
            return {
              reference,
              percent: s.budget.gt(0) ? s.earned.div(s.budget).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP) : null,
              percentSource: null,
              earned: s.earned,
              eac: s.eac,
              variance: reference.minus(s.eac),
              status,
            };
          })();
      return {
        id: i.id,
        code: i.code,
        name: i.name,
        parentId: i.parentId,
        depth: i.code.split(".").length - 1,
        unit: qtyUsable ? o!.unit : null,
        baseline: baseline ? s.baseline : null,
        budget: s.budget,
        budgetQuantity: leaf && qtyUsable ? o!.qty : null,
        actual: s.actual,
        actualQuantity: leaf && qtyUsable ? o!.actualQty : null,
        manualPercent: progressById.get(i.id) ? dec(progressById.get(i.id)!.percent) : null,
        progressNote: progressById.get(i.id)?.note ?? null,
        control,
        hasData: s.has,
        isLeaf: leaf,
      };
    })
    .sort((a, b) => compareCodes(a.code, b.code));

  // Proje toplamı yalnızca kalemlerin kendi değerlerinden (çift sayım olmasın)
  const totals = controlTotals(
    items.flatMap((i) => {
      const o = own.get(i.id);
      const c = ownControls.get(i.id);
      return o && c ? [{ baseline: baseline ? (o.baseline ?? zero()) : null, budget: o.budget, actual: o.actual, control: c }] : [];
    }),
  );
  const constructionEac = items
    .filter((i) => (CONSTRUCTION_GROUPS as readonly string[]).includes(topCode(i.code)))
    .reduce((s, i) => s.plus(ownControls.get(i.id)?.eac ?? zero()), zero());
  const per = (amount: Decimal, area: Decimal) => (area.gt(0) ? amount.div(area).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null);

  return {
    canEdit: hasCapability(role, "budget.edit"),
    baselines,
    baseline: baseline ?? null,
    rows,
    totals,
    m2: {
      referenceContractor: per(totals.reference, metrics.contractorGross),
      eacContractor: per(totals.eac, metrics.contractorGross),
      eacConstruction: per(constructionEac, metrics.constructionArea),
    },
    metrics,
    coverage: await projectCoverage(projectId, lines.map((l) => ({ code: l.costItem.code, name: l.costItem.name, unit: l.unit, quantity: l.quantityLive }))),
    gains: await projectGains(projectId),
  };
}

/** Bütçe ihtiyacı (kalem kodu + birim) ↔ projeye tahsis edilen bağlantı miktarı. */
async function projectCoverage(projectId: string, needs: { code: string; name: string; unit: string | null; quantity: Decimal }[]) {
  const allocations = await db.connectionAllocation.findMany({
    where: { projectId, item: { connection: { status: { in: ["ACTIVE", "COMPLETED"] } } } },
    include: { item: { select: { id: true, costItemCode: true, unit: true, description: true } } },
  });
  const draws = await db.expense.groupBy({
    by: ["connectionItemId"],
    where: { projectId, kind: "DELIVERY", deletedAt: null, approvalStatus: { not: "REJECTED" }, connectionItemId: { in: allocations.map((a) => a.itemId) } },
    _sum: { quantity: true },
  });
  const drawn = new Map(draws.map((d) => [d.connectionItemId, dec(d._sum.quantity)]));
  const coveredKeys = new Set(allocations.map((a) => `${a.item.costItemCode}|${normUnit(a.item.unit)}`));
  const names = new Map(needs.map((n) => [n.code, n.name]));
  return coverage(
    // Yalnızca bağlantı konusu olabilecek (birimli) ihtiyaçlar; bağlantısı olan kodlar her zaman görünür.
    needs
      .filter((n) => n.unit && (coveredKeys.has(`${n.code}|${normUnit(n.unit)}`) || ["05", "06", "07", "08"].includes(topCode(n.code))))
      .map((n) => ({ key: `${n.code}|${normUnit(n.unit)}`, label: `${n.code} ${n.name}`, unit: n.unit!, quantity: n.quantity })),
    allocations.map((a) => ({
      key: `${a.item.costItemCode}|${normUnit(a.item.unit)}`,
      label: `${a.item.costItemCode} ${names.get(a.item.costItemCode) ?? a.item.description}`,
      unit: a.item.unit,
      allocated: dec(a.quantity),
      drawn: drawn.get(a.itemId) ?? zero(),
    })),
  ).sort((a, b) => compareCodes(a.key.split("|")[0], b.key.split("|")[0]));
}

/** Projeye tahsis edilen bağlantı kalemlerinin kazancı (kütüphane malzemesi bağlıysa). */
async function projectGains(projectId: string) {
  const allocations = await db.connectionAllocation.findMany({
    where: { projectId, item: { resourceId: { not: null }, connection: { status: { in: ["ACTIVE", "COMPLETED"] } } } },
    include: { item: { include: { connection: { select: { id: true, no: true, currency: true, supplier: { select: { name: true } } } } } } },
  });
  return gainRows(allocations.map((a) => ({ item: a.item, quantity: dec(a.quantity) })));
}

/** Şirket geneli bağlantı kazancı raporu (bağlantı ekranı). */
export async function connectionGains(connectionId: string) {
  const items = await db.connectionItem.findMany({
    where: { connectionId, resourceId: { not: null } },
    include: { connection: { select: { id: true, no: true, currency: true, supplier: { select: { name: true } } } } },
  });
  return gainRows(items.map((item) => ({ item, quantity: dec(item.quantity) })));
}

async function gainRows(
  rows: { item: { id: string; description: string; unit: string; unitPrice: { toString(): string }; resourceId: string | null; connection: { id: string; no: string; currency: "TRY" | "USD" | "EUR" | "GBP"; supplier: { name: string } } }; quantity: Decimal }[],
) {
  const [book, rates] = await Promise.all([priceBook([...new Set(rows.map((r) => r.item.resourceId!))], { excludeConnection: true }), latestRates()]);
  return rows.map(({ item, quantity }) => {
    const market = book.get(item.resourceId!);
    const connectionPriceTry = toTry(dec(item.unitPrice), item.connection.currency, rates);
    const gain = market?.priceTry && connectionPriceTry ? connectionGain(connectionPriceTry, market.priceTry, quantity) : null;
    return {
      itemId: item.id,
      connectionId: item.connection.id,
      connectionNo: item.connection.no,
      supplier: item.connection.supplier.name,
      description: item.description,
      unit: item.unit,
      quantity,
      connectionPriceTry,
      marketPriceTry: market?.priceTry ?? null,
      marketSource: market?.candidate?.kind ?? null,
      marketDate: market?.candidate?.date ?? null,
      gain,
    };
  });
}

// ---------------------------------------------------------------------------
// Baz bütçe ve elle ilerleme
// ---------------------------------------------------------------------------

/** Güncel bütçeyi (o anki fiyat ve miktarlarla) baz bütçe olarak dondurur. */
export async function createBaseline(projectId: string, name: string, note: string | null) {
  const { user } = await requireProjectCapability(projectId, "budget.edit");
  const metrics = await loadMetrics(projectId);
  const lines = await computeLines(await loadLines(projectId), metrics);
  if (lines.length === 0) throw new ActionError("Bütçede satır yok; önce bütçe girin.");
  const total = lines.reduce((s, l) => s.plus(l.amount), zero());
  return db.$transaction(async (tx) => {
    const created = await tx.budgetBaseline.create({
      data: {
        projectId,
        name,
        note,
        total,
        createdById: user.id,
        lines: {
          create: lines.map((l) => ({
            costItemId: l.costItemId,
            blockId: l.blockId,
            description: l.description,
            quantity: l.quantityLive,
            unit: l.unit,
            unitPriceTry: l.unitPriceTry,
            amount: l.amount,
          })),
        },
      },
    });
    await writeAudit(tx, { userId: user.id, projectId, action: "create", entity: "BudgetBaseline", entityId: created.id, changes: { name, total: total.toString(), lines: lines.length } });
    return created.id;
  });
}

export async function deleteBaseline(projectId: string, baselineId: string) {
  const { user } = await requireProjectCapability(projectId, "budget.edit");
  await db.$transaction(async (tx) => {
    const removed = await tx.budgetBaseline.delete({ where: { id: baselineId, projectId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "BudgetBaseline", entityId: baselineId, changes: { name: removed.name } });
  });
}

/** Elle tamamlanma yüzdesi; boş bırakılırsa silinir (miktardan hesaplanana döner). */
export async function setItemProgress(projectId: string, costItemId: string, percent: Decimal | null, note: string | null) {
  const { user } = await requireProjectCapability(projectId, "budget.edit");
  if (!(await db.costItem.count({ where: { id: costItemId, projectId } }))) throw new ActionError("Kalem bu projede yok.");
  await db.$transaction(async (tx) => {
    if (percent == null) await tx.costItemProgress.deleteMany({ where: { projectId, costItemId } });
    else {
      await tx.costItemProgress.upsert({
        where: { projectId_costItemId: { projectId, costItemId } },
        create: { projectId, costItemId, percent, note, updatedById: user.id },
        update: { percent, note, updatedById: user.id },
      });
    }
    await writeAudit(tx, { userId: user.id, projectId, action: "progress", entity: "CostItemProgress", entityId: costItemId, changes: { percent: percent?.toString() ?? null } });
  });
}

/** Portföy kartları: proje başına EAC, sapma ve ilerleme. */
export async function controlSummaries(projectIds: string[]) {
  const result = new Map<string, { eac: Decimal; variance: Decimal; progress: Decimal | null; reference: Decimal }>();
  for (const projectId of projectIds) {
    const data = await getBudgetControl(projectId, null);
    if (data.totals.budget.gt(0) || data.totals.actual.gt(0)) {
      result.set(projectId, { eac: data.totals.eac, variance: data.totals.variance, progress: data.totals.progress, reference: data.totals.reference });
    }
  }
  return result;
}
