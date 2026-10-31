// Fiyatlandırma (PLAN.md 7.4–7.6; saf modül): reklam ve komisyon, iki kâr yöntemi, kullanım tipine
// göre baz fiyat, katsayılar, normalizasyon, yuvarlama, KDV ve kilitli (satılmış) bölümler.
import Decimal from "decimal.js";
import type { ProfitMethod, UsageType } from "@/generated/prisma/enums";
import { roundMoney } from "../expenses/amounts";

const zero = () => new Decimal(0);
const one = () => new Decimal(1);

export type BaseInput = {
  /** Komisyon ve reklam hariç toplam maliyet (tüm bina; PLAN 7.3) */
  cost: Decimal;
  /** Sabit reklam bütçesi; müteahhit satılabilir m²'sine dağıtılır (PLAN 7.4) */
  advertising: Decimal;
  /** Müteahhide kalan satılabilir brüt m² */
  contractorGross: Decimal;
  commissionPercent: Decimal;
  method: ProfitMethod;
  profitPercent: Decimal;
};

export type BaseResult =
  | {
      ok: true;
      costPerM2: Decimal;
      advertisingPerM2: Decimal;
      /** Maliyet + reklam m² */
      fullCostPerM2: Decimal;
      /** Baz m² satış fiyatı (KDV hariç) */
      baseM2: Decimal;
      /** Kâr = 0 iken m² fiyatı */
      breakEvenM2: Decimal;
      /** Müteahhit bölümlerinden elde edilmesi gereken toplam gelir */
      targetRevenue: Decimal;
      /** Diğer yöntemdeki karşılık: satış üzerinden marj % ve maliyet üzerine ekleme % */
      marginPercent: Decimal;
      markupPercent: Decimal;
    }
  | { ok: false; error: string };

/**
 * Satış üzerinden marj:   Baz m² = (m² maliyet + reklam m²) / (1 − komisyon − marj)
 * Maliyet üzerine ekleme: Baz m² = (m² maliyet + reklam m²) × (1 + kâr) / (1 − komisyon)
 * Karşılıklar komisyon dahil hesaplanır: kâr = gelir × marj = (maliyet + reklam) × ekleme.
 */
export function basePrice(input: BaseInput): BaseResult {
  if (!input.contractorGross.gt(0)) return { ok: false, error: "Müteahhide kalan satılabilir alan yok; bağımsız bölümleri girin." };
  const k = input.commissionPercent.div(100);
  const p = input.profitPercent.div(100);
  const fullCost = input.cost.plus(input.advertising);
  const fullCostPerM2 = fullCost.div(input.contractorGross);
  const afterCommission = one().minus(k);
  if (!afterCommission.gt(0)) return { ok: false, error: "Komisyon %100'den küçük olmalı." };
  let baseM2: Decimal;
  if (input.method === "MARGIN") {
    const denominator = afterCommission.minus(p);
    if (!denominator.gt(0)) return { ok: false, error: "Komisyon + marj %100'den küçük olmalı." };
    baseM2 = fullCostPerM2.div(denominator);
  } else {
    baseM2 = fullCostPerM2.times(one().plus(p)).div(afterCommission);
  }
  const targetRevenue = roundMoney(baseM2.times(input.contractorGross));
  const profit = targetRevenue.times(afterCommission).minus(fullCost);
  return {
    ok: true,
    costPerM2: roundMoney(input.cost.div(input.contractorGross)),
    advertisingPerM2: roundMoney(input.advertising.div(input.contractorGross)),
    fullCostPerM2: roundMoney(fullCostPerM2),
    baseM2: roundMoney(baseM2),
    breakEvenM2: roundMoney(fullCostPerM2.div(afterCommission)),
    targetRevenue,
    marginPercent: targetRevenue.gt(0) ? profit.div(targetRevenue).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : zero(),
    markupPercent: fullCost.gt(0) ? profit.div(fullCost).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : zero(),
  };
}

/** En yakın adıma yuvarlar (adım 0 ise kuruşa). */
export function roundToStep(value: Decimal, step: Decimal): Decimal {
  if (!step.gt(0)) return roundMoney(value);
  return value.div(step).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(step);
}

export type FactorKind = "USAGE" | "FLOOR" | "FACADE" | "VIEW" | "LAYOUT";

