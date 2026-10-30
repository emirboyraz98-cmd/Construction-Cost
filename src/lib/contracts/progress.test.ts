import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { computeProgressBilling, contractProgress, progressCostRows, type ProgressInput } from "./progress";

const d = (v: string | number) => new Decimal(v);
const money = (v: Decimal) => v.toFixed(2);

// Kaba inşaat taşeronu: 2 kalem, %20 KDV, 4/10 tevkifat, %5 teminat, %20 avans mahsubu.
const base: ProgressInput = {
  lines: [
    { contractItemId: "k1", description: "Kalıp işçiliği", unit: "m²", unitPrice: d(350), contractQuantity: d(10000), previousQuantity: d(2000), cumulativeQuantity: d(5000) },
    { contractItemId: "k2", description: "Demir işçiliği", unit: "ton", unitPrice: d(4500), contractQuantity: d(400), previousQuantity: d(50), cumulativeQuantity: d(150) },
  ],
  terms: { vatRate: d(20), vatWithholdingRate: d(40), retentionRate: d(5), advanceOffsetRate: d(20) },
  openAdvance: d(500000),
  advanceOffset: null,
  materialOffset: d(0),
  otherDeductions: d(0),
};

describe("hakediş hesabı", () => {
  it("dönem miktarı, brüt, KDV, tevkifat, teminat, avans mahsubu ve net ödeme", () => {
    const r = computeProgressBilling(base);
    expect(r.errors).toEqual([]);
    // 3.000 m² × 350 = 1.050.000; 100 ton × 4.500 = 450.000
    expect(r.lines.map((l) => money(l.amount))).toEqual(["1050000.00", "450000.00"]);
    expect(money(r.grossAmount)).toBe("1500000.00");
    expect(money(r.vatAmount)).toBe("300000.00");
    expect(money(r.vatWithheld)).toBe("120000.00");
    expect(money(r.retention)).toBe("75000.00");
    expect(money(r.suggestedAdvanceOffset)).toBe("300000.00");
    // 1.500.000 + 300.000 − 120.000 − 75.000 − 300.000
    expect(money(r.payableAmount)).toBe("1305000.00");
  });

  it("avans mahsubu açık avansla sınırlı; elle girilen fazlası hata", () => {
    const limited = computeProgressBilling({ ...base, openAdvance: d(100000) });
    expect(money(limited.advanceOffset)).toBe("100000.00");
    const tooMuch = computeProgressBilling({ ...base, openAdvance: d(100000), advanceOffset: d(150000) });
    expect(tooMuch.errors[0]).toContain("aşamaz");
  });

  it("kümülatif miktar geriye gidemez; sözleşme miktarı aşılırsa uyarı", () => {
    const back = computeProgressBilling({ ...base, lines: [{ ...base.lines[0], cumulativeQuantity: d(1500) }] });
    expect(back.errors[0]).toContain("önceki hakedişlerin");
    const over = computeProgressBilling({ ...base, lines: [{ ...base.lines[0], cumulativeQuantity: d(10500) }] });
    expect(over.errors).toEqual([]);
    expect(over.warnings[0]).toContain("aşıldı");
  });

  it("kesintiler net ödemeyi negatife düşüremez", () => {
    const r = computeProgressBilling({ ...base, otherDeductions: d(2000000) });
    expect(r.errors.some((e) => e.includes("negatif"))).toBe(true);
  });

  it("maliyet satırları: kalem başına brüt − oranla dağıtılan malzeme mahsubu; toplam korunur", () => {
    const rows = progressCostRows(
      [
        { costItemId: "05.07", amount: d("1050000") },
        { costItemId: "05.03", amount: d("450000") },
        { costItemId: "05.07", amount: d("0") },
      ],
      d("100000.01"),
      d("300000"),
    );
    expect(rows.map((r) => [r.costItemId, money(r.netAmount), money(r.vatAmount)])).toEqual([
      ["05.07", "979999.99", "210000.00"],
      ["05.03", "420000.00", "90000.00"],
    ]);
    const net = rows.reduce((s, r) => s.plus(r.netAmount), d(0));
    expect(money(net)).toBe("1399999.99");
  });

  it("sözleşme ilerlemesi", () => {
    const p = contractProgress([
      { quantity: d(10000), unitPrice: d(350), doneQuantity: d(5000) },
      { quantity: d(400), unitPrice: d(4500), doneQuantity: d(150) },
    ]);
    expect(money(p.contractAmount)).toBe("5300000.00");
    expect(money(p.doneAmount)).toBe("2425000.00");
    expect(p.percent.toString()).toBe("45.8");
  });
});
