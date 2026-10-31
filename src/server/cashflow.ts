import "server-only";
import Decimal from "decimal.js";
import type { Role } from "@/generated/prisma/enums";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { topCode } from "@/lib/budget/budget";
import { toTry } from "@/lib/budget/pricing";
import {
  BASE_SCENARIO,
  buildCashFlow,
  consolidate,
  landownerEffect,
  monthIndex,
  proposeSchedule,
  resolveSchedule,
  scenarioOutcome,
  tornado,
  type Assumptions,
  type CashEvent,
  type PlannedItem,
  type ProfitInput,
  type ScenarioSpec,
} from "@/lib/cashflow/cashflow";
import { compareCodes } from "@/lib/cost-tree/tree";
import { allocateCollections, isCounted } from "@/lib/sales/sales";
import { ActionError, getAccess, requireGlobalCapability, requireProjectAccess, requireProjectCapability } from "./access";
import { diffFields, writeAudit } from "./audit";
import { computeLines, loadLines } from "./budget";
import { getBudgetControl } from "./control";
import { db } from "./db";
import { latestRates } from "./library";

// Nakit akışı, iş programı ve senaryolar (PLAN.md 7.8, 7.9, Faz 7). Tutarlar KDV dahil gerçek nakittir;
// kâr ve maliyet özetleri KDV hariç.

const zero = () => new Decimal(0);
const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);
const decOrNull = (value: { toString(): string } | null | undefined) => (value == null ? null : new Decimal(value.toString()));
const DEFAULT_DURATION = 24;

async function requireView(projectId: string) {
  const access = await requireProjectAccess(projectId);
  if (!hasCapability(access.role, "cashflow.view")) throw new ActionError("Nakit akışını görme yetkiniz yok.");
  return access;
}

/** Projenin takvimi: başlangıç ayı, süre ve bu ay (mutlak ay sayısı). */
async function projectCalendar(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true, startDate: true, durationMonths: true } });
  const now = new Date();
  const currentMonth = monthIndex(now);
  const startMonth = project.startDate ? monthIndex(project.startDate) : currentMonth;
  const duration = project.durationMonths && project.durationMonths > 0 ? project.durationMonths : DEFAULT_DURATION;
  const warnings: string[] = [];
  if (!project.startDate) warnings.push("Proje başlangıç tarihi yok; bu ay başlangıç kabul edildi. Proje bilgilerinden girin.");
  if (!project.durationMonths) warnings.push(`Proje süresi yok; ${DEFAULT_DURATION} ay kabul edildi. Proje bilgilerinden girin.`);
  return { name: project.name, startMonth, duration, endMonth: startMonth + duration - 1, currentMonth, warnings };
}

async function loadSettings(projectId: string) {
  const [s, vatParams] = await Promise.all([
    db.cashFlowSetting.findUnique({ where: { projectId } }),
    db.parameter.findMany({ where: { kind: "kdv_orani", municipality: null }, orderBy: [{ year: "desc" }, { value: "desc" }], take: 1 }),
  ]);
  const defaultVat = vatParams[0] ? dec(vatParams[0].value) : null;
  return {
    openingCash: dec(s?.openingCash),
    costVatPercent: decOrNull(s?.costVatPercent),
    defaultVat,
    monthlyInflationPercent: dec(s?.monthlyInflationPercent),
    fxChangePercent: dec(s?.fxChangePercent),
    monthlyInterestPercent: dec(s?.monthlyInterestPercent),
    salesPerMonth: dec(s?.salesPerMonth),
    salesStartMonth: s?.salesStartMonth ?? null,
    downPaymentPercent: s ? dec(s.downPaymentPercent) : new Decimal(100),
    installmentMonths: s?.installmentMonths ?? 0,
    updatedAt: s?.updatedAt ?? null,
  };
}

export type CashSettings = Awaited<ReturnType<typeof loadSettings>>;

