// Taşeron hakedişi hesabı (PLAN.md 8.2; saf modül).
// Kümülatif miktar − önceki hakedişler = bu dönem miktarı; brüt → KDV, tevkifat → kesintiler → net ödeme.
import Decimal from "decimal.js";
import { roundMoney } from "../expenses/amounts";
import { allocateByWeights } from "../expenses/split";
import { formatNumber } from "../format";

const zero = () => new Decimal(0);
const pct = (base: Decimal, rate: Decimal) => roundMoney(base.times(rate).div(100));

export type ProgressTerms = {
  vatRate: Decimal;
  /** KDV'nin tevkif edilen yüzdesi (ör. 40) */
  vatWithholdingRate: Decimal;
  retentionRate: Decimal;
  advanceOffsetRate: Decimal;
};

export type ProgressLineInput = {
  contractItemId: string;
  description: string;
  unit: string;
  unitPrice: Decimal;
  contractQuantity: Decimal;
  previousQuantity: Decimal;
  cumulativeQuantity: Decimal;
};

export type ProgressInput = {
  lines: readonly ProgressLineInput[];
  terms: ProgressTerms;
  /** Bu hakedişten önce mahsup edilmemiş avans (TL) */
  openAdvance: Decimal;
  /** Elle girilen avans mahsubu; boşsa önerilen kullanılır */
  advanceOffset: Decimal | null;
  materialOffset: Decimal;
  otherDeductions: Decimal;
};

export type ProgressResult = {
  lines: (ProgressLineInput & { quantity: Decimal; amount: Decimal })[];
  grossAmount: Decimal;
  vatAmount: Decimal;
  vatWithheld: Decimal;
  retention: Decimal;
  suggestedAdvanceOffset: Decimal;
  advanceOffset: Decimal;
  materialOffset: Decimal;
  otherDeductions: Decimal;
  payableAmount: Decimal;
  errors: string[];
  warnings: string[];
};

export function computeProgressBilling(input: ProgressInput): ProgressResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = input.lines.map((line) => {
    const quantity = line.cumulativeQuantity.minus(line.previousQuantity);
    if (line.cumulativeQuantity.isNegative()) errors.push(`${line.description}: miktar negatif olamaz.`);
    else if (quantity.isNegative()) {
      errors.push(
        `${line.description}: kümülatif miktar önceki hakedişlerin toplamından (${formatNumber(line.previousQuantity, 4)} ${line.unit}) az olamaz.`,
      );
    }
    if (line.cumulativeQuantity.gt(line.contractQuantity)) {
      warnings.push(
        `${line.description}: kümülatif ${formatNumber(line.cumulativeQuantity, 4)} ${line.unit}, sözleşme miktarı ${formatNumber(line.contractQuantity, 4)} ${line.unit} aşıldı.`,
      );
    }
    return { ...line, quantity, amount: roundMoney(quantity.times(line.unitPrice)) };
  });

  const grossAmount = lines.reduce((sum, line) => sum.plus(line.amount), zero());
  const vatAmount = pct(grossAmount, input.terms.vatRate);
  const vatWithheld = pct(vatAmount, input.terms.vatWithholdingRate);
  const retention = pct(grossAmount, input.terms.retentionRate);
  const openAdvance = Decimal.max(input.openAdvance, zero());
  const suggestedAdvanceOffset = Decimal.min(pct(grossAmount, input.terms.advanceOffsetRate), openAdvance);
  const advanceOffset = input.advanceOffset ?? suggestedAdvanceOffset;
  const materialOffset = roundMoney(input.materialOffset);
  const otherDeductions = roundMoney(input.otherDeductions);

  if (advanceOffset.isNegative() || materialOffset.isNegative() || otherDeductions.isNegative()) {
    errors.push("Kesintiler negatif olamaz.");
  }
  if (advanceOffset.gt(openAdvance)) {
    errors.push(`Avans mahsubu, mahsup edilmemiş avansı (${formatNumber(openAdvance, 2)} TL) aşamaz.`);
  }
  if (materialOffset.gt(grossAmount)) errors.push("Malzeme mahsubu hakediş brütünü aşamaz.");
  if (grossAmount.isZero() && lines.length > 0 && errors.length === 0) warnings.push("Bu dönemde yapılan iş yok (brüt 0).");

  const payableAmount = grossAmount
    .plus(vatAmount)
    .minus(vatWithheld)
    .minus(retention)
    .minus(advanceOffset)
    .minus(materialOffset)
    .minus(otherDeductions);
  if (payableAmount.isNegative()) errors.push("Kesintiler hakediş tutarını aşıyor; net ödeme negatif olamaz.");

  return {
    lines,
    grossAmount,
    vatAmount,
    vatWithheld,
    retention,
    suggestedAdvanceOffset,
    advanceOffset,
    materialOffset,
    otherDeductions,
    payableAmount,
    errors,
    warnings,
  };
}

/**
 * Onaylanan hakedişin maliyete yazılacak satırları: maliyet kalemi başına brüt − (oranla dağıtılan)
 * malzeme mahsubu; KDV de aynı oranla dağıtılır. Malzeme mahsubu düşülür çünkü o malzemenin
 * maliyeti kendi faturasıyla zaten yazılmıştır.
 */
export function progressCostRows(
  lines: readonly { costItemId: string; amount: Decimal }[],
  materialOffset: Decimal,
  vatAmount: Decimal,
): { costItemId: string; netAmount: Decimal; vatAmount: Decimal }[] {
  const byItem = new Map<string, Decimal>();
  for (const line of lines) byItem.set(line.costItemId, (byItem.get(line.costItemId) ?? zero()).plus(line.amount));
  const entries = [...byItem.entries()].filter(([, amount]) => amount.gt(0));
  if (entries.length === 0) return [];
  const weights = entries.map(([, amount]) => amount);
  const offsets = allocateByWeights(materialOffset, weights);
  const vats = allocateByWeights(vatAmount, weights);
  return entries.map(([costItemId, amount], i) => ({
    costItemId,
    netAmount: amount.minus(offsets[i]),
    vatAmount: vats[i],
  }));
}

/** Sözleşme tutarı ve kümülatif ilerleme (%). */
export function contractProgress(
  items: readonly { quantity: Decimal; unitPrice: Decimal; doneQuantity: Decimal }[],
): { contractAmount: Decimal; doneAmount: Decimal; percent: Decimal } {
  let contractAmount = zero();
  let doneAmount = zero();
  for (const item of items) {
    contractAmount = contractAmount.plus(roundMoney(item.quantity.times(item.unitPrice)));
    doneAmount = doneAmount.plus(roundMoney(item.doneQuantity.times(item.unitPrice)));
  }
  const percent = contractAmount.isZero() ? zero() : doneAmount.div(contractAmount).times(100).toDecimalPlaces(1);
  return { contractAmount, doneAmount, percent };
}
