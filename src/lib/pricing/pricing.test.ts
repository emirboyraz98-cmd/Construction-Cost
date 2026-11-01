import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { basePrice, priceUnits, profitSummary, requiredChangePercent, roundToStep, unitVatRate, withVat, type FactorKind, type PricingUnit } from "./pricing";

const d = (v: string | number) => new Decimal(v);
const money = (v: Decimal) => v.toFixed(2);
const table = (entries: Partial<Record<FactorKind, Record<string, number>>>) =>
  new Map(Object.entries(entries).map(([k, v]) => [k as FactorKind, new Map(Object.entries(v!).map(([key, val]) => [key, d(val)]))]));
const unit = (id: string, gross: number, extra: Partial<PricingUnit> = {}): PricingUnit => ({
  id,
  usageType: "RESIDENTIAL",
  grossArea: d(gross),
  extraArea: null,
  floor: 1,
  facade: null,
  view: null,
  layout: null,
  lockedPrice: null,
  ...extra,
});

describe("baz m² fiyatı (PLAN 7.5)", () => {
  // PLAN 7.7: maliyet 90 M, reklam 3 M, müteahhide kalan 1.320 m², komisyon %2, marj %25
  const plan = { cost: d(90_000_000), advertising: d(3_000_000), contractorGross: d(1320), commissionPercent: d(2) };

  it("PLAN 7.7 sayısal örneği: satış üzerinden %25 marj", () => {
    const r = basePrice({ ...plan, method: "MARGIN", profitPercent: d(25) });
    if (!r.ok) throw new Error(r.error);
    expect(money(r.costPerM2)).toBe("68181.82");
    expect(money(r.advertisingPerM2)).toBe("2272.73");
    expect(money(r.fullCostPerM2)).toBe("70454.55");
    // 70.454,55 / 0,73 = 96.513,08 (PLAN'da yuvarlanmış ara değerle ≈ 96.514)
    expect(money(r.baseM2)).toBe("96513.08");
    expect(money(r.breakEvenM2)).toBe("71892.39");
    expect(money(r.marginPercent)).toBe("25.00");
    // Karşılık: kâr / (maliyet + reklam) = 0,25 / 0,73 → %34,25 (komisyon dahil)
    expect(money(r.markupPercent)).toBe("34.25");
    // 120 m² daire, kat 1,05 × cephe 1,03 → ≈ 12,53 M (normalizasyon öncesi)
    expect(r.baseM2.times(120).times(1.05).times(1.03).div(1_000_000).toFixed(2)).toBe("12.53");
  });

  it("maliyet üzerine ekleme ve iki yöntemin tutarlılığı", () => {
    const markup = basePrice({ ...plan, method: "MARKUP", profitPercent: d("34.2465753") });
    const margin = basePrice({ ...plan, method: "MARGIN", profitPercent: d(25) });
    if (!markup.ok || !margin.ok) throw new Error("hesap yok");
    expect(money(markup.baseM2)).toBe(money(margin.baseM2));
    const plain = basePrice({ ...plan, commissionPercent: d(0), method: "MARKUP", profitPercent: d(20) });
    if (!plain.ok) throw new Error(plain.error);
    expect(money(plain.baseM2)).toBe("84545.45"); // 70.454,55 × 1,2
  });

  it("hatalı girdiler", () => {
    expect(basePrice({ ...plan, contractorGross: d(0), method: "MARGIN", profitPercent: d(25) }).ok).toBe(false);
    expect(basePrice({ ...plan, method: "MARGIN", profitPercent: d(98) }).ok).toBe(false);
  });
});

