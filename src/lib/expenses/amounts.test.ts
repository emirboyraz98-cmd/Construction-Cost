import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { computeExpenseAmounts, impliedVatRate } from "./amounts";
import { allocateByWeights, ratiosFromWeights, splitExpenseAmounts } from "./split";

const d = (v: string | number) => new Decimal(v);
const str = (a: ReturnType<typeof computeExpenseAmounts>) =>
  Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.toFixed(2)]));

describe("harcama tutarları", () => {
  it("KDV dahil tutardan matrah ve KDV ayırır", () => {
    const a = computeExpenseAmounts({ mode: "total", amount: d(1200), includesVat: true, vatRate: d(20), exchangeRate: d(1) });
    expect(str(a)).toMatchObject({ netAmount: "1000.00", vatAmount: "200.00", totalAmount: "1200.00" });
  });

  it("yuvarlamada matrah + KDV = toplam korunur", () => {
    const a = computeExpenseAmounts({ mode: "total", amount: d(100), includesVat: true, vatRate: d(20), exchangeRate: d(1) });
    expect(str(a)).toMatchObject({ netAmount: "83.33", vatAmount: "16.67", totalAmount: "100.00" });
  });

  it("KDV hariç tutara KDV ekler", () => {
    const a = computeExpenseAmounts({ mode: "total", amount: d("4250.75"), includesVat: false, vatRate: d(10), exchangeRate: d(1) });
    expect(str(a)).toMatchObject({ netAmount: "4250.75", vatAmount: "425.08", totalAmount: "4675.83" });
  });

  it("miktar × birim fiyat (ör. 12,5 ton demir × 23.450 TL)", () => {
    const a = computeExpenseAmounts({ mode: "unit", quantity: d("12.5"), unitPrice: d(23450), vatRate: d(20), exchangeRate: d(1) });
    expect(str(a)).toMatchObject({ netAmount: "293125.00", vatAmount: "58625.00", totalAmount: "351750.00" });
  });

  it("döviz tutarını işlem kuruyla TL'ye çevirir", () => {
    const a = computeExpenseAmounts({ mode: "total", amount: d(1000), includesVat: false, vatRate: d(20), exchangeRate: d("34.5678") });
    expect(str(a)).toEqual({
      netAmount: "1000.00",
      vatAmount: "200.00",
      totalAmount: "1200.00",
      netAmountTry: "34567.80",
      vatAmountTry: "6913.56",
      totalAmountTry: "41481.36",
    });
  });

  it("belgedeki matrah ve KDV'yi olduğu gibi kullanır, oranı türetir", () => {
    const a = computeExpenseAmounts({ mode: "explicit", netAmount: d("1000.01"), vatAmount: d("199.99"), exchangeRate: d(1) });
    expect(a.totalAmount.toFixed(2)).toBe("1200.00");
    expect(impliedVatRate(d(1000), d(200)).toString()).toBe("20");
  });
});

describe("faturanın projelere bölünmesi", () => {
  it("kuruşları kaybetmeden böler (100 TL / 3 proje)", () => {
    const parts = allocateByWeights(d(100), [d(1), d(1), d(1)]);
    expect(parts.map((p) => p.toFixed(2))).toEqual(["33.34", "33.33", "33.33"]);
    expect(parts.reduce((s, p) => s.plus(p), d(0)).toFixed(2)).toBe("100.00");
  });

  it("alan oranına göre böler", () => {
    const parts = allocateByWeights(d("10000.00"), [d("3000"), d("2150.75")]);
    expect(parts.map((p) => p.toFixed(2))).toEqual(["5824.39", "4175.61"]);
    expect(ratiosFromWeights([d(3000), d("2150.75")]).map((r) => r.toString())).toEqual(["0.582439", "0.417561"]);
  });

  it("her satırda matrah + KDV = toplam, satır toplamları fatura toplamına eşit", () => {
    const invoice = computeExpenseAmounts({ mode: "total", amount: d("12345.67"), includesVat: true, vatRate: d(20), exchangeRate: d(1) });
    const rows = splitExpenseAmounts(invoice, [d(45), d(35), d(20)]);
    for (const row of rows) expect(row.netAmount.plus(row.vatAmount).eq(row.totalAmount)).toBe(true);
    for (const key of Object.keys(invoice) as (keyof typeof invoice)[]) {
      const sum = rows.reduce((s, r) => s.plus(r[key]), d(0));
      expect(sum.eq(invoice[key])).toBe(true);
    }
  });

  it("geçersiz oranları reddeder", () => {
    expect(() => allocateByWeights(d(10), [])).toThrow();
    expect(() => allocateByWeights(d(10), [d(0), d(0)])).toThrow();
    expect(() => allocateByWeights(d(10), [d(-1), d(2)])).toThrow();
  });
});
