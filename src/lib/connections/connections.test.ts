import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { connectionAlerts, type AlertInput } from "./alerts";
import { advanceBalance, itemBalance, planDraw, validateAllocations } from "./balance";
import { invoiceAmounts, invoiceWarnings, type ItemRef } from "./invoices";

const d = (v: string | number) => new Decimal(v);

describe("bağlantı bakiyesi", () => {
  // 500 ton demir: A'ya 300, B'ye 150 tahsis; 50 ton havuzda (PLAN 9.3 örneği)
  const allocations = [
    { projectId: "A", quantity: d(300) },
    { projectId: "B", quantity: d(150) },
  ];
  const draws = [
    { projectId: "A", quantity: d(120), approvalStatus: "APPROVED" as const },
    { projectId: "A", quantity: d(30), approvalStatus: "PENDING" as const },
    { projectId: "B", quantity: d(150), approvalStatus: "APPROVED" as const },
  ];
  const balance = itemBalance(d(500), allocations, draws);

  it("toplam = çekilen + kalan; havuz = toplam − tahsis", () => {
    expect(balance.drawn.toString()).toBe("300");
    expect(balance.drawnApproved.toString()).toBe("270");
    expect(balance.remaining.toString()).toBe("200");
    expect(balance.drawn.plus(balance.remaining).eq(balance.total)).toBe(true);
    expect(balance.pool.toString()).toBe("50");
    expect(balance.byProject.find((p) => p.projectId === "A")?.remaining.toString()).toBe("150");
  });

  it("çekiş önce projenin tahsisinden, yetmezse havuzdan düşer", () => {
    expect(planDraw(balance, "A", d(100), "ton")).toEqual({ ok: true, fromPool: d(0) });
    const fromPool = planDraw(balance, "B", d(40), "ton");
    expect(fromPool.ok && fromPool.fromPool.toString()).toBe("40");
    const tooMuch = planDraw(balance, "B", d(60), "ton");
    expect(tooMuch.ok).toBe(false);
    if (!tooMuch.ok) expect(tooMuch.error).toContain("50 ton");
    // tahsisi olmayan proje yalnızca havuzdan çekebilir
    const c = planDraw(balance, "C", d(50), "ton");
    expect(c.ok && c.fromPool.toString()).toBe("50");
    expect(planDraw(balance, "A", d(0), "ton").ok).toBe(false);
  });

  it("tahsisler bağlantı miktarını ve çekilmiş miktarın altını aşamaz", () => {
    const drawn = new Map([
      ["A", d(150)],
      ["B", d(150)],
    ]);
    expect(validateAllocations(d(500), "ton", [{ projectId: "A", quantity: d(350) }, { projectId: "B", quantity: d(150) }], drawn)).toEqual([]);
    expect(validateAllocations(d(500), "ton", [{ projectId: "A", quantity: d(360) }, { projectId: "B", quantity: d(150) }], drawn)[0]).toContain("aşıyor");
    expect(validateAllocations(d(500), "ton", [{ projectId: "A", quantity: d(100) }, { projectId: "B", quantity: d(150) }], drawn)[0]).toContain("altına inemez");
    expect(validateAllocations(d(500), "ton", [{ projectId: "B", quantity: d(150) }], drawn)[0]).toContain("kaldırılamaz");
    expect(validateAllocations(d(500), "ton", [{ projectId: "A", quantity: d(-1) }], new Map())[0]).toContain("negatif");
  });

  it("avans bakiyesi = ödenen − teslim alınan", () => {
    expect(advanceBalance(d(1_000_000), d(640_000)).toString()).toBe("360000");
    expect(advanceBalance(d(0), d(10)).toString()).toBe("-10");
  });
});

describe("bağlantı faturası eşleştirme", () => {
  const items = new Map<string, ItemRef>([
    ["i1", { id: "i1", description: "Nervürlü demir Ø12", unit: "ton", quantity: d(500), unitPrice: d(24000), invoiced: d(100), drawnApproved: d(150) }],
  ]);

  it("tutarları satır bazında yuvarlayarak toplar", () => {
    const a = invoiceAmounts([{ itemId: "i1", quantity: d("12.345"), unitPrice: d("24000"), vatRate: d(20) }]);
    expect(a.netAmount.toFixed(2)).toBe("296280.00");
    expect(a.vatAmount.toFixed(2)).toBe("59256.00");
    expect(a.totalAmount.toFixed(2)).toBe("355536.00");
  });

  it("bağlantı fiyatıyla aynıysa ve miktar teslimatı aşmıyorsa uyarı yok", () => {
    expect(invoiceWarnings([{ itemId: "i1", quantity: d(50), unitPrice: d(24000), vatRate: d(20) }], items)).toEqual([]);
  });

  it("fiyat farkını ve teslim alınandan fazla faturayı bildirir", () => {
    const w = invoiceWarnings([{ itemId: "i1", quantity: d(60), unitPrice: d(25200), vatRate: d(20) }], items);
    expect(w).toHaveLength(2);
    expect(w[0]).toContain("%5");
    expect(w[0]).toContain("fazla");
    expect(w[1]).toContain("teslim alınan");
  });
});

describe("bağlantı uyarıları", () => {
  const today = new Date("2026-10-30T10:00:00Z");
  const base: AlertInput = {
    status: "ACTIVE",
    lastDrawDate: new Date("2027-06-30"),
    validUntil: null,
    priceFixedUntil: null,
    items: [{ description: "Hazır beton C30", unit: "m³", total: d(3000), remaining: d(1500) }],
    payments: [],
    advanceBalance: d(0),
    currencyLabel: "TL",
    invoiceWarningCount: 0,
  };

  it("sorunsuz bağlantıda uyarı yok; pasif bağlantıda hiç uyarı yok", () => {
    expect(connectionAlerts(base, today)).toEqual([]);
    expect(connectionAlerts({ ...base, status: "COMPLETED", lastDrawDate: new Date("2026-01-01") }, today)).toEqual([]);
  });

  it("son çekiş, düşük kalan, vade ve çekilmemiş avans", () => {
    const alerts = connectionAlerts(
      {
        ...base,
        lastDrawDate: new Date("2026-11-15"),
        items: [{ description: "Hazır beton C30", unit: "m³", total: d(3000), remaining: d(200) }],
        payments: [
          { dueDate: new Date("2026-10-20"), paymentStatus: "UNPAID" },
          { dueDate: new Date("2026-11-02"), paymentStatus: "UNPAID" },
          { dueDate: new Date("2026-10-01"), paymentStatus: "PAID" },
        ],
        advanceBalance: d(150000),
      },
      today,
    );
    const text = alerts.map((a) => a.message).join(" | ");
    expect(text).toContain("Son çekiş tarihi 16 gün sonra");
    expect(text).toContain("kalan 200 m³");
    expect(text).toContain("1 ödemenin vadesi geçti");
    expect(text).toContain("1 ödemenin vadesi 7 gün içinde");
    expect(text).toContain("Çekilmemiş avans 150.000");
  });

  it("geçmiş tarih kırmızı uyarı; malzeme kalmadıysa tarih uyarısı yok", () => {
    const past = connectionAlerts({ ...base, lastDrawDate: new Date("2026-10-01") }, today);
    expect(past[0]).toMatchObject({ level: "danger" });
    expect(
      connectionAlerts({ ...base, lastDrawDate: new Date("2026-10-01"), items: [{ ...base.items[0], remaining: d(0) }] }, today),
    ).toEqual([]);
  });
});
