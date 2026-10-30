// Bütçe kontrolü: ilerleme, tahmini tamamlanma maliyeti (EAC), sapma (PLAN.md 8.3), bağlantı
// kapsaması ve bağlantı kazancı (PLAN.md 9.6). Saf modül.
import Decimal from "decimal.js";
import { roundMoney } from "../expenses/amounts";
import { formatNumber } from "../format";

const zero = () => new Decimal(0);

/** EAC referansı bu oranı aşarsa "risk" (bütçe aşımı bekleniyor). */
export const RISK_RATIO = new Decimal("1.05");

export type ProgressSource = "manual" | "quantity" | null;

export type ItemControlInput = {
  /** Baz (onaylı) bütçe; yoksa güncel bütçe referans alınır */
  baseline: Decimal | null;
  /** Güncel bütçe (canlı fiyat ve miktarla) */
  budget: Decimal;
  /** Bütçe miktarı ve gerçekleşen miktar (aynı birimdeyse) */
  budgetQuantity: Decimal | null;
  actualQuantity: Decimal | null;
  actual: Decimal;
  manualPercent: Decimal | null;
};

export type ItemControl = {
  reference: Decimal;
  percent: Decimal | null;
  percentSource: ProgressSource;
  /** Kazanılmış değer: güncel bütçe × tamamlanma oranı */
  earned: Decimal;
  eac: Decimal;
  /** Referans − EAC (eksi: aşım bekleniyor) */
  variance: Decimal;
  status: "over" | "risk" | "ok" | "unbudgeted";
};

/**
 * EAC = gerçekleşen + kalan iş × güncel birim fiyat (PLAN 8.3). Kalan iş, tamamlanma oranından:
 * güncel bütçe × (1 − oran). Oran yoksa bütçe korunur kabul edilir: EAC = max(gerçekleşen, bütçe).
 */
export function itemControl(input: ItemControlInput): ItemControl {
  const reference = input.baseline ?? input.budget;
  let percent: Decimal | null = null;
  let percentSource: ProgressSource = null;
  if (input.manualPercent) {
    percent = input.manualPercent;
    percentSource = "manual";
  } else if (input.budgetQuantity?.gt(0) && input.actualQuantity) {
    percent = input.actualQuantity.div(input.budgetQuantity).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
    percentSource = "quantity";
  }
  const ratio = percent ? Decimal.min(percent.div(100), 1) : null;
  const earned = ratio ? roundMoney(input.budget.times(ratio)) : zero();
  const eac = ratio ? roundMoney(input.actual.plus(input.budget.times(new Decimal(1).minus(ratio)))) : Decimal.max(input.actual, input.budget);
  const variance = reference.minus(eac);
  let status: ItemControl["status"] = "ok";
  if (reference.isZero() && input.actual.gt(0)) status = "unbudgeted";
  else if (input.actual.gt(reference)) status = "over";
  else if (eac.gt(reference.times(RISK_RATIO))) status = "risk";
  return { reference, percent, percentSource, earned, eac, variance, status };
}

export type Totals = { baseline: Decimal; budget: Decimal; actual: Decimal; eac: Decimal; earned: Decimal };

/** Proje toplamı ve genel ilerleme (kazanılmış değer / güncel bütçe). */
export function controlTotals(rows: readonly { baseline: Decimal | null; budget: Decimal; actual: Decimal; control: ItemControl }[]) {
  const t: Totals = { baseline: zero(), budget: zero(), actual: zero(), eac: zero(), earned: zero() };
  let hasBaseline = false;
  for (const r of rows) {
    if (r.baseline) hasBaseline = true;
    t.baseline = t.baseline.plus(r.baseline ?? zero());
    t.budget = t.budget.plus(r.budget);
    t.actual = t.actual.plus(r.actual);
    t.eac = t.eac.plus(r.control.eac);
    t.earned = t.earned.plus(r.control.earned);
  }
  const reference = hasBaseline ? t.baseline : t.budget;
  return {
    ...t,
    hasBaseline,
    reference,
    variance: reference.minus(t.eac),
    progress: t.budget.gt(0) ? t.earned.div(t.budget).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP) : null,
  };
}

// ---------------------------------------------------------------------------
// Bağlantı kapsaması (PLAN 9.6): bütçedeki ihtiyaç ↔ projeye tahsis edilen bağlantı miktarı
// ---------------------------------------------------------------------------

export const COVERAGE_LOW = new Decimal(100);
export const COVERAGE_HIGH = new Decimal(110);

export type CoverageRow = {
  key: string;
  need: Decimal;
  covered: Decimal;
  drawn: Decimal;
  percent: Decimal | null;
  open: Decimal;
  status: "missing" | "short" | "ok" | "excess" | "unbudgeted";
  message: string;
};

export function coverage(
  needs: readonly { key: string; label: string; unit: string; quantity: Decimal }[],
  covers: readonly { key: string; label: string; unit: string; allocated: Decimal; drawn: Decimal }[],
): CoverageRow[] {
  const keys = new Map<string, { label: string; unit: string; need: Decimal; covered: Decimal; drawn: Decimal }>();
  const get = (key: string, label: string, unit: string) =>
    keys.get(key) ?? keys.set(key, { label, unit, need: zero(), covered: zero(), drawn: zero() }).get(key)!;
  for (const n of needs) get(n.key, n.label, n.unit).need = get(n.key, n.label, n.unit).need.plus(n.quantity);
  for (const c of covers) {
    const row = get(c.key, c.label, c.unit);
    row.covered = row.covered.plus(c.allocated);
    row.drawn = row.drawn.plus(c.drawn);
  }
  return [...keys.entries()].map(([key, r]) => {
    const qty = (v: Decimal) => `${formatNumber(v, 2)} ${r.unit}`;
    if (r.need.isZero()) {
      return { key, need: r.need, covered: r.covered, drawn: r.drawn, percent: null, open: zero(), status: "unbudgeted" as const, message: `${r.label}: bütçede ihtiyaç yok, bağlantı ${qty(r.covered)}.` };
    }
    const percent = r.covered.div(r.need).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
    const open = Decimal.max(r.need.minus(r.covered), zero());
    const status = r.covered.isZero() ? "missing" : percent.lt(COVERAGE_LOW) ? "short" : percent.gt(COVERAGE_HIGH) ? "excess" : "ok";
    const message =
      status === "excess"
        ? `${r.label}: ihtiyacın %${formatNumber(percent, 1)}'i bağlantılı; ${qty(r.covered.minus(r.need))} fazla.`
        : status === "ok"
          ? `${r.label}: ihtiyacın %${formatNumber(percent, 1)}'i bağlantılı.`
          : `${r.label}: ihtiyacın %${formatNumber(percent, 1)}'i bağlantılı, ${qty(open)} açık.`;
    return { key, need: r.need, covered: r.covered, drawn: r.drawn, percent, open, status, message };
  });
}

/**
 * Bağlantı kazancı: (güncel piyasa / son alım fiyatı − bağlantı fiyatı) × miktar (TL).
 * Pozitif: bağlantı sayesinde kazanç; negatif: bağlantı fiyatı güncelin üstünde.
 */
export function connectionGain(connectionPriceTry: Decimal, currentPriceTry: Decimal, quantity: Decimal): Decimal {
  return roundMoney(currentPriceTry.minus(connectionPriceTry).times(quantity));
}