/** Katsayı tablosu: tür → değer anahtarı → katsayı. Olmayan anahtar 1,00 sayılır (PLAN 7.6). */
export type FactorTable = ReadonlyMap<FactorKind, ReadonlyMap<string, Decimal>>;

export const factorKey = (value: string | number | null | undefined) => (value == null ? "" : String(value).trim());

export function factorOf(table: FactorTable, kind: FactorKind, key: string): Decimal {
  return table.get(kind)?.get(key) ?? one();
}

export type PricingUnit = {
  id: string;
  usageType: UsageType;
  grossArea: Decimal;
  extraArea: Decimal | null;
  floor: number;
  facade: string | null;
  view: string | null;
  layout: string | null;
  /** Kilitli (satılmış) bölümün sabit fiyatı; null ise yeniden fiyatlanır */
  lockedPrice: Decimal | null;
};

export type PricedUnit = {
  id: string;
  /** Kullanım tipine göre baz m² (KDV hariç) */
  baseM2: Decimal;
  /** Bahçe / teras ek alanı dahil fiyatlanan alan */
  pricedArea: Decimal;
  /** Kat × cephe × manzara × tip */
  coefficient: Decimal;
  /** Normalizasyon öncesi fiyat */
  rawPrice: Decimal;
  /** Son fiyat (KDV hariç, yuvarlanmış) */
  price: Decimal;
  locked: boolean;
};

export type PricingResult = {
  units: PricedUnit[];
  /** Kullanım tipine göre baz m² */
  baseByUsage: Map<UsageType, Decimal>;
  lockedTotal: Decimal;
  /** Kilitsiz bölümlere düşen hedef gelir */
  unlockedTarget: Decimal;
  /** Kilitsiz bölümlerin normalizasyon katsayısı (katsayılar kârı bozmasın diye) */
  normalization: Decimal | null;
  total: Decimal;
  /** Yuvarlama nedeniyle hedef gelirden fark */
  roundingDifference: Decimal;
  warnings: string[];
};

/**
 * Bölüm fiyatı = baz m² (kullanım tipine göre) × (brüt m² + ek alan × ek alan oranı) × katsayılar;
 * ardından kilitsiz bölümlerin toplamı (hedef gelir − kilitli bölümler) değerine eşitlenir ve yuvarlanır.
 * Kullanım tipi oranları (ör. dükkân = konut × 1,8) tek maliyet havuzunu tiplere paylaştırır.
 */
