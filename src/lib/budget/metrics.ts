// Proje alan metrikleri, parametrik metraj ve gerçekleşen katsayı (PLAN.md 6; saf modül).
import Decimal from "decimal.js";
import type { CoefficientBasis, UnitOwner } from "@/generated/prisma/enums";

const zero = () => new Decimal(0);

export type MetricInput = {
  landArea: Decimal | null;
  blocks: { constructionArea: Decimal | null; floorCount: number | null; basementCount: number | null }[];
  units: { netArea: Decimal; grossArea: Decimal; owner: UnitOwner }[];
};

export type ProjectMetrics = {
  constructionArea: Decimal;
  sellableGross: Decimal;
  sellableNet: Decimal;
  contractorGross: Decimal;
  landownerGross: Decimal;
  landArea: Decimal;
  unitCount: number;
  blockCount: number;
  floorCount: number;
  basementCount: number;
};

export function projectMetrics(input: MetricInput): ProjectMetrics {
  const sum = (values: (Decimal | null)[]) => values.reduce<Decimal>((s, v) => s.plus(v ?? 0), zero());
  return {
    constructionArea: sum(input.blocks.map((b) => b.constructionArea)),
    sellableGross: sum(input.units.map((u) => u.grossArea)),
    sellableNet: sum(input.units.map((u) => u.netArea)),
    contractorGross: sum(input.units.filter((u) => u.owner === "CONTRACTOR").map((u) => u.grossArea)),
    landownerGross: sum(input.units.filter((u) => u.owner === "LANDOWNER").map((u) => u.grossArea)),
    landArea: input.landArea ?? zero(),
    unitCount: input.units.length,
    blockCount: input.blocks.length,
    floorCount: Math.max(0, ...input.blocks.map((b) => b.floorCount ?? 0)),
    basementCount: Math.max(0, ...input.blocks.map((b) => b.basementCount ?? 0)),
  };
}

export function basisValue(basis: CoefficientBasis, m: ProjectMetrics): Decimal {
  switch (basis) {
    case "CONSTRUCTION_AREA":
      return m.constructionArea;
    case "SELLABLE_GROSS":
      return m.sellableGross;
    case "SELLABLE_NET":
      return m.sellableNet;
    case "LAND_AREA":
      return m.landArea;
    case "UNIT_COUNT":
      return new Decimal(m.unitCount);
  }
}

/** Parametrik miktar = taban × katsayı (4 hane). */
export function parametricQuantity(basis: CoefficientBasis, coefficient: Decimal, m: ProjectMetrics): Decimal {
  return basisValue(basis, m).times(coefficient).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/** Gerçekleşen katsayı = gerçekleşen miktar / taban (taban 0 ise yok). */
export function actualCoefficient(actualQuantity: Decimal, basis: CoefficientBasis, m: ProjectMetrics): Decimal | null {
  const base = basisValue(basis, m);
  return base.isZero() ? null : actualQuantity.div(base).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

/** Formüllerde kullanılabilen değişkenler. */
export function formulaVariables(m: ProjectMetrics): Record<string, Decimal> {
  return {
    insaat_alani: m.constructionArea,
    brut_alan: m.sellableGross,
    net_alan: m.sellableNet,
    arsa_alani: m.landArea,
    bolum_sayisi: new Decimal(m.unitCount),
    blok_sayisi: new Decimal(m.blockCount),
    kat_sayisi: new Decimal(m.floorCount),
    bodrum_sayisi: new Decimal(m.basementCount),
  };
}

export const FORMULA_VARIABLE_LABELS: Record<string, string> = {
  insaat_alani: "Toplam inşaat alanı (m²)",
  brut_alan: "Bölümlerin satılabilir brüt alanı (m²)",
  net_alan: "Bölümlerin net alanı (m²)",
  arsa_alani: "Arsa alanı (m²)",
  bolum_sayisi: "Bağımsız bölüm sayısı",
  blok_sayisi: "Blok sayısı",
  kat_sayisi: "En yüksek kat adedi",
  bodrum_sayisi: "En fazla bodrum sayısı",
};
