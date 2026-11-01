// İmar ve alan hesapları (hesap motorunun ilk parçası; saf fonksiyonlar).
import Decimal from "decimal.js";

type Num = Decimal | string | number | { toString(): string };

const dec = (value: Num) => new Decimal(value.toString());

/** Emsal (KAKS) alanı = arsa alanı × emsal. Girdilerden biri yoksa null. */
export function permittedFloorArea(landArea: Num | null, floorAreaRatio: Num | null): Decimal | null {
  if (landArea == null || floorAreaRatio == null) return null;
  return dec(landArea).times(dec(floorAreaRatio));
}

/** Taban oturumu (TAKS alanı) = arsa alanı × TAKS. */
export function permittedFootprint(landArea: Num | null, groundCoverageRatio: Num | null): Decimal | null {
  if (landArea == null || groundCoverageRatio == null) return null;
  return dec(landArea).times(dec(groundCoverageRatio));
}

/** Blokların inşaat alanları toplamı (alanı girilmemiş bloklar 0 sayılır). */
export function totalConstructionArea(blocks: readonly { constructionArea: Num | null }[]): Decimal {
  return blocks.reduce(
    (sum, block) => (block.constructionArea == null ? sum : sum.plus(dec(block.constructionArea))),
    new Decimal(0),
  );
}

/** Başlangıç + süre (ay) → tahmini bitiş tarihi (UTC, ay sonu taşmalarında ayın son günü). */
export function estimatedEndDate(start: Date | null, durationMonths: number | null): Date | null {
  if (!start || durationMonths == null) return null;
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + durationMonths;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)));
}
