import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { adjustmentFor, buildCashFlow, consolidate, landownerEffect, monthIndex, monthLabel, proposeSchedule, resolveSchedule, scenarioOutcome, tornado, type Assumptions, type PlannedItem } from "./cashflow";

const d = (v: string | number) => new Decimal(v);
const money = (v: Decimal) => v.toFixed(2);
const c = monthIndex(new Date("2026-10-15T00:00:00Z"));
const base: Assumptions = { openingCash: d(0), vatPercent: d(0), inflationPercent: d(0), fxPercent: d(0), interestPercent: d(0) };
const item = (code: string, remaining: number, start: number, end: number, extra: Partial<PlannedItem> = {}): PlannedItem => ({
  code,
  name: code,
  remainingNet: d(remaining),
  startMonth: start,
  endMonth: end,
  foreignShare: d(0),
  timeRelated: false,
  ...extra,
});

describe("aylar ve iş programı", () => {
  it("ay etiketi ve öneri", () => {
    expect(monthLabel(c)).toBe("Eki 2026");
    expect(proposeSchedule("05", 24)).toEqual({ startMonth: 3, endMonth: 12 });
    expect(proposeSchedule("03", 24)).toEqual({ startMonth: 1, endMonth: 24 });
    expect(proposeSchedule("99", 24)).toBeNull();
  });

  it("program kalemden, üst kalemden veya proje süresinden gelir", () => {
    const parents = new Map<string, string | null>([["05", null], ["05.05", "05"], ["08", null]]);
    const entries = new Map([["05", { startMonth: 3, endMonth: 12 }]]);
    expect(resolveSchedule("05.05", parents, entries, 24)).toEqual({ startMonth: 3, endMonth: 12, source: "parent" });
    expect(resolveSchedule("05", parents, entries, 24).source).toBe("own");
    expect(resolveSchedule("08", parents, entries, 24)).toEqual({ startMonth: 1, endMonth: 24, source: "project" });
  });
});

describe("nakit akışı (PLAN 7.8)", () => {
  it("gerçekleşen, vadesi geçen, dövizli ödeme, planlanan maliyet, tahsilat ve satış varsayımı", () => {
    const r = buildCashFlow({
      currentMonth: c,
      startMonth: c - 2,
      endMonth: c + 1,
      events: [
        { month: c - 2, amount: d(100), kind: "expense", done: true },
        { month: c - 1, amount: d(50), kind: "expense", done: false },
        { month: c + 1, amount: d(200), kind: "connection", done: false, foreign: true },
        { month: c - 1, amount: d(300), kind: "collection", done: true },
        { month: c - 3, amount: d(100), kind: "installment", done: false },
      ],
      planned: [item("05.05", 1200, c - 5, c + 2)],
      sales: { unsoldCount: 2, unsoldWithVat: d(2200), unsoldNet: d(2000), perMonth: d(1), startMonth: c, downPaymentPercent: d(50), installmentMonths: 2 },
      assumptions: { ...base, vatPercent: d(20), fxPercent: d(10) },
    });
    expect(r.firstMonth).toBe(c - 2);
    expect(r.lastMonth).toBe(c + 3);
    expect(r.rows.map((x) => money(x.balance))).toEqual(["-100.00", "200.00", "320.00", "445.00", "515.00", "790.00"]);
    const now = r.rows[2];
    // Vadesi geçen harcama (50) ve taksit (100) bu aya; planlanan 400 + %20 KDV
    expect(money(now.outExpense)).toBe("50.00");
    expect(money(now.outPlanned)).toBe("480.00");
    expect(money(now.inScheduled)).toBe("100.00");
    expect(money(now.inSales)).toBe("550.00");
    expect(money(r.rows[3].outConnection)).toBe("220.00");
    expect(money(r.plannedNet)).toBe("1200.00");
    expect(money(r.salesNet)).toBe("2000.00");
    expect(money(r.lowestBalance)).toBe("-100.00");
  });

  it("nakit açığına aylık finansman maliyeti (bileşik) ve enflasyon", () => {
    const fin = buildCashFlow({
      currentMonth: c,
      startMonth: c,
      endMonth: c + 2,
      events: [{ month: c + 2, amount: d(1000), kind: "installment", done: false }],
      planned: [item("05", 1000, c, c)],
      sales: null,
      assumptions: { ...base, interestPercent: d(1) },
    });
    expect(fin.rows.map((x) => money(x.outFinancing))).toEqual(["0.00", "10.00", "10.10"]);
    expect(money(fin.financingCost)).toBe("20.10");
    expect(money(fin.endBalance)).toBe("-20.10");
    const infl = buildCashFlow({ currentMonth: c, startMonth: c, endMonth: c + 2, events: [], planned: [item("08", 300, c, c + 2)], sales: null, assumptions: { ...base, inflationPercent: d(10) } });
    expect(infl.rows.map((x) => money(x.outPlanned))).toEqual(["100.00", "110.00", "121.00"]);
    expect(money(infl.plannedNet)).toBe("331.00");
  });
});

