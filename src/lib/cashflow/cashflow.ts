// Nakit akışı ve senaryolar (PLAN.md 7.8, 7.9; saf modül). Aylar mutlak sayıdır: yıl × 12 + ay (0–11).
import Decimal from "decimal.js";
import type { ProfitMethod } from "@/generated/prisma/enums";
import { roundMoney } from "../expenses/amounts";
import { basePrice } from "../pricing/pricing";

const zero = () => new Decimal(0);
const MAX_MONTHS = 180;

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
export const monthLabel = (m: number) => `${TR_MONTHS[((m % 12) + 12) % 12]} ${Math.floor(m / 12)}`;
export const monthKey = (m: number) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// İş programı
// ---------------------------------------------------------------------------

/**
 * Varsayılan iş programı önerisi: üst grupların proje süresine oranla başlangıç / bitişi.
 * Yalnızca başlangıç varsayımıdır (tipik konut projesi sırası); projeye göre düzeltilir.
 */
export const DEFAULT_PHASES: Readonly<Record<string, readonly [number, number]>> = {
  "01": [0, 0.1],
  "02": [0, 0.15],
  "03": [0, 1],
  "04": [0.05, 0.15],
  "05": [0.1, 0.5],
  "06": [0.35, 0.6],
  "07": [0.5, 0.8],
  "08": [0.55, 0.95],
  "09": [0.4, 0.95],
  "10": [0.4, 0.95],
  "11": [0.7, 0.95],
  "12": [0.8, 1],
  "13": [0, 1],
  "14": [0.2, 1],
  "15": [0, 1],
  "16": [0, 1],
};

/** Proje ayı (1 = başlangıç ayı) aralığı; oranlar süreye göre aya çevrilir. */
export function proposeSchedule(group: string, durationMonths: number): { startMonth: number; endMonth: number } | null {
  const phase = DEFAULT_PHASES[group];
  if (!phase || durationMonths < 1) return null;
  const startMonth = Math.min(durationMonths, 1 + Math.floor(phase[0] * durationMonths));
  const endMonth = Math.max(startMonth, Math.min(durationMonths, Math.ceil(phase[1] * durationMonths)));
  return { startMonth, endMonth };
}

/** Kalemin programı: kendisi, yoksa en yakın üst kalemi, yoksa tüm proje süresi. */
export function resolveSchedule(
  itemId: string,
  parentOf: ReadonlyMap<string, string | null>,
  entries: ReadonlyMap<string, { startMonth: number; endMonth: number }>,
  durationMonths: number,
): { startMonth: number; endMonth: number; source: "own" | "parent" | "project" } {
  let cur: string | null | undefined = itemId;
  let first = true;
  while (cur) {
    const e = entries.get(cur);
    if (e) return { ...e, source: first ? "own" : "parent" };
    first = false;
    cur = parentOf.get(cur);
  }
  return { startMonth: 1, endMonth: Math.max(1, durationMonths), source: "project" };
}

// ---------------------------------------------------------------------------
// Nakit akışı
// ---------------------------------------------------------------------------

export type OutKind = "expense" | "progress" | "connection" | "overhead";
export type InKind = "collection" | "installment" | "cheque";

/** Tarihli nakit hareketi (KDV dahil, TL). Gerçekleşmemiş ve vadesi geçmiş olanlar bu aya alınır. */
export type CashEvent = {
  month: number;
  amount: Decimal;
  kind: OutKind | InKind;
  done: boolean;
  foreign?: boolean;
  /** Teslime bağlı (anahtar teslim, banka kredisi): gecikmede o kadar ay ötelenir */
  shiftOnDelay?: boolean;
};

/** Kalan (henüz harcanmamış) maliyet; KDV hariç, iş programına göre aylara yayılır. */
export type PlannedItem = {
  code: string;
  name: string;
  remainingNet: Decimal;
  /** Mutlak ay aralığı */
  startMonth: number;
  endMonth: number;
  /** Dövizli bütçe satırlarının payı (0–1) */
  foreignShare: Decimal;
  /** Süreye bağlı gider (şantiye genel giderleri, kira yardımı): gecikmede orantılı artar */
  timeRelated: boolean;
};