export function priceUnits(input: {
  targetRevenue: Decimal;
  units: readonly PricingUnit[];
  factors: FactorTable;
  extraAreaFactor: Decimal;
  roundingStep: Decimal;
}): PricingResult {
  const warnings: string[] = [];
  const usageRatio = (u: UsageType) => factorOf(input.factors, "USAGE", u);
  const pricedArea = (u: PricingUnit) => u.grossArea.plus((u.extraArea ?? zero()).times(input.extraAreaFactor));

  // Kullanım tipi baz fiyatları: Σ baz × alan = hedef gelir olacak şekilde.
  const weighted = input.units.reduce((s, u) => s.plus(usageRatio(u.usageType).times(u.grossArea)), zero());
  const totalGross = input.units.reduce((s, u) => s.plus(u.grossArea), zero());
  const baseByUsage = new Map<UsageType, Decimal>();
  for (const u of input.units) {
    if (!baseByUsage.has(u.usageType)) {
      baseByUsage.set(u.usageType, weighted.gt(0) ? roundMoney(input.targetRevenue.div(weighted).times(usageRatio(u.usageType))) : zero());
    }
  }
  const baseExact = (u: PricingUnit) => (weighted.gt(0) ? input.targetRevenue.div(weighted).times(usageRatio(u.usageType)) : zero());

  const draft = input.units.map((u) => {
    const coefficient = factorOf(input.factors, "FLOOR", factorKey(u.floor))
      .times(factorOf(input.factors, "FACADE", factorKey(u.facade)))
      .times(factorOf(input.factors, "VIEW", factorKey(u.view)))
      .times(factorOf(input.factors, "LAYOUT", factorKey(u.layout)));
    const area = pricedArea(u);
    return { u, coefficient, area, raw: baseExact(u).times(area).times(coefficient) };
  });

  const lockedTotal = input.units.reduce((s, u) => s.plus(u.lockedPrice ?? 0), zero());
  const unlockedTarget = input.targetRevenue.minus(lockedTotal);
  const rawUnlocked = draft.filter((x) => !x.u.lockedPrice).reduce((s, x) => s.plus(x.raw), zero());
  let normalization: Decimal | null = rawUnlocked.gt(0) ? unlockedTarget.div(rawUnlocked) : null;
  if (normalization && normalization.lte(0)) {
    warnings.push("Kilitli bölümlerin toplamı hedef geliri karşılıyor; kalan bölümler hedef gelire göre fiyatlanamaz.");
    normalization = null;
  }
  if (totalGross.gt(0) && !weighted.gt(0)) warnings.push("Kullanım tipi oranları sıfır; fiyat hesaplanamadı.");

  const units = draft.map(({ u, coefficient, area, raw }) => {
    const locked = u.lockedPrice != null;
    const price = locked ? u.lockedPrice! : normalization ? roundToStep(raw.times(normalization), input.roundingStep) : roundToStep(raw, input.roundingStep);
    return { id: u.id, baseM2: roundMoney(baseExact(u)), pricedArea: area, coefficient: coefficient.toDecimalPlaces(4, Decimal.ROUND_HALF_UP), rawPrice: roundMoney(raw), price, locked };
  });
  const total = units.reduce((s, u) => s.plus(u.price), zero());
  return {
    units,
    baseByUsage,
    lockedTotal,
    unlockedTarget,
    normalization: normalization ? normalization.toDecimalPlaces(6, Decimal.ROUND_HALF_UP) : null,
    total,
    roundingDifference: total.minus(input.targetRevenue),
    warnings,
  };
}

export type VatRule = {
  /** Konut indirimli oran (ör. %1), genel oran (ör. %20) ve indirimli oranın net alan sınırı (ör. 150 m²) */
  reducedRate: Decimal | null;
  generalRate: Decimal | null;
  reducedNetAreaLimit: Decimal | null;
  /** Projedeki konutlar indirimli oran şartlarını (arsa değeri, ruhsat tarihi vb.) sağlıyor mu */
  reducedEligible: boolean;
};

/** Bölümün satış KDV oranı: elle girilen oran önce gelir; oranlar parametre tablosundan okunur. */
export function unitVatRate(unit: { usageType: UsageType; netArea: Decimal; override: Decimal | null }, rule: VatRule): Decimal | null {
  if (unit.override) return unit.override;
  const reduced =
    unit.usageType === "RESIDENTIAL" &&
    rule.reducedEligible &&
    rule.reducedRate != null &&
    rule.reducedNetAreaLimit != null &&
    unit.netArea.lte(rule.reducedNetAreaLimit);
  return reduced ? rule.reducedRate : rule.generalRate;
}

export const withVat = (price: Decimal, rate: Decimal | null) => (rate ? roundMoney(price.times(rate.div(100).plus(1))) : null);

/** Beklenen kâr: gelir − komisyon − maliyet − reklam. */
export function profitSummary(input: { revenue: Decimal; cost: Decimal; advertising: Decimal; commissionPercent: Decimal }) {
  const commission = roundMoney(input.revenue.times(input.commissionPercent).div(100));
  const fullCost = input.cost.plus(input.advertising);
  const profit = input.revenue.minus(commission).minus(fullCost);
  return {
    commission,
    profit,
    marginPercent: input.revenue.gt(0) ? profit.div(input.revenue).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null,
    markupPercent: fullCost.gt(0) ? profit.div(fullCost).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null,
  };
}

/** Yeni fiyatların onaylı listeye göre değişimi (yalnızca kilitsiz bölümler): hedef kâr için gereken artış. */
export function requiredChangePercent(pairs: readonly { current: Decimal | null; next: Decimal; locked: boolean }[]): Decimal | null {
  const open = pairs.filter((p) => !p.locked && p.current?.gt(0));
  const current = open.reduce((s, p) => s.plus(p.current!), zero());
  if (!current.gt(0)) return null;
  const next = open.reduce((s, p) => s.plus(p.next), zero());
  return next.div(current).minus(1).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
