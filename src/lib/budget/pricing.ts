// Kütüphane fiyatı: kaynak önceliği ve reçete birim fiyatı (PLAN.md 4.2, 4.3, 7.1; saf modül).
import Decimal from "decimal.js";
import type { Currency } from "@/generated/prisma/enums";

export type PriceKind = "CONNECTION" | "INVOICE" | "QUOTE" | "MARKET";

/** Bütçede kullanılacak fiyatın önceliği: geçerli bağlantı → son alım → teklif → piyasa. */
export const PRICE_PRIORITY: readonly PriceKind[] = ["CONNECTION", "INVOICE", "QUOTE", "MARKET"];

export type PriceCandidate = { kind: PriceKind; price: Decimal; currency: Currency; date: Date; label?: string };

/** Önceliği en yüksek kaynaktaki en yeni fiyat. */
export function effectivePrice(candidates: readonly PriceCandidate[]): PriceCandidate | null {
  for (const kind of PRICE_PRIORITY) {
    const latest = candidates
      .filter((c) => c.kind === kind)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (latest) return latest;
  }
  return null;
}

/** TL karşılığı; kur yoksa null. Kurlar: döviz → TL (TL için gerekmez). */
export function toTry(price: Decimal, currency: Currency, rates: ReadonlyMap<Currency, Decimal>): Decimal | null {
  if (currency === "TRY") return price;
  const rate = rates.get(currency);
  return rate ? price.times(rate) : null;
}

export type RecipeLineInput = { quantity: Decimal; wastePercent: Decimal; priceTry: Decimal | null };

/**
 * Reçete birim fiyatı = Σ (kaynak miktarı × (1 + fire %) × kaynak fiyatı). Fiyatı bulunmayan
 * kaynak sayısı ayrıca döner (bütçede "eksik fiyat" uyarısı için). 4 haneye yuvarlanır.
 */
export function recipeUnitPrice(lines: readonly RecipeLineInput[]): { unitPrice: Decimal; missing: number } {
  let unitPrice = new Decimal(0);
  let missing = 0;
  for (const line of lines) {
    if (!line.priceTry) {
      missing++;
      continue;
    }
    unitPrice = unitPrice.plus(line.quantity.times(line.wastePercent.div(100).plus(1)).times(line.priceTry));
  }
  return { unitPrice: unitPrice.toDecimalPlaces(4, Decimal.ROUND_HALF_UP), missing };
}