describe("bölüm fiyatları (PLAN 7.6)", () => {
  it("katsayılar dağılımı değiştirir, toplam hedef gelire eşitlenir", () => {
    const units = [unit("a", 100, { floor: 1 }), unit("b", 100, { floor: 5, facade: "G" }), unit("c", 120, { floor: 5 })];
    const r = priceUnits({
      targetRevenue: d(32_000_000),
      units,
      factors: table({ FLOOR: { "5": 1.1 }, FACADE: { G: 1.05 } }),
      extraAreaFactor: d(0),
      roundingStep: d(0),
    });
    // ham: 100×1 + 100×1,155 + 120×1,1 = 347,5 birim; 320 m² × 100.000 = 32 M
    expect(money(r.normalization!)).toBe("0.92");
    expect(r.units.map((u) => money(u.price))).toEqual(["9208633.09", "10635971.22", "12155395.68"]);
    expect(money(r.total)).toBe("31999999.99");
    expect(r.units[1].coefficient.toString()).toBe("1.155");
  });

  it("kullanım tipi oranı: dükkân = konut × 1,8; katsayı yoksa normalizasyon 1", () => {
    const r = priceUnits({
      targetRevenue: d(14_000_000),
      units: [unit("d", 100), unit("s", 50, { usageType: "SHOP", floor: 0 })],
      factors: table({ USAGE: { SHOP: 1.8 } }),
      extraAreaFactor: d(0),
      roundingStep: d(10_000),
    });
    // ağırlık = 100 + 50 × 1,8 = 190 → konut 73.684,21, dükkân 132.631,58 TL/m²
    expect(money(r.baseByUsage.get("RESIDENTIAL")!)).toBe("73684.21");
    expect(money(r.baseByUsage.get("SHOP")!)).toBe("132631.58");
    expect(r.normalization?.toString()).toBe("1");
    expect(r.units.map((u) => money(u.price))).toEqual(["7370000.00", "6630000.00"]);
  });

  it("kilitli (satılmış) bölüm sabit kalır, kalan hedef diğerlerine dağılır", () => {
    const r = priceUnits({
      targetRevenue: d(30_000_000),
      units: [unit("x", 100, { lockedPrice: d(8_000_000) }), unit("y", 100), unit("z", 100)],
      factors: table({}),
      extraAreaFactor: d(0),
      roundingStep: d(10_000),
    });
    expect(money(r.lockedTotal)).toBe("8000000.00");
    expect(r.units.map((u) => money(u.price))).toEqual(["8000000.00", "11000000.00", "11000000.00"]);
    expect(r.units[0].locked).toBe(true);
    expect(money(r.roundingDifference)).toBe("0.00");
  });

  it("kilitliler hedefi aşarsa uyarı verir; bahçe alanı oranla fiyata girer", () => {
    const over = priceUnits({ targetRevenue: d(5_000_000), units: [unit("x", 100, { lockedPrice: d(6_000_000) }), unit("y", 100)], factors: table({}), extraAreaFactor: d(0), roundingStep: d(0) });
    expect(over.warnings.length).toBe(1);
    expect(over.normalization).toBeNull();
    const garden = priceUnits({ targetRevenue: d(10_000_000), units: [unit("g", 100, { extraArea: d(40) }), unit("n", 100)], factors: table({}), extraAreaFactor: d("0.25"), roundingStep: d(0) });
    // fiyatlanan alan 110 ve 100 → 5,238 M ve 4,762 M
    expect(garden.units.map((u) => money(u.price))).toEqual(["5238095.24", "4761904.76"]);
  });

  it("yuvarlama adımı", () => {
    expect(money(roundToStep(d(12_534_999), d(10_000)))).toBe("12530000.00");
    expect(money(roundToStep(d(12_535_000), d(10_000)))).toBe("12540000.00");
    expect(money(roundToStep(d("1234.567"), d(0)))).toBe("1234.57");
  });
});

describe("KDV ve kâr", () => {
  const rule = { reducedRate: d(1), generalRate: d(20), reducedNetAreaLimit: d(150), reducedEligible: true };
  it("konut net alan sınırı, ticari bölüm ve elle oran", () => {
    expect(unitVatRate({ usageType: "RESIDENTIAL", netArea: d(150), override: null }, rule)?.toString()).toBe("1");
    expect(unitVatRate({ usageType: "RESIDENTIAL", netArea: d("150.01"), override: null }, rule)?.toString()).toBe("20");
    expect(unitVatRate({ usageType: "SHOP", netArea: d(40), override: null }, rule)?.toString()).toBe("20");
    expect(unitVatRate({ usageType: "RESIDENTIAL", netArea: d(90), override: null }, { ...rule, reducedEligible: false })?.toString()).toBe("20");
    expect(unitVatRate({ usageType: "SHOP", netArea: d(40), override: d(10) }, rule)?.toString()).toBe("10");
    expect(unitVatRate({ usageType: "SHOP", netArea: d(40), override: null }, { ...rule, generalRate: null })).toBeNull();
    expect(money(withVat(d(5_000_000), d(1))!)).toBe("5050000.00");
  });

  it("beklenen kâr ve gereken fiyat artışı", () => {
    const p = profitSummary({ revenue: d(127_397_270), cost: d(90_000_000), advertising: d(3_000_000), commissionPercent: d(2) });
    expect(money(p.commission)).toBe("2547945.40");
    expect(money(p.profit)).toBe("31849324.60");
    expect(p.marginPercent?.toString()).toBe("25");
    expect(requiredChangePercent([
      { current: d(10_000_000), next: d(11_000_000), locked: false },
      { current: d(9_000_000), next: d(9_000_000), locked: true },
      { current: null, next: d(5_000_000), locked: false },
    ])?.toString()).toBe("10");
  });
});
