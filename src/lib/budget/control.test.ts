import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { connectionGain, controlTotals, coverage, itemControl } from "./control";

const d = (v: string | number) => new Decimal(v);
const money = (v: Decimal) => v.toFixed(2);

describe("bütçe kontrolü", () => {
  it("miktardan ilerleme ve EAC = gerçekleşen + kalan iş × güncel fiyat", () => {
    // Beton: bütçe 2.000 m³ × 3.200 = 6,4 M; 800 m³ alındı, 2,72 M harcandı (fiyat artmış)
    const c = itemControl({ baseline: d(6_000_000), budget: d(6_400_000), budgetQuantity: d(2000), actualQuantity: d(800), actual: d(2_720_000), manualPercent: null });
    expect(c.percent?.toString()).toBe("40");
    expect(c.percentSource).toBe("quantity");
    expect(money(c.earned)).toBe("2560000.00");
    // 2,72 M + 6,4 M × 0,6 = 6,56 M → baz 6 M'ye göre 560 bin aşım, %5'ten fazla → risk
    expect(money(c.eac)).toBe("6560000.00");
    expect(money(c.variance)).toBe("-560000.00");
    expect(c.status).toBe("risk");
  });

  it("elle girilen yüzde miktardan önce gelir; oran yoksa bütçe korunur", () => {
    const manual = itemControl({ baseline: null, budget: d(1_000_000), budgetQuantity: d(10), actualQuantity: d(9), actual: d(300_000), manualPercent: d(25) });
    expect(manual.percentSource).toBe("manual");
    expect(money(manual.eac)).toBe("1050000.00");
    const none = itemControl({ baseline: null, budget: d(500_000), budgetQuantity: null, actualQuantity: null, actual: d(200_000), manualPercent: null });
    expect(none.percent).toBeNull();
    expect(money(none.eac)).toBe("500000.00");
    expect(none.status).toBe("ok");
  });

  it("gerçekleşen bütçeyi geçtiyse aşım; bütçesiz harcama ayrı işaretlenir", () => {
    expect(itemControl({ baseline: d(100), budget: d(100), budgetQuantity: null, actualQuantity: null, actual: d(150), manualPercent: null }).status).toBe("over");
    const u = itemControl({ baseline: null, budget: d(0), budgetQuantity: null, actualQuantity: null, actual: d(40), manualPercent: null });
    expect(u.status).toBe("unbudgeted");
    expect(money(u.eac)).toBe("40.00");
  });

  it("%100'ü geçen miktar kalan işi sıfırlar", () => {
    const c = itemControl({ baseline: null, budget: d(1000), budgetQuantity: d(10), actualQuantity: d(12), actual: d(1300), manualPercent: null });
    expect(c.percent?.toString()).toBe("120");
    expect(money(c.eac)).toBe("1300.00");
  });

  it("proje toplamı ve genel ilerleme", () => {
    const rows = [
      { baseline: d(1000), budget: d(1000), actual: d(500), control: itemControl({ baseline: d(1000), budget: d(1000), budgetQuantity: d(10), actualQuantity: d(5), actual: d(500), manualPercent: null }) },
      { baseline: d(3000), budget: d(3000), actual: d(0), control: itemControl({ baseline: d(3000), budget: d(3000), budgetQuantity: null, actualQuantity: null, actual: d(0), manualPercent: null }) },
    ];
    const t = controlTotals(rows);
    expect(t.hasBaseline).toBe(true);
    expect(money(t.eac)).toBe("4000.00");
    expect(t.progress?.toString()).toBe("12.5");
    expect(money(t.variance)).toBe("0.00");
  });
});

describe("bağlantı kapsaması ve kazancı", () => {
  it("PLAN 9.6 örneği: demir ihtiyacının %70'i bağlantılı, 150 ton açık", () => {
    const rows = coverage(
      [{ key: "05.05|ton", label: "Demir", unit: "ton", quantity: d(500) }],
      [{ key: "05.05|ton", label: "Demir", unit: "ton", allocated: d(350), drawn: d(120) }],
    );
    expect(rows[0]).toMatchObject({ status: "short" });
    expect(rows[0].percent?.toString()).toBe("70");
    expect(rows[0].open.toString()).toBe("150");
    expect(rows[0].message).toContain("150 ton açık");
  });

  it("bağlantısız, fazla ve bütçesiz durumlar", () => {
    const rows = coverage(
      [
        { key: "a", label: "Beton", unit: "m³", quantity: d(1000) },
        { key: "b", label: "Seramik", unit: "m²", quantity: d(2000) },
      ],
      [
        { key: "a", label: "Beton", unit: "m³", allocated: d(1200), drawn: d(0) },
        { key: "c", label: "Kum", unit: "ton", allocated: d(50), drawn: d(0) },
      ],
    );
    expect(rows.map((r) => r.status)).toEqual(["excess", "missing", "unbudgeted"]);
  });

  it("kazanç = (güncel − bağlantı fiyatı) × miktar", () => {
    expect(money(connectionGain(d(3200), d(3650), d(2500)))).toBe("1125000.00");
    expect(money(connectionGain(d(3200), d(3000), d(100)))).toBe("-20000.00");
  });
});
