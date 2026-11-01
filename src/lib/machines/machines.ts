// İş makineleri: aylık ve kümülatif nakit akışı, iç kullanım değeri, geri dönüş ve saat başı
// işletme maliyeti (saf modül; tutarlar decimal.js ile).
import Decimal from "decimal.js";
import type { MachineEntryType } from "@/generated/prisma/enums";
import { monthIndex, type CashEvent } from "@/lib/cashflow/cashflow";

const zero = () => new Decimal(0);

/** Kasaya giren hareketler (diğerleri çıkış). */
export const INCOME_TYPES: readonly MachineEntryType[] = ["RENT_INCOME", "SALE", "OTHER_INCOME"];
/** Yatırım / finansman hareketleri: işletme maliyetine katılmaz. */
export const CAPITAL_TYPES: readonly MachineEntryType[] = ["PURCHASE", "FINANCING", "SALE"];

export const isIncome = (type: MachineEntryType) => INCOME_TYPES.includes(type);

export type MachineEntryInput = { date: Date; type: MachineEntryType; amount: Decimal; paid: boolean; dueDate: Date | null };
export type MachineUsageInput = { date: Date; quantity: Decimal; amount: Decimal };

/**
 * Hareketin nakit akışındaki ayı: ödenmişse tarihi; ödenmemişse vadesi (yoksa tarihi),
 * vadesi geçmiş ödenmemiş hareket bu aya alınır (proje nakit akışıyla aynı kural).
 */
export function entryMonth(e: Pick<MachineEntryInput, "date" | "paid" | "dueDate">, currentMonth: number) {
  if (e.paid) return monthIndex(e.date);
  return Math.max(monthIndex(e.dueDate ?? e.date), currentMonth);
}

export type MachineMonth = {
  month: number;
  past: boolean;
  cashIn: Decimal;
  cashOut: Decimal;
  net: Decimal;
  /** Gerçek nakit, kümülatif */
  cumulative: Decimal;
  /** Projelerde çalışmanın değeri (iç kullanım; nakit değil) */
  usageValue: Decimal;
  usageQty: Decimal;
  /** İç kullanım değeri dahil kümülatif (ekonomik getiri) */
  cumulativeWithUsage: Decimal;
};

export type MachineTotals = {
  cashIn: Decimal;
  cashOut: Decimal;
  net: Decimal;
  usageValue: Decimal;
  usageQty: Decimal;
  netWithUsage: Decimal;
  /** Satın alma, finansman ve satış hariç giderler (yakıt, bakım, onarım, operatör …) */
  operatingCost: Decimal;
  /** İşletme maliyeti ÷ çalışma miktarı (saat veya gün); çalışma yoksa null */
  operatingCostPerUnit: Decimal | null;
  /** Ödenmemiş (planlı) çıkışlar */
  plannedOut: Decimal;
};

export type MachineFlow = { rows: MachineMonth[]; totals: MachineTotals; paybackMonth: number | null };

/** Aylık satırlardan kümülatifleri ve geri dönüş ayını hesaplar. */
function accumulate(byMonth: Map<number, { cashIn: Decimal; cashOut: Decimal; usageValue: Decimal; usageQty: Decimal }>, currentMonth: number) {
  const months = [...byMonth.keys()];
  if (months.length === 0) return { rows: [] as MachineMonth[], paybackMonth: null };
  const first = Math.min(...months);
  const last = Math.max(...months, currentMonth);
  const rows: MachineMonth[] = [];
  let cumulative = zero();
  let cumulativeWithUsage = zero();
  let wasNegative = false;
  let paybackMonth: number | null = null;
  for (let m = first; m <= last; m++) {
    const b = byMonth.get(m) ?? { cashIn: zero(), cashOut: zero(), usageValue: zero(), usageQty: zero() };
    const net = b.cashIn.minus(b.cashOut);
    cumulative = cumulative.plus(net);
    cumulativeWithUsage = cumulativeWithUsage.plus(net).plus(b.usageValue);
    if (cumulativeWithUsage.isNegative()) wasNegative = true;
    else if (wasNegative && paybackMonth === null) paybackMonth = m;
    rows.push({ month: m, past: m < currentMonth, cashIn: b.cashIn, cashOut: b.cashOut, net, cumulative, usageValue: b.usageValue, usageQty: b.usageQty, cumulativeWithUsage });
  }
  return { rows, paybackMonth };
}