/** Projenin bağlantı payı: tahsis edilen miktarın bağlantı toplamındaki değer oranı. */
async function connectionShares(projectId: string | null) {
  const connections = await db.connection.findMany({
    where: { status: { not: "CANCELLED" } },
    include: { items: { include: { allocations: true } }, payments: true },
  });
  return connections.map((c) => {
    const total = c.items.reduce((s, i) => s.plus(dec(i.quantity).times(dec(i.unitPrice))), zero());
    const allocated = (pid: string | null) =>
      c.items.reduce((s, i) => s.plus(i.allocations.filter((a) => (pid ? a.projectId === pid : true)).reduce((x, a) => x.plus(dec(a.quantity)), zero()).times(dec(i.unitPrice))), zero());
    const share = total.gt(0) ? (projectId ? allocated(projectId).div(total) : new Decimal(1).minus(allocated(null).div(total))) : zero();
    return { connection: c, share: Decimal.max(share, 0) };
  });
}

const paymentEvents = (shares: Awaited<ReturnType<typeof connectionShares>>): CashEvent[] =>
  shares.flatMap(({ connection: c, share }) =>
    share.gt(0)
      ? c.payments.map((p) => ({
          month: monthIndex(p.paymentStatus === "PAID" ? (p.paidAt ?? p.dueDate) : p.dueDate),
          amount: dec(p.amountTry).times(share),
          kind: "connection" as const,
          done: p.paymentStatus === "PAID",
          foreign: c.currency !== "TRY",
        }))
      : [],
  );