export type SalesAssumption = {
  unsoldCount: number;
  /** Satılmamış bölümlerin liste toplamı (KDV dahil ve hariç) */
  unsoldWithVat: Decimal;
  unsoldNet: Decimal;
  perMonth: Decimal;
  startMonth: number;
  downPaymentPercent: Decimal;
  installmentMonths: number;
};

export type Assumptions = {
  openingCash: Decimal;
  /** Planlanan maliyete eklenen KDV (%) */
  vatPercent: Decimal;
  inflationPercent: Decimal;
  fxPercent: Decimal;
  interestPercent: Decimal;
};

export type ScenarioSpec = {
  adjustments: { code: string; percent: Decimal }[];
  delayMonths: number;
  salesPriceChangePercent: Decimal;
  salesSpeedPercent: Decimal;
  /** Satılmamış alanın çarpanı (arsa payı değişince) */
  unsoldAreaFactor: Decimal;
};

export const BASE_SCENARIO: ScenarioSpec = { adjustments: [], delayMonths: 0, salesPriceChangePercent: zero(), salesSpeedPercent: new Decimal(100), unsoldAreaFactor: new Decimal(1) };

export type CashRow = {
  month: number;
  /** Bu aydan önceki aylar gerçekleşen */
  past: boolean;
  outExpense: Decimal;
  outProgress: Decimal;
  outConnection: Decimal;
  outOverhead: Decimal;
  outPlanned: Decimal;
  outFinancing: Decimal;
  outTotal: Decimal;
  inCollected: Decimal;
  inScheduled: Decimal;
  inSales: Decimal;
  inTotal: Decimal;
  net: Decimal;
  balance: Decimal;
};

/** Kod öneki eşleşmesi: en uzun önek kazanır ("05.05" demir, "05" tüm grup). */
export function adjustmentFor(code: string, adjustments: readonly { code: string; percent: Decimal }[]): Decimal {
  let best: { code: string; percent: Decimal } | null = null;
  for (const a of adjustments) {
    if ((code === a.code || code.startsWith(`${a.code}.`)) && (!best || a.code.length > best.code.length)) best = a;
  }
  return best?.percent ?? zero();
}

/** Kalan maliyetin senaryo düzeltmesi (fiyat, kur, gecikme) — enflasyon öncesi, KDV hariç. */
function adjustedRemaining(item: PlannedItem, a: Assumptions, s: ScenarioSpec, currentMonth: number) {
  let amount = item.remainingNet.times(adjustmentFor(item.code, s.adjustments).div(100).plus(1));
  amount = amount.times(item.foreignShare.times(a.fxPercent).div(100).plus(1));
  const start = Math.max(item.startMonth, currentMonth);
  const plannedEnd = Math.max(item.endMonth, currentMonth);
  const end = plannedEnd + s.delayMonths;
  if (item.timeRelated && s.delayMonths > 0) amount = amount.times(new Decimal(s.delayMonths).div(plannedEnd - start + 1).plus(1));
  return { amount, start, end };
}

export type CashFlowResult = {
  rows: CashRow[];
  totalIn: Decimal;
  totalOut: Decimal;
  financingCost: Decimal;
  /** En düşük kümülatif bakiye (negatifse en yüksek nakit ihtiyacı) ve ayı */
  lowestBalance: Decimal;
  lowestMonth: number;
  endBalance: Decimal;
  /** Planlanan maliyet (KDV hariç, düzeltilmiş, enflasyonlu) ve kalem bazında */
  plannedNet: Decimal;
  plannedNetByCode: Map<string, Decimal>;
  /** Satış varsayımından gelir (KDV hariç) */
  salesNet: Decimal;
  firstMonth: number;
  lastMonth: number;
  truncated: boolean;
};