/** Bir makinenin ay ay nakit akışı ve özetleri. */
export function machineCashFlow(entries: readonly MachineEntryInput[], usages: readonly MachineUsageInput[], currentMonth: number): MachineFlow {
  const byMonth = new Map<number, { cashIn: Decimal; cashOut: Decimal; usageValue: Decimal; usageQty: Decimal }>();
  const bucket = (m: number) => byMonth.get(m) ?? byMonth.set(m, { cashIn: zero(), cashOut: zero(), usageValue: zero(), usageQty: zero() }).get(m)!;
  const totals: MachineTotals = { cashIn: zero(), cashOut: zero(), net: zero(), usageValue: zero(), usageQty: zero(), netWithUsage: zero(), operatingCost: zero(), operatingCostPerUnit: null, plannedOut: zero() };
  for (const e of entries) {
    const b = bucket(entryMonth(e, currentMonth));
    if (isIncome(e.type)) {
      b.cashIn = b.cashIn.plus(e.amount);
      totals.cashIn = totals.cashIn.plus(e.amount);
    } else {
      b.cashOut = b.cashOut.plus(e.amount);
      totals.cashOut = totals.cashOut.plus(e.amount);
      if (!CAPITAL_TYPES.includes(e.type)) totals.operatingCost = totals.operatingCost.plus(e.amount);
      if (!e.paid) totals.plannedOut = totals.plannedOut.plus(e.amount);
    }
  }
  for (const u of usages) {
    const b = bucket(monthIndex(u.date));
    b.usageValue = b.usageValue.plus(u.amount);
    b.usageQty = b.usageQty.plus(u.quantity);
    totals.usageValue = totals.usageValue.plus(u.amount);
    totals.usageQty = totals.usageQty.plus(u.quantity);
  }
  totals.net = totals.cashIn.minus(totals.cashOut);
  totals.netWithUsage = totals.net.plus(totals.usageValue);
  totals.operatingCostPerUnit = totals.usageQty.gt(0) ? totals.operatingCost.div(totals.usageQty).toDecimalPlaces(2) : null;
  const { rows, paybackMonth } = accumulate(byMonth, currentMonth);
  return { rows, totals, paybackMonth };
}

/** Filo toplamı: makinelerin aylık satırlarını toplar, kümülatifleri yeniden hesaplar. */
export function combineMachineFlows(flows: readonly MachineFlow[], currentMonth: number): MachineFlow {
  const byMonth = new Map<number, { cashIn: Decimal; cashOut: Decimal; usageValue: Decimal; usageQty: Decimal }>();
  const totals: MachineTotals = { cashIn: zero(), cashOut: zero(), net: zero(), usageValue: zero(), usageQty: zero(), netWithUsage: zero(), operatingCost: zero(), operatingCostPerUnit: null, plannedOut: zero() };
  for (const f of flows) {
    for (const r of f.rows) {
      const b = byMonth.get(r.month) ?? byMonth.set(r.month, { cashIn: zero(), cashOut: zero(), usageValue: zero(), usageQty: zero() }).get(r.month)!;
      b.cashIn = b.cashIn.plus(r.cashIn);
      b.cashOut = b.cashOut.plus(r.cashOut);
      b.usageValue = b.usageValue.plus(r.usageValue);
      b.usageQty = b.usageQty.plus(r.usageQty);
    }
    for (const k of ["cashIn", "cashOut", "usageValue", "usageQty", "operatingCost", "plannedOut"] as const) totals[k] = totals[k].plus(f.totals[k]);
  }
  totals.net = totals.cashIn.minus(totals.cashOut);
  totals.netWithUsage = totals.net.plus(totals.usageValue);
  // Filoda saat ve gün karışabileceği için birim maliyet verilmez.
  const { rows, paybackMonth } = accumulate(byMonth, currentMonth);
  return { rows, totals, paybackMonth };
}

/** Şirket geneli nakit akışına eklenecek makine hareketleri (gerçek nakit; iç kullanım hariç). */
export function machineCashEvents(entries: readonly MachineEntryInput[], currentMonth: number): CashEvent[] {
  return entries.map((e) => ({
    month: entryMonth(e, currentMonth),
    amount: e.amount,
    kind: isIncome(e.type) ? ("machineIn" as const) : ("machineOut" as const),
    done: e.paid,
  }));
}

/** Puantaj tutarı: miktar × birim ücret (kuruşa yuvarlanır). */
export function usageAmount(quantity: Decimal, rate: Decimal) {
  return quantity.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