/** Nakit akışı girdileri: gerçekleşen / taahhüt edilen hareketler, kalan maliyet, satış ve kâr girdileri. */
async function cashInputs(projectId: string) {
  const cal = await projectCalendar(projectId);
  const settings = await loadSettings(projectId);
  const today = new Date();
  const [expenses, billings, shares, contracts, units, control, rawLines, scheduleEntries, items, pricing, allocations, draws, rates] = await Promise.all([
    db.expense.findMany({
      where: { projectId, deletedAt: null, kind: { in: ["EXPENSE", "ADVANCE"] }, approvalStatus: { not: "REJECTED" } },
      select: { date: true, dueDate: true, paidAt: true, paymentStatus: true, totalAmountTry: true, currency: true },
    }),
    db.progressBilling.findMany({ where: { projectId, status: "APPROVED" }, select: { date: true, dueDate: true, paidAt: true, paymentStatus: true, payableAmount: true } }),
    connectionShares(projectId),
    db.saleContract.findMany({ where: { projectId, status: "ACTIVE" }, include: { installments: true, collections: true, unit: { select: { grossArea: true } } } }),
    db.unit.findMany({ where: { projectId }, select: { id: true, owner: true, grossArea: true, listPrice: true, listVatRate: true } }),
    getBudgetControl(projectId, null),
    loadLines(projectId),
    db.scheduleEntry.findMany({ where: { projectId } }),
    db.costItem.findMany({ where: { projectId }, select: { id: true, code: true, name: true, parentId: true } }),
    db.pricingSetting.findUnique({ where: { projectId } }),
    db.connectionAllocation.findMany({ where: { projectId }, include: { item: { include: { connection: { select: { currency: true, status: true } } } } } }),
    db.expense.groupBy({ by: ["connectionItemId"], where: { projectId, deletedAt: null, kind: "DELIVERY", approvalStatus: { not: "REJECTED" } }, _sum: { quantity: true } }),
    latestRates(),
  ]);
  const warnings = [...cal.warnings];

  // Gerçekleşen ve taahhüt edilen çıkışlar
  const events: CashEvent[] = [
    ...expenses.map((e) => ({
      month: monthIndex(e.paymentStatus === "PAID" ? (e.paidAt ?? e.date) : (e.dueDate ?? e.date)),
      amount: dec(e.totalAmountTry),
      kind: "expense" as const,
      done: e.paymentStatus === "PAID",
      foreign: e.currency !== "TRY",
    })),
    ...billings.map((b) => ({ month: monthIndex(b.paymentStatus === "PAID" ? (b.paidAt ?? b.date) : (b.dueDate ?? b.date)), amount: dec(b.payableAmount), kind: "progress" as const, done: b.paymentStatus === "PAID" })),
    ...paymentEvents(shares),
  ];

  // Satışlar: tahsil edilenler, portföydeki çek / senetler, kalan taksitler
  for (const c of contracts) {
    const rate = dec(c.exchangeRate);
    const foreign = c.currency !== "TRY";
    for (const x of c.collections) {
      if (isCounted(x)) events.push({ month: monthIndex(x.date), amount: dec(x.amountTry), kind: "collection", done: true });
      else if (x.chequeStatus === "PENDING") events.push({ month: monthIndex(x.chequeDueDate ?? x.date), amount: dec(x.amount).times(rate), kind: "cheque", done: false, foreign });
    }
    const counted = c.collections.filter(isCounted).reduce((s, x) => s.plus(dec(x.amount)), zero());
    const paper = c.collections.filter((x) => x.chequeStatus === "PENDING").reduce((s, x) => s.plus(dec(x.amount)), zero());
    const alloc = allocateCollections(c.installments.map((i) => ({ dueDate: i.dueDate, amount: dec(i.amount), kind: i.kind })), counted, today, paper);
    for (const r of alloc.rows) {
      const open = r.remaining.minus(r.paper);
      const shiftOnDelay = r.kind === "KEY_DELIVERY" || r.kind === "BANK_LOAN";
      if (open.gt(0)) events.push({ month: monthIndex(r.dueDate), amount: open.times(rate), kind: "installment", done: false, foreign, shiftOnDelay });
    }
  }

  // Bağlantıyla sabitlenmiş açık miktar (tahsis − çekilen) × bağlantı fiyatı, kalem koduna göre
  const drawnByItem = new Map(draws.map((d) => [d.connectionItemId, dec(d._sum.quantity)]));
  const connectionOpenByCode = new Map<string, Decimal>();
  for (const a of allocations) {
    if (a.item.connection.status === "CANCELLED") continue;
    const open = Decimal.max(dec(a.quantity).minus(drawnByItem.get(a.itemId) ?? 0), 0);
    const price = toTry(dec(a.item.unitPrice), a.item.connection.currency, rates);
    if (!price || open.isZero()) continue;
    connectionOpenByCode.set(a.item.costItemCode, (connectionOpenByCode.get(a.item.costItemCode) ?? zero()).plus(open.times(price)));
  }

  // Kalan maliyet: kalemin kendi EAC − gerçekleşeni (alt kalemler ayrı), bağlantıyla karşılanan kısım düşülür
  const lines = await computeLines(rawLines, control.metrics);
  const foreignByItem = new Map<string, Decimal>();
  const budgetByItem = new Map<string, Decimal>();
  for (const l of lines) {
    budgetByItem.set(l.costItemId, (budgetByItem.get(l.costItemId) ?? zero()).plus(l.amount));
    if (l.priceSource === "MANUAL" && l.currency !== "TRY") foreignByItem.set(l.costItemId, (foreignByItem.get(l.costItemId) ?? zero()).plus(l.amount));
  }
  const rowById = new Map(control.rows.map((r) => [r.id, r]));
  const childrenOf = new Map<string, string[]>();
  for (const r of control.rows) if (r.parentId) (childrenOf.get(r.parentId) ?? childrenOf.set(r.parentId, []).get(r.parentId)!).push(r.id);
  const parentOf = new Map(items.map((i) => [i.id, i.parentId]));
  const entryMap = new Map(scheduleEntries.map((e) => [e.costItemId, { startMonth: e.startMonth, endMonth: e.endMonth }]));
  const planned: PlannedItem[] = [];
  let connectionOpenNet = zero();
  for (const r of control.rows) {
    const kids = childrenOf.get(r.id) ?? [];
    const ownEac = kids.reduce((s, k) => s.minus(rowById.get(k)!.control.eac), r.control.eac);
    const ownActual = kids.reduce((s, k) => s.minus(rowById.get(k)!.actual), r.actual);
    let remaining = Decimal.max(ownEac.minus(ownActual), 0);
    if (remaining.isZero()) continue;
    const covered = Decimal.min(connectionOpenByCode.get(r.code) ?? zero(), remaining);
    connectionOpenNet = connectionOpenNet.plus(covered);
    remaining = remaining.minus(covered);
    if (remaining.isZero()) continue;
    const sched = resolveSchedule(r.id, parentOf, entryMap, cal.duration);
    const budget = budgetByItem.get(r.id) ?? zero();
    planned.push({
      code: r.code,
      name: r.name,
      remainingNet: remaining,
      startMonth: cal.startMonth + sched.startMonth - 1,
      endMonth: cal.startMonth + sched.endMonth - 1,
      foreignShare: budget.gt(0) ? (foreignByItem.get(r.id) ?? zero()).div(budget) : zero(),
      timeRelated: topCode(r.code) === "03" || r.code === "01.03" || r.code.startsWith("01.03."),
    });
  }
  if (control.rows.some((r) => r.depth === 0 && r.code === "13" && r.budget.gt(0))) {
    warnings.push("Bütçede 13 finansman kalemi var; nakit açığından hesaplanan finansman maliyetiyle çift sayılabilir.");
  }

  // Satılmamış bölümler
  const soldUnitIds = new Set(contracts.map((c) => c.unitId));
  const unsold = units.filter((u) => u.owner === "CONTRACTOR" && !soldUnitIds.has(u.id));
  const priced = unsold.filter((u) => u.listPrice != null);
  if (priced.length < unsold.length) warnings.push(`${unsold.length - priced.length} satılmamış bölümün liste fiyatı yok; satış varsayımına katılmadı.`);
  if (priced.length && settings.salesPerMonth.isZero()) warnings.push("Satış hızı girilmedi; satılmamış bölümlerden gelir varsayılmadı.");
  const sales = priced.length
    ? {
        unsoldCount: priced.length,
        unsoldWithVat: priced.reduce((s, u) => s.plus(dec(u.listPrice).times(dec(u.listVatRate).div(100).plus(1))), zero()),
        unsoldNet: priced.reduce((s, u) => s.plus(dec(u.listPrice)), zero()),
        perMonth: settings.salesPerMonth,
        startMonth: cal.startMonth + (settings.salesStartMonth ?? Math.max(1, cal.currentMonth - cal.startMonth + 1)) - 1,
        downPaymentPercent: settings.downPaymentPercent,
        installmentMonths: settings.installmentMonths,
      }
    : null;

  const vatPercent = settings.costVatPercent ?? settings.defaultVat ?? zero();
  if (!settings.costVatPercent && !settings.defaultVat) warnings.push("KDV oranı bulunamadı; planlanan maliyete KDV eklenmedi.");
  const assumptions: Assumptions = {
    openingCash: settings.openingCash,
    vatPercent,
    inflationPercent: settings.monthlyInflationPercent,
    fxPercent: settings.fxChangePercent,
    interestPercent: settings.monthlyInterestPercent,
  };
  const profit: ProfitInput = {
    actualCost: control.totals.actual,
    connectionOpenNet,
    soldNet: contracts.reduce((s, c) => s.plus(dec(c.salePriceTry)), zero()),
    soldGross: contracts.reduce((s, c) => s.plus(dec(c.unit.grossArea)), zero()),
    sellableGross: control.metrics.sellableGross,
    contractorGross: control.metrics.contractorGross,
    commissionPercent: dec(pricing?.commissionPercent),
    profitMethod: pricing?.profitMethod ?? "MARGIN",
    profitPercent: dec(pricing?.profitPercent),
  };
  const names = new Map(items.map((i) => [i.code, i.name]));
  return { cal, settings, events, planned, sales, assumptions, profit, names, warnings, eacTotal: control.totals.eac };
}