export function buildCashFlow(input: {
  currentMonth: number;
  /** Proje başlangıç ve bitiş ayı (mutlak) */
  startMonth: number;
  endMonth: number;
  events: readonly CashEvent[];
  planned: readonly PlannedItem[];
  sales: SalesAssumption | null;
  assumptions: Assumptions;
  scenario?: ScenarioSpec;
}): CashFlowResult {
  const { currentMonth: cur, assumptions: a } = input;
  const s = input.scenario ?? BASE_SCENARIO;
  const add = (map: Map<number, Decimal>, m: number, v: Decimal) => map.set(m, (map.get(m) ?? zero()).plus(v));
  const buckets: Record<OutKind | InKind | "planned" | "sales", Map<number, Decimal>> = {
    expense: new Map(),
    progress: new Map(),
    connection: new Map(),
    overhead: new Map(),
    collection: new Map(),
    installment: new Map(),
    cheque: new Map(),
    planned: new Map(),
    sales: new Map(),
  };
  let last = Math.max(input.endMonth + s.delayMonths, cur);
  let first = Math.min(input.startMonth, cur);

  for (const e of input.events) {
    // Ödenmemiş / tahsil edilmemiş ve vadesi geçmiş kalem bu aya; dövizli gelecek ödeme kur değişimiyle.
    const due = !e.done && e.month < cur ? cur : e.month;
    const month = !e.done && e.shiftOnDelay ? due + s.delayMonths : due;
    const amount = !e.done && e.foreign ? e.amount.times(a.fxPercent.div(100).plus(1)) : e.amount;
    add(buckets[e.kind], month, amount);
    first = Math.min(first, month);
    last = Math.max(last, month);
  }

  // Kalan maliyet: iş programı aylarına eşit yayılır; enflasyon bu aydan itibaren bileşik.
  const inflation = a.inflationPercent.div(100).plus(1);
  const vat = a.vatPercent.div(100).plus(1);
  let plannedNet = zero();
  const plannedNetByCode = new Map<string, Decimal>();
  for (const item of input.planned) {
    if (item.remainingNet.lte(0)) continue;
    const { amount, start, end } = adjustedRemaining(item, a, s, cur);
    const months = end - start + 1;
    const each = amount.div(months);
    let itemNet = zero();
    for (let m = start; m <= end; m++) {
      const net = each.times(inflation.pow(m - cur));
      itemNet = itemNet.plus(net);
      add(buckets.planned, m, net.times(vat));
    }
    plannedNet = plannedNet.plus(itemNet);
    plannedNetByCode.set(item.code, (plannedNetByCode.get(item.code) ?? zero()).plus(itemNet));
    last = Math.max(last, end);
  }

  // Satılmamış bölümler: aylık satış adedi, peşinat ve taksitler (gecikmede satış başlangıcı da ötelenir).
  let salesNet = zero();
  const sa = input.sales;
  if (sa && sa.unsoldCount > 0 && sa.perMonth.gt(0)) {
    const priceFactor = s.salesPriceChangePercent.div(100).plus(1);
    const count = new Decimal(sa.unsoldCount).times(s.unsoldAreaFactor);
    const unitWithVat = sa.unsoldWithVat.div(sa.unsoldCount).times(priceFactor);
    const unitNet = sa.unsoldNet.div(sa.unsoldCount).times(priceFactor);
    const perMonth = sa.perMonth.times(s.salesSpeedPercent).div(100);
    const down = sa.downPaymentPercent.div(100);
    let left = count;
    for (let m = Math.max(sa.startMonth, cur) + s.delayMonths; left.gt(0) && m < cur + MAX_MONTHS; m++) {
      const sold = Decimal.min(perMonth, left);
      left = left.minus(sold);
      const value = sold.times(unitWithVat);
      salesNet = salesNet.plus(sold.times(unitNet));
      if (sa.installmentMonths <= 0) add(buckets.sales, m, value);
      else {
        add(buckets.sales, m, value.times(down));
        const each = value.times(new Decimal(1).minus(down)).div(sa.installmentMonths);
        for (let k = 1; k <= sa.installmentMonths; k++) add(buckets.sales, m + k, each);
      }
      last = Math.max(last, m + Math.max(0, sa.installmentMonths));
    }
  }

  const truncated = last - first + 1 > MAX_MONTHS;
  if (truncated) last = first + MAX_MONTHS - 1;

  // Aylık tablo ve finansman: bu aydan itibaren önceki ayın açığına aylık faiz.
  const rate = a.interestPercent.div(100);
  const rows: CashRow[] = [];
  let balance = a.openingCash;
  let financingCost = zero();
  let totalIn = zero();
  let totalOut = zero();
  let lowestBalance = balance;
  let lowestMonth = first;
  const get = (k: keyof typeof buckets, m: number) => roundMoney(buckets[k].get(m) ?? zero());
  for (let m = first; m <= last; m++) {
    const outFinancing = m >= cur && balance.isNegative() ? roundMoney(balance.neg().times(rate)) : zero();
    const outExpense = get("expense", m);
    const outProgress = get("progress", m);
    const outConnection = get("connection", m);
    const outOverhead = get("overhead", m);
    const outPlanned = get("planned", m);
    const inCollected = get("collection", m);
    const inScheduled = get("installment", m).plus(get("cheque", m));
    const inSales = get("sales", m);
    const outTotal = outExpense.plus(outProgress).plus(outConnection).plus(outOverhead).plus(outPlanned).plus(outFinancing);
    const inTotal = inCollected.plus(inScheduled).plus(inSales);
    const net = inTotal.minus(outTotal);
    balance = balance.plus(net);
    financingCost = financingCost.plus(outFinancing);
    totalIn = totalIn.plus(inTotal);
    totalOut = totalOut.plus(outTotal);
    if (balance.lt(lowestBalance)) {
      lowestBalance = balance;
      lowestMonth = m;
    }
    rows.push({ month: m, past: m < cur, outExpense, outProgress, outConnection, outOverhead, outPlanned, outFinancing, outTotal, inCollected, inScheduled, inSales, inTotal, net, balance });
  }
  return { rows, totalIn, totalOut, financingCost, lowestBalance, lowestMonth, endBalance: balance, plannedNet: roundMoney(plannedNet), plannedNetByCode, salesNet: roundMoney(salesNet), firstMonth: first, lastMonth: last, truncated };
}

