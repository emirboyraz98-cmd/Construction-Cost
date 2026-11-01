// Birden fazla projeyi ilgilendiren faturanın projelere bölünmesi (PLAN.md 5.1 ve 8.1).
// Kuruşlar "en büyük kalan" yöntemiyle dağıtılır: parçaların toplamı her zaman toplamın kendisidir.
import Decimal from "decimal.js";
import type { ExpenseAmounts } from "./amounts";

function assertWeights(weights: readonly Decimal[]): Decimal {
  if (weights.length === 0) throw new Error("En az bir proje seçilmeli.");
  if (weights.some((w) => w.isNegative())) throw new Error("Dağıtım oranı negatif olamaz.");
  const sum = weights.reduce((acc, w) => acc.plus(w), new Decimal(0));
  if (sum.lte(0)) throw new Error("Dağıtım oranlarının toplamı sıfırdan büyük olmalı.");
  return sum;
}

/** Tutarı (2 haneli) ağırlıklara göre kuruşu kuruşuna böler. */
export function allocateByWeights(total: Decimal, weights: readonly Decimal[]): Decimal[] {
  const sum = assertWeights(weights);
  const cents = total.times(100);
  if (!cents.isInteger()) throw new Error("Bölünecek tutar kuruş hassasiyetinde olmalı.");
  const raw = weights.map((w) => cents.times(w).div(sum));
  const floors = raw.map((r) => r.floor());
  let remainder = cents.minus(floors.reduce((acc, f) => acc.plus(f), new Decimal(0))).toNumber();
  const order = raw
    .map((r, index) => ({ index, fraction: r.minus(r.floor()) }))
    .sort((a, b) => b.fraction.comparedTo(a.fraction) || a.index - b.index);
  const result = [...floors];
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] = result[index].plus(1);
    remainder -= 1;
  }
  return result.map((c) => c.div(100));
}

/** Her projenin payı (0–1 arası, 6 hane) — kayıtta bilgi amaçlı tutulur. */
export function ratiosFromWeights(weights: readonly Decimal[]): Decimal[] {
  const sum = assertWeights(weights);
  return weights.map((w) => w.div(sum).toDecimalPlaces(6, Decimal.ROUND_HALF_UP));
}

/**
 * Fatura tutarlarını projelere böler. Toplam ve matrah ayrı ayrı dağıtılır, KDV aradaki farktır;
 * böylece her satırda matrah + KDV = toplam olur ve satırların toplamı faturaya eşittir.
 */
export function splitExpenseAmounts(amounts: ExpenseAmounts, weights: readonly Decimal[]): ExpenseAmounts[] {
  const totals = allocateByWeights(amounts.totalAmount, weights);
  const nets = allocateByWeights(amounts.netAmount, weights);
  const totalsTry = allocateByWeights(amounts.totalAmountTry, weights);
  const netsTry = allocateByWeights(amounts.netAmountTry, weights);
  return weights.map((_, i) => ({
    netAmount: nets[i],
    vatAmount: totals[i].minus(nets[i]),
    totalAmount: totals[i],
    netAmountTry: netsTry[i],
    vatAmountTry: totalsTry[i].minus(netsTry[i]),
    totalAmountTry: totalsTry[i],
  }));
}