type Inputs = Awaited<ReturnType<typeof cashInputs>>;

function run(inputs: Inputs, spec: ScenarioSpec = BASE_SCENARIO, overrides: Partial<Assumptions> = {}, landownerShare: Decimal | null = null) {
  const effect = landownerEffect(inputs.profit, landownerShare);
  const flow = buildCashFlow({
    currentMonth: inputs.cal.currentMonth,
    startMonth: inputs.cal.startMonth,
    endMonth: inputs.cal.endMonth,
    events: inputs.events,
    planned: inputs.planned,
    sales: inputs.sales,
    assumptions: { ...inputs.assumptions, ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v != null)) },
    scenario: { ...spec, unsoldAreaFactor: effect.unsoldAreaFactor },
  });
  return { flow, outcome: scenarioOutcome(flow, inputs.profit, effect.contractorGross) };
}

export async function getCashFlow(projectId: string) {
  const { role } = await requireView(projectId);
  const inputs = await cashInputs(projectId);
  const { flow, outcome } = run(inputs);
  return { ...inputs, flow, outcome, canEdit: hasCapability(role, "cashflow.edit") };
}

export async function saveCashSettings(
  projectId: string,
  data: {
    openingCash: Decimal;
    costVatPercent: Decimal | null;
    monthlyInflationPercent: Decimal;
    fxChangePercent: Decimal;
    monthlyInterestPercent: Decimal;
    salesPerMonth: Decimal;
    salesStartMonth: number | null;
    downPaymentPercent: Decimal;
    installmentMonths: number;
  },
) {
  const { user } = await requireProjectCapability(projectId, "cashflow.edit");
  await db.$transaction(async (tx) => {
    const before = await tx.cashFlowSetting.findUnique({ where: { projectId } });
    await tx.cashFlowSetting.upsert({ where: { projectId }, create: { projectId, ...data, updatedById: user.id }, update: { ...data, updatedById: user.id } });
    await writeAudit(tx, { userId: user.id, projectId, action: before ? "update" : "create", entity: "CashFlowSetting", entityId: projectId, changes: diffFields(before ?? {}, data) });
  });
}

