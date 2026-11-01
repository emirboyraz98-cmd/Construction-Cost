import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { addMonths, allocateCollections, buildPlan, contractAmounts, isCounted, planTotal, reservationActive, unitSaleStatus } from "./sales";

const d = (v: string | number) => new Decimal(v);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const money = (v: Decimal) => v.toFixed(2);
const iso = (v: Date) => v.toISOString().slice(0, 10);

describe("sözleşme ve ödeme planı", () => {
  it("indirim ve KDV", () => {
    const a = contractAmounts({ listPrice: d(3_050_000), discount: d(50_000), vatRate: d(10) });
    expect(money(a.salePrice)).toBe("3000000.00");
    expect(money(a.vatAmount)).toBe("300000.00");
    expect(money(a.totalAmount)).toBe("3300000.00");
  });

  it("ay sonu taksit tarihleri", () => {
    expect(iso(addMonths(day("2026-01-31"), 1))).toBe("2026-02-28");
    expect(iso(addMonths(day("2026-11-15"), 3))).toBe("2027-02-15");
  });

  it("peşinat + ara ödeme + anahtar teslim + eşit taksitler; toplam korunur", () => {
    const { rows, error } = buildPlan({
      total: d(3_300_000),
      downPayment: { amount: d(1_000_000), date: day("2026-11-01") },
      fixed: [
        { dueDate: day("2027-06-01"), amount: d(500_000), kind: "INTERIM", note: "Ara ödeme" },
        { dueDate: day("2027-12-01"), amount: d(300_000), kind: "KEY_DELIVERY", note: null },
      ],
      installments: { count: 12, firstDate: day("2026-12-01"), intervalMonths: 1 },
    });
    expect(error).toBeNull();
    expect(rows.length).toBe(15);
    expect(money(planTotal(rows))).toBe("3300000.00");
    // 1,5 M / 12 = 125.000
    expect(rows.filter((r) => r.kind === "INSTALLMENT").every((r) => money(r.amount) === "125000.00")).toBe(true);
    expect(iso(rows[0].dueDate)).toBe("2026-11-01");
    expect(rows[rows.length - 1].kind).toBe("KEY_DELIVERY");
  });

  it("bölünemeyen tutarda kuruş farkı son taksitte; aşım ve eksik bilgi hatası", () => {
    const { rows } = buildPlan({ total: d(1000), downPayment: null, fixed: [], installments: { count: 3, firstDate: day("2026-12-01"), intervalMonths: 2 } });
    expect(rows.map((r) => money(r.amount))).toEqual(["333.33", "333.33", "333.34"]);
    expect(iso(rows[2].dueDate)).toBe("2027-04-01");
    expect(buildPlan({ total: d(1000), downPayment: { amount: d(1200), date: day("2026-11-01") }, fixed: [], installments: null }).error).not.toBeNull();
    expect(buildPlan({ total: d(1000), downPayment: { amount: d(400), date: day("2026-11-01") }, fixed: [], installments: null }).error).not.toBeNull();
  });
});

describe("tahsilat dağıtımı", () => {
  const plan = [
    { id: "p", dueDate: day("2026-10-01"), amount: d(1000) },
    { id: "t1", dueDate: day("2026-10-20"), amount: d(500) },
    { id: "t2", dueDate: day("2026-11-03"), amount: d(500) },
    { id: "t3", dueDate: day("2026-12-01"), amount: d(500) },
  ];

  it("kısmi ödeme, gecikme ve yaklaşan vade", () => {
    const r = allocateCollections(plan, d(1200), day("2026-10-31"));
    expect(r.rows.map((x) => x.state)).toEqual(["PAID", "OVERDUE", "DUE_SOON", "UPCOMING"]);
    expect(money(r.rows[1].paid)).toBe("200.00");
    expect(money(r.rows[1].remaining)).toBe("300.00");
    expect(r.rows[1].daysOverdue).toBe(11);
    expect(money(r.overdue)).toBe("300.00");
    expect(money(r.remaining)).toBe("1300.00");
    expect(r.nextDue?.id).toBe("t1");
  });

  it("portföydeki çekle karşılanan taksit gecikmiş sayılmaz, kalan alacak düşmez", () => {
    const r = allocateCollections(plan, d(1200), day("2026-10-31"), d(300));
    expect(r.rows[1].state).toBe("PAPER");
    expect(money(r.rows[1].paper)).toBe("300.00");
    expect(money(r.overdue)).toBe("0.00");
    expect(money(r.remaining)).toBe("1300.00");
    const partial = allocateCollections(plan, d(1200), day("2026-10-31"), d(100));
    expect(partial.rows[1].state).toBe("OVERDUE");
    expect(money(partial.overdue)).toBe("200.00");
  });

  it("fazla ödeme ayrıca gösterilir", () => {
    const r = allocateCollections(plan, d(2600), day("2026-10-31"));
    expect(r.rows.every((x) => x.state === "PAID")).toBe(true);
    expect(money(r.overpaid)).toBe("100.00");
    expect(r.nextDue).toBeNull();
  });

  it("çek / senet tahsil edilince sayılır, karşılıksız sayılmaz", () => {
    expect(isCounted({ method: "BANK_TRANSFER", chequeStatus: null })).toBe(true);
    expect(isCounted({ method: "CHEQUE", chequeStatus: "PENDING" })).toBe(false);
    expect(isCounted({ method: "CHEQUE", chequeStatus: "CLEARED" })).toBe(true);
    expect(isCounted({ method: "PROMISSORY_NOTE", chequeStatus: "BOUNCED" })).toBe(false);
  });
});

describe("rezervasyon ve bölüm durumu", () => {
  it("süresi dolan rezervasyon boşa düşer (bitiş günü dahil)", () => {
    expect(reservationActive({ status: "ACTIVE", expiresAt: day("2026-10-31") }, day("2026-10-31"))).toBe(true);
    expect(reservationActive({ status: "ACTIVE", expiresAt: day("2026-10-30") }, day("2026-10-31"))).toBe(false);
    expect(reservationActive({ status: "CANCELLED", expiresAt: day("2026-12-30") }, day("2026-10-31"))).toBe(false);
  });

  it("öncelik: arsa sahibi → satıldı → rezerve → boş", () => {
    expect(unitSaleStatus({ owner: "LANDOWNER", hasActiveContract: false, hasActiveReservation: true })).toBe("LANDOWNER");
    expect(unitSaleStatus({ owner: "CONTRACTOR", hasActiveContract: true, hasActiveReservation: true })).toBe("SOLD");
    expect(unitSaleStatus({ owner: "CONTRACTOR", hasActiveContract: false, hasActiveReservation: true })).toBe("RESERVED");
    expect(unitSaleStatus({ owner: "CONTRACTOR", hasActiveContract: false, hasActiveReservation: false })).toBe("AVAILABLE");
  });
});