/** Birden fazla projenin nakit akışını takvim ayına göre toplar (şirket geneli). */
export function consolidate(flows: readonly { rows: readonly CashRow[] }[], extra: readonly CashEvent[], openingCash: Decimal, currentMonth: number): CashRow[] {
  const byMonth = new Map<number, CashRow>();
  const blank = (m: number): CashRow => ({ month: m, past: m < currentMonth, outExpense: zero(), outProgress: zero(), outConnection: zero(), outOverhead: zero(), outPlanned: zero(), outFinancing: zero(), outTotal: zero(), inCollected: zero(), inScheduled: zero(), inSales: zero(), inTotal: zero(), net: zero(), balance: zero() });
  const row = (m: number) => byMonth.get(m) ?? byMonth.set(m, blank(m)).get(m)!;
  for (const f of flows) {
    for (const r of f.rows) {
      const t = row(r.month);
      for (const k of ["outExpense", "outProgress", "outConnection", "outOverhead", "outPlanned", "outFinancing", "inCollected", "inScheduled", "inSales"] as const) t[k] = t[k].plus(r[k]);
    }
  }
  for (const e of extra) {
    const month = !e.done && e.month < currentMonth ? currentMonth : e.month;
    const t = row(month);
    if (e.kind === "connection") t.outConnection = t.outConnection.plus(e.amount);
    else if (e.kind === "overhead") t.outOverhead = t.outOverhead.plus(e.amount);
  }
  const months = [...byMonth.keys()].sort((x, y) => x - y);
  if (months.length === 0) return [];
  let balance = openingCash;
  const result: CashRow[] = [];
  for (let m = months[0]; m <= months[months.length - 1]; m++) {
    const t = row(m);
    t.outTotal = t.outExpense.plus(t.outProgress).plus(t.outConnection).plus(t.outOverhead).plus(t.outPlanned).plus(t.outFinancing);
    t.inTotal = t.inCollected.plus(t.inScheduled).plus(t.inSales);
    t.net = t.inTotal.minus(t.outTotal);
    balance = balance.plus(t.net);
    t.balance = balance;
    result.push(t);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Senaryo sonucu, duyarlılık ve en etkili kalemler
// ---------------------------------------------------------------------------

export type ProfitInput = {
  /** Şimdiye kadarki gerçekleşen maliyet ve bağlantıyla sabitlenmiş açık taahhüt (KDV hariç) */
  actualCost: Decimal;
  connectionOpenNet: Decimal;
  /** Satılmış bölümlerin satış fiyatı (KDV hariç) */
  soldNet: Decimal;
  soldGross: Decimal;
  sellableGross: Decimal;
  contractorGross: Decimal;
  commissionPercent: Decimal;
  profitMethod: ProfitMethod;
  profitPercent: Decimal;
};

/** Arsa payı değişince müteahhide kalan alan ve satılmamış alan çarpanı (alan oranıyla yaklaşık). */
export function landownerEffect(p: Pick<ProfitInput, "sellableGross" | "contractorGross" | "soldGross">, sharePercent: Decimal | null) {
  if (sharePercent == null) return { contractorGross: p.contractorGross, unsoldAreaFactor: new Decimal(1) };
  const contractorGross = p.sellableGross.times(new Decimal(1).minus(sharePercent.div(100)));
  const before = p.contractorGross.minus(p.soldGross);
  const after = Decimal.max(contractorGross.minus(p.soldGross), 0);
  return { contractorGross, unsoldAreaFactor: before.gt(0) ? after.div(before) : new Decimal(0) };
}

export function scenarioOutcome(flow: CashFlowResult, p: ProfitInput, contractorGross: Decimal) {
  const cost = p.actualCost.plus(p.connectionOpenNet).plus(flow.plannedNet);
  const revenue = p.soldNet.plus(flow.salesNet);
  const commission = roundMoney(revenue.times(p.commissionPercent).div(100));
  const profit = revenue.minus(commission).minus(cost).minus(flow.financingCost);
  const base = basePrice({ cost: cost.plus(flow.financingCost), advertising: zero(), contractorGross, commissionPercent: p.commissionPercent, method: p.profitMethod, profitPercent: p.profitPercent });
  return {
    cost: roundMoney(cost),
    revenue: roundMoney(revenue),
    commission,
    financingCost: flow.financingCost,
    profit: roundMoney(profit),
    marginPercent: revenue.gt(0) ? profit.div(revenue).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null,
    /** Hedef kâr için gereken baz m² fiyatı (KDV hariç) */
    requiredM2: base.ok ? base.baseM2 : null,
    costPerM2: contractorGross.gt(0) ? roundMoney(cost.div(contractorGross)) : null,
    peakNeed: flow.lowestBalance.isNegative() ? flow.lowestBalance.neg() : zero(),
    peakMonth: flow.lowestMonth,
  };
}

export type Outcome = ReturnType<typeof scenarioOutcome>;

/** Kâra en çok etki eden kalemler: kalan maliyetin ±%10'u ve satılmamış bölümlerin fiyatı ±%10 (PLAN 7.9). */
export function tornado(flow: CashFlowResult, names: ReadonlyMap<string, string>, swingPercent = 10, limit = 10) {
  const swing = new Decimal(swingPercent).div(100);
  const rows: { key: string; label: string; impact: Decimal; kind: "cost" | "sales" }[] = [...flow.plannedNetByCode.entries()].map(([code, net]) => ({
    key: code,
    label: `${code} ${names.get(code) ?? ""}`.trim(),
    impact: roundMoney(net.times(swing)),
    kind: "cost",
  }));
  if (flow.salesNet.gt(0)) rows.push({ key: "sales", label: "Satılmamış bölümlerin fiyatı", impact: roundMoney(flow.salesNet.times(swing)), kind: "sales" });
  return rows.sort((x, y) => y.impact.cmp(x.impact)).slice(0, limit);
}