// ---------------------------------------------------------------------------
// İş programı
// ---------------------------------------------------------------------------

export async function getSchedule(projectId: string) {
  const { role } = await requireView(projectId);
  const cal = await projectCalendar(projectId);
  const [items, entries, control] = await Promise.all([
    db.costItem.findMany({ where: { projectId, active: true }, select: { id: true, code: true, name: true, parentId: true } }),
    db.scheduleEntry.findMany({ where: { projectId } }),
    getBudgetControl(projectId, null),
  ]);
  const entryMap = new Map(entries.map((e) => [e.costItemId, { startMonth: e.startMonth, endMonth: e.endMonth }]));
  const parentOf = new Map(items.map((i) => [i.id, i.parentId]));
  const rowById = new Map(control.rows.map((r) => [r.id, r]));
  // Üst gruplar her zaman; alt kalemler programı varsa veya bütçesi varsa
  const visible = items
    .filter((i) => !i.parentId || entryMap.has(i.id) || (rowById.get(i.id)?.budget.gt(0) && i.code.split(".").length === 2))
    .sort((a, b) => compareCodes(a.code, b.code));
  return {
    cal,
    canEdit: hasCapability(role, "cashflow.edit"),
    rows: visible.map((i) => {
      const r = rowById.get(i.id);
      return { id: i.id, code: i.code, name: i.name, depth: i.code.split(".").length - 1, budget: r?.budget ?? zero(), eac: r?.control.eac ?? zero(), actual: r?.actual ?? zero(), schedule: resolveSchedule(i.id, parentOf, entryMap, cal.duration) };
    }),
  };
}

export async function saveScheduleEntry(projectId: string, costItemId: string, range: { startMonth: number; endMonth: number } | null) {
  const { user } = await requireProjectCapability(projectId, "cashflow.edit");
  if (range && range.endMonth < range.startMonth) throw new ActionError("Bitiş ayı başlangıçtan önce olamaz.");
  if (!(await db.costItem.count({ where: { id: costItemId, projectId } }))) throw new ActionError("Kalem bu projede yok.");
  await db.$transaction(async (tx) => {
    if (!range) await tx.scheduleEntry.deleteMany({ where: { projectId, costItemId } });
    else await tx.scheduleEntry.upsert({ where: { projectId_costItemId: { projectId, costItemId } }, create: { projectId, costItemId, ...range }, update: range });
    await writeAudit(tx, { userId: user.id, projectId, action: "schedule", entity: "ScheduleEntry", entityId: costItemId, changes: range ?? { removed: true } });
  });
}

