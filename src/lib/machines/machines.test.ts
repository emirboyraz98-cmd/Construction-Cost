import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { monthIndex } from "@/lib/cashflow/cashflow";
import { combineMachineFlows, entryMonth, machineCashEvents, machineCashFlow, usageAmount, type MachineEntryInput, type MachineUsageInput } from "./machines";

const d = (v: string | number) => new Decimal(v);
const c = monthIndex(new Date("2026-10-15T00:00:00Z"));
const at = (offset: number) => new Date(Date.UTC(2026, 9 + offset, 10));
const money = (v: Decimal) => v.toFixed(0);

const entries: MachineEntryInput[] = [
  { date: at(-3), type: "PURCHASE", amount: d(3_000_000), paid: true, dueDate: null },
  { date: at(0), type: "FINANCING", amount: d(500_000), paid: false, dueDate: at(1) },
  { date: at(-2), type: "FUEL", amount: d(60_000), paid: true, dueDate: null },
  { date: at(-1), type: "FUEL", amount: d(80_000), paid: true, dueDate: null },
  { date: at(-2), type: "REPAIR", amount: d(40_000), paid: false, dueDate: at(-1) },
  { date: at(-1), type: "RENT_INCOME", amount: d(120_000), paid: true, dueDate: null },
];
const usages: MachineUsageInput[] = [
  { date: at(-2), quantity: d(100), amount: d(150_000) },
  { date: at(-1), quantity: d(200), amount: d(300_000) },
  { date: at(0), quantity: d(150), amount: d(225_000) },
];

describe("makine nakit akışı", () => {
  it("ödenmemiş hareket vadesine, vadesi geçmişse bu aya yazılır", () => {
    expect(entryMonth({ date: at(-2), paid: true, dueDate: null }, c)).toBe(c - 2);
    expect(entryMonth({ date: at(0), paid: false, dueDate: at(1) }, c)).toBe(c + 1);
    expect(entryMonth({ date: at(-2), paid: false, dueDate: at(-1) }, c)).toBe(c);
  });

  it("aylık ve kümülatif nakit, iç kullanım dahil kümülatif ve özetler", () => {
    const f = machineCashFlow(entries, usages, c);
    expect(f.rows.map((r) => r.month)).toEqual([c - 3, c - 2, c - 1, c, c + 1]);
    expect(f.rows.map((r) => money(r.cumulative))).toEqual(["-3000000", "-3060000", "-3020000", "-3060000", "-3560000"]);
    expect(f.rows.map((r) => money(r.cumulativeWithUsage))).toEqual(["-3000000", "-2910000", "-2570000", "-2385000", "-2885000"]);
    expect(f.rows.map((r) => r.past)).toEqual([true, true, true, false, false]);
    const t = f.totals;
    expect(money(t.cashIn)).toBe("120000");
    expect(money(t.cashOut)).toBe("3680000");
    expect(money(t.net)).toBe("-3560000");
    expect(money(t.usageValue)).toBe("675000");
    expect(t.usageQty.toString()).toBe("450");
    expect(money(t.netWithUsage)).toBe("-2885000");
    // Yakıt 140 bin + onarım 40 bin; satın alma ve kredi taksiti işletme maliyeti değildir
    expect(money(t.operatingCost)).toBe("180000");
    expect(t.operatingCostPerUnit?.toString()).toBe("400");
    expect(money(t.plannedOut)).toBe("540000");
    expect(f.paybackMonth).toBeNull();
  });

  it("geri dönüş ayı: iç kullanım dahil kümülatif sıfırı geçtiği ilk ay", () => {
    const f = machineCashFlow(
      [{ date: at(0), type: "PURCHASE", amount: d(100), paid: true, dueDate: null }],
      [
        { date: at(0), quantity: d(10), amount: d(60) },
        { date: at(1), quantity: d(10), amount: d(60) },
      ],
      c,
    );
    expect(f.rows.map((r) => money(r.cumulativeWithUsage))).toEqual(["-40", "20"]);
    expect(f.paybackMonth).toBe(c + 1);
  });

  it("filo toplamı ve şirket nakit akışına giden hareketler", () => {
    const a = machineCashFlow(entries, usages, c);
    const b = machineCashFlow([{ date: at(-1), type: "RENT_INCOME", amount: d(50_000), paid: true, dueDate: null }], [], c);
    const fleet = combineMachineFlows([a, b], c);
    expect(money(fleet.totals.cashIn)).toBe("170000");
    expect(money(fleet.totals.net)).toBe("-3510000");
    expect(fleet.rows.find((r) => r.month === c - 1)?.cashIn.toString()).toBe("170000");
    expect(money(fleet.rows[fleet.rows.length - 1].cumulative)).toBe("-3510000");
    const events = machineCashEvents(entries, c);
    expect(events.filter((e) => e.kind === "machineIn").map((e) => money(e.amount))).toEqual(["120000"]);
    expect(events.find((e) => !e.done && e.month === c + 1)?.kind).toBe("machineOut");
    expect(usageAmount(d("7.5"), d("1333.33")).toString()).toBe("9999.98");
  });
});