describe("senaryolar (PLAN 7.9)", () => {
  it("kalem öneki, kur payı ve gecikme", () => {
    expect(adjustmentFor("05.05", [{ code: "05", percent: d(10) }, { code: "05.05", percent: d(15) }]).toString()).toBe("15");
    expect(adjustmentFor("05.050", [{ code: "05.05", percent: d(15) }]).toString()).toBe("0");
    const r = buildCashFlow({
      currentMonth: c,
      startMonth: c,
      endMonth: c + 4,
      events: [],
      planned: [item("03.01", 1000, c, c + 4, { timeRelated: true }), item("05.05", 1000, c, c, { foreignShare: d("0.5") })],
      sales: null,
      assumptions: { ...base, fxPercent: d(20) },
      scenario: { adjustments: [{ code: "05", percent: d(10) }], delayMonths: 5, salesPriceChangePercent: d(0), salesSpeedPercent: d(100), unsoldAreaFactor: d(1) },
    });
    // 03: 5 ay → 10 ay, süreye bağlı gider 2 katına; 05.05: 1000 × 1,10 × (1 + 0,5 × 0,20) = 1210, gecikmeyle 6 aya yayılır
    expect(money(r.plannedNetByCode.get("03.01")!)).toBe("2000.00");
    expect(money(r.plannedNetByCode.get("05.05")!)).toBe("1210.00");
    expect(r.lastMonth).toBe(c + 9);
  });

  it("gecikmede teslime bağlı tahsilat ve satış başlangıcı ötelenir", () => {
    const r = buildCashFlow({
      currentMonth: c,
      startMonth: c,
      endMonth: c + 2,
      events: [
        { month: c + 2, amount: d(500), kind: "installment", done: false, shiftOnDelay: true },
        { month: c + 1, amount: d(100), kind: "installment", done: false },
      ],
      planned: [],
      sales: { unsoldCount: 1, unsoldWithVat: d(1000), unsoldNet: d(1000), perMonth: d(1), startMonth: c, downPaymentPercent: d(100), installmentMonths: 0 },
      assumptions: base,
      scenario: { adjustments: [], delayMonths: 3, salesPriceChangePercent: d(0), salesSpeedPercent: d(100), unsoldAreaFactor: d(1) },
    });
    const at = (m: number) => money(r.rows.find((x) => x.month === m)!.inTotal);
    expect(at(c + 1)).toBe("100.00");
    expect(at(c + 3)).toBe("1000.00");
    expect(at(c + 5)).toBe("500.00");
  });

  it("arsa payı etkisi, kâr ve gereken m² fiyatı", () => {
    const eff = landownerEffect({ sellableGross: d(2000), contractorGross: d(1100), soldGross: d(100) }, d(50));
    expect(money(eff.contractorGross)).toBe("1000.00");
    expect(eff.unsoldAreaFactor.toString()).toBe("0.9");
    const flow = buildCashFlow({ currentMonth: c, startMonth: c, endMonth: c, events: [], planned: [item("05", 600_000, c, c)], sales: { unsoldCount: 1, unsoldWithVat: d(1_100_000), unsoldNet: d(1_000_000), perMonth: d(1), startMonth: c, downPaymentPercent: d(100), installmentMonths: 0 }, assumptions: base });
    const o = scenarioOutcome(flow, { actualCost: d(400_000), connectionOpenNet: d(0), soldNet: d(500_000), soldGross: d(50), sellableGross: d(100), contractorGross: d(100), commissionPercent: d(2), profitMethod: "MARGIN", profitPercent: d(25) }, d(100));
    // gelir 1,5 M; komisyon 30 bin; maliyet 1 M → kâr 470 bin; gereken baz m² = 1 M / 100 / 0,73
    expect(money(o.revenue)).toBe("1500000.00");
    expect(money(o.profit)).toBe("470000.00");
    expect(o.marginPercent?.toString()).toBe("31.33");
    expect(money(o.requiredM2!)).toBe("13698.63");
    expect(money(o.peakNeed)).toBe("0.00");
  });

  it("en etkili kalemler ve şirket geneli toplama", () => {
    const flow = buildCashFlow({ currentMonth: c, startMonth: c, endMonth: c, events: [], planned: [item("05.05", 500, c, c), item("08.05", 2000, c, c)], sales: null, assumptions: base });
    const t = tornado(flow, new Map([["08.05", "Seramik"]]));
    expect(t.map((x) => `${x.label}:${money(x.impact)}`)).toEqual(["08.05 Seramik:200.00", "05.05:50.00"]);
    const rows = consolidate([flow, flow], [{ month: c + 1, amount: d(100), kind: "overhead", done: false }], d(5000), c);
    expect(rows.map((x) => money(x.balance))).toEqual(["0.00", "-100.00"]);
  });
});