/** Programı olmayan üst gruplara süreye göre varsayılan aralık önerir (PLAN 7.8; başlangıç varsayımı). */
export async function applyDefaultSchedule(projectId: string) {
  const { user } = await requireProjectCapability(projectId, "cashflow.edit");
  const cal = await projectCalendar(projectId);
  const [groups, entries] = await Promise.all([
    db.costItem.findMany({ where: { projectId, parentId: null }, select: { id: true, code: true } }),
    db.scheduleEntry.findMany({ where: { projectId }, select: { costItemId: true } }),
  ]);
  const has = new Set(entries.map((e) => e.costItemId));
  const data = groups.flatMap((g) => {
    const range = has.has(g.id) ? null : proposeSchedule(g.code, cal.duration);
    return range ? [{ projectId, costItemId: g.id, ...range }] : [];
  });
  await db.$transaction(async (tx) => {
    await tx.scheduleEntry.createMany({ data });
    await writeAudit(tx, { userId: user.id, projectId, action: "defaultSchedule", entity: "ScheduleEntry", changes: { count: data.length, duration: cal.duration } });
  });
  return data.length;
}

// ---------------------------------------------------------------------------
// Senaryolar ve duyarlılık
// ---------------------------------------------------------------------------

type ScenarioRow = Awaited<ReturnType<typeof loadScenarios>>[number];
const loadScenarios = (projectId: string) => db.scenario.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, include: { adjustments: { orderBy: { costItemCode: "asc" } } } });

function specOf(s: ScenarioRow): { spec: ScenarioSpec; overrides: Partial<Assumptions>; landowner: Decimal | null } {
  return {
    spec: {
      adjustments: s.adjustments.map((a) => ({ code: a.costItemCode, percent: dec(a.changePercent) })),
      delayMonths: s.delayMonths,
      salesPriceChangePercent: dec(s.salesPriceChangePercent),
      salesSpeedPercent: dec(s.salesSpeedPercent),
      unsoldAreaFactor: new Decimal(1),
    },
    overrides: {
      inflationPercent: decOrNull(s.monthlyInflationPercent) ?? undefined,
      fxPercent: decOrNull(s.fxChangePercent) ?? undefined,
      interestPercent: decOrNull(s.monthlyInterestPercent) ?? undefined,
    },
    landowner: decOrNull(s.landownerSharePercent),
  };
}

export async function getScenarios(projectId: string) {
  const { role } = await requireView(projectId);
  const [inputs, scenarios] = await Promise.all([cashInputs(projectId), loadScenarios(projectId)]);
  const base = run(inputs);
  // PLAN 7.9'daki duyarlılık örnekleri
  const sensitivities = [
    { key: "steel", label: "Demir %15 artarsa (05.05)", r: run(inputs, { ...BASE_SCENARIO, adjustments: [{ code: "05.05", percent: new Decimal(15) }] }) },
    { key: "fx", label: "Döviz %20 artarsa", r: run(inputs, BASE_SCENARIO, { fxPercent: inputs.assumptions.fxPercent.plus(20) }) },
    { key: "delay", label: "İnşaat 3 ay uzarsa", r: run(inputs, { ...BASE_SCENARIO, delayMonths: 3 }) },
    { key: "land", label: "Arsa payı %50 olursa", r: run(inputs, BASE_SCENARIO, {}, new Decimal(50)) },
  ];
  return {
    canManage: hasCapability(role, "scenario.manage"),
    assumptions: inputs.assumptions,
    warnings: inputs.warnings,
    base: base.outcome,
    sensitivities: sensitivities.map((x) => ({ key: x.key, label: x.label, outcome: x.r.outcome })),
    scenarios: scenarios.map((s) => {
      const { spec, overrides, landowner } = specOf(s);
      return { scenario: s, outcome: run(inputs, spec, overrides, landowner).outcome };
    }),
    tornado: tornado(base.flow, inputs.names),
  };
}

export type ScenarioData = {
  name: string;
  note: string | null;
  monthlyInflationPercent: Decimal | null;
  fxChangePercent: Decimal | null;
  monthlyInterestPercent: Decimal | null;
  delayMonths: number;
  salesPriceChangePercent: Decimal;
  salesSpeedPercent: Decimal;
  landownerSharePercent: Decimal | null;
  adjustments: { costItemCode: string; changePercent: Decimal }[];
};

export async function saveScenario(projectId: string, scenarioId: string | null, data: ScenarioData) {
  const { user } = await requireProjectCapability(projectId, "scenario.manage");
  const { adjustments, ...fields } = data;
  return db.$transaction(async (tx) => {
    let id = scenarioId;
    if (id) {
      await tx.scenario.update({ where: { id, projectId }, data: fields });
      await tx.scenarioAdjustment.deleteMany({ where: { scenarioId: id } });
    } else {
      id = (await tx.scenario.create({ data: { projectId, ...fields } })).id;
    }
    if (adjustments.length) await tx.scenarioAdjustment.createMany({ data: adjustments.map((a) => ({ scenarioId: id!, ...a })) });
    await writeAudit(tx, { userId: user.id, projectId, action: scenarioId ? "update" : "create", entity: "Scenario", entityId: id, changes: { name: data.name } });
    return id;
  });
}

export async function deleteScenario(projectId: string, scenarioId: string) {
  const { user } = await requireProjectCapability(projectId, "scenario.manage");
  await db.$transaction(async (tx) => {
    const s = await tx.scenario.delete({ where: { id: scenarioId, projectId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "Scenario", entityId: scenarioId, changes: { name: s.name } });
  });
}

export async function duplicateScenario(projectId: string, scenarioId: string) {
  await requireProjectCapability(projectId, "scenario.manage");
  const s = await db.scenario.findFirstOrThrow({ where: { id: scenarioId, projectId }, include: { adjustments: true } });
  return saveScenario(projectId, null, {
    name: `${s.name} (kopya)`,
    note: s.note,
    monthlyInflationPercent: decOrNull(s.monthlyInflationPercent),
    fxChangePercent: decOrNull(s.fxChangePercent),
    monthlyInterestPercent: decOrNull(s.monthlyInterestPercent),
    delayMonths: s.delayMonths,
    salesPriceChangePercent: dec(s.salesPriceChangePercent),
    salesSpeedPercent: dec(s.salesSpeedPercent),
    landownerSharePercent: decOrNull(s.landownerSharePercent),
    adjustments: s.adjustments.map((a) => ({ costItemCode: a.costItemCode, changePercent: dec(a.changePercent) })),
  });
}

// ---------------------------------------------------------------------------
// Şirket geneli
// ---------------------------------------------------------------------------

function projectsWith(scope: Awaited<ReturnType<typeof getAccess>>["scope"], ids: string[], capability: Parameters<typeof hasCapability>[1]) {
  return ids.filter((id) => hasCapability(projectRole(scope, id) as Role | null, capability));
}

/** Şirket geneli konsolide nakit akışı: projeler + atanmamış bağlantı ödemeleri + genel merkez giderleri. */
export async function getCompanyCashFlow() {
  const { scope, user } = await requireGlobalCapability("companyCash.view");
  const projects = await db.project.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const visible = projectsWith(scope, projects.map((p) => p.id), "cashflow.view");
  const setting = await db.companyCashSetting.findUnique({ where: { id: "default" } });
  const perProject = [];
  for (const id of visible) {
    const inputs = await cashInputs(id);
    const { flow, outcome } = run(inputs);
    perProject.push({ id, name: projects.find((p) => p.id === id)!.name, flow, outcome });
  }
  const currentMonth = monthIndex(new Date());
  const unassigned = paymentEvents(await connectionShares(null));
  const months = perProject.flatMap((p) => [p.flow.firstMonth, p.flow.lastMonth]).concat(unassigned.map((e) => e.month), [currentMonth]);
  const last = Math.max(...months);
  const overhead = dec(setting?.monthlyOverhead);
  const overheadEvents: CashEvent[] = overhead.gt(0) ? Array.from({ length: last - currentMonth + 1 }, (_, i) => ({ month: currentMonth + i, amount: overhead, kind: "overhead" as const, done: false })) : [];
  const rows = consolidate(perProject.map((p) => p.flow), [...unassigned, ...overheadEvents], dec(setting?.openingCash), currentMonth);
  const lowest = rows.reduce<{ balance: Decimal; month: number } | null>((m, r) => (!m || r.balance.lt(m.balance) ? { balance: r.balance, month: r.month } : m), null);
  return {
    canManage: hasCapability(user.role, "companyCash.manage"),
    settings: { openingCash: dec(setting?.openingCash), monthlyOverhead: overhead },
    projects: perProject,
    hiddenProjects: projects.length - visible.length,
    rows,
    currentMonth,
    unassignedTotal: unassigned.filter((e) => !e.done).reduce((s, e) => s.plus(e.amount), zero()),
    lowest,
  };
}

export async function saveCompanyCashSettings(data: { openingCash: Decimal; monthlyOverhead: Decimal }) {
  const { user } = await requireGlobalCapability("companyCash.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.companyCashSetting.findUnique({ where: { id: "default" } });
    await tx.companyCashSetting.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    await writeAudit(tx, { userId: user.id, action: before ? "update" : "create", entity: "CompanyCashSetting", entityId: "default", changes: diffFields(before ?? {}, data) });
  });
}

/** Projeler arası karşılaştırma: m² maliyetleri, bütçe / EAC, gelir, beklenen kâr ve ortak malzeme birim fiyatları. */
export async function getProjectComparison() {
  const { scope } = await requireGlobalCapability("cashflow.view");
  const projects = await db.project.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true, status: true, type: true }, orderBy: { name: "asc" } });
  const visible = projectsWith(scope, projects.map((p) => p.id), "cashflow.view");
  const rows = [];
  for (const id of visible) {
    const inputs = await cashInputs(id);
    const control = await getBudgetControl(id, null);
    const { outcome } = run(inputs);
    const unitsList = await db.unit.aggregate({ where: { projectId: id, owner: "CONTRACTOR", saleContracts: { none: { status: "ACTIVE" } } }, _sum: { listPrice: true } });
    rows.push({
      project: projects.find((p) => p.id === id)!,
      metrics: control.metrics,
      budget: control.totals.budget,
      eac: control.totals.eac,
      actual: control.totals.actual,
      m2: control.m2,
      soldNet: inputs.profit.soldNet,
      unsoldList: dec(unitsList._sum.listPrice),
      outcome,
      peakNeed: outcome.peakNeed,
    });
  }
  // Ortak malzemeler: onaylı harcamalarda ortalama birim fiyat (TL, KDV hariç)
  const spend = await db.expense.groupBy({
    by: ["resourceId", "projectId"],
    where: { projectId: { in: visible }, resourceId: { not: null }, deletedAt: null, approvalStatus: "APPROVED", quantity: { gt: 0 } },
    _sum: { netAmountTry: true, quantity: true },
  });
  const resourceIds = [...new Set(spend.map((s) => s.resourceId!))];
  const resources = await db.resource.findMany({ where: { id: { in: resourceIds } }, select: { id: true, code: true, name: true, unit: true } });
  const prices = resources
    .map((r) => {
      const cells = spend.filter((s) => s.resourceId === r.id);
      const total = cells.reduce((s, c) => s.plus(dec(c._sum.netAmountTry)), zero());
      return {
        resource: r,
        total,
        byProject: new Map(cells.map((c) => [c.projectId, dec(c._sum.quantity).gt(0) ? dec(c._sum.netAmountTry).div(dec(c._sum.quantity)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null])),
      };
    })
    .sort((a, b) => b.total.cmp(a.total))
    .slice(0, 15);
  return { rows, prices, hiddenProjects: projects.length - visible.length };
}
