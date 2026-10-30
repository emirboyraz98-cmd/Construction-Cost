import { describe, expect, it } from "vitest";
import { estimatedEndDate, permittedFloorArea, totalConstructionArea } from "./calc/zoning";
import { hashPassword, verifyPassword } from "./auth/password";
import { dateInputToDate, decimalToInput, formatNumber, parseDecimalInput } from "./format";

function parsed(input: string) {
  const result = parseDecimalInput(input);
  return result.ok ? (result.value?.toString() ?? null) : "geçersiz";
}

describe("Türkçe sayı girişi", () => {
  it("binlik ve ondalık ayırıcıları doğru okur", () => {
    expect(parsed("1.250,50")).toBe("1250.5");
    expect(parsed("1,5")).toBe("1.5");
    expect(parsed("0.35")).toBe("0.35");
    expect(parsed("1.500")).toBe("1500");
    expect(parsed("12.500.000")).toBe("12500000");
    expect(parsed(" 2 450 ")).toBe("2450");
    expect(parsed("")).toBeNull();
  });

  it("anlamsız girdiyi reddeder", () => {
    expect(parsed("abc")).toBe("geçersiz");
    expect(parsed("1,2,3")).toBe("geçersiz");
    expect(parsed("1.2.3")).toBe("geçersiz");
  });

  it("biçimlendirir ve forma geri yazar", () => {
    expect(formatNumber("1250.5")).toBe("1.250,5");
    expect(decimalToInput("1250.5")).toBe("1250,5");
  });

  it("tarih girişini UTC gece yarısına çevirir", () => {
    expect(dateInputToDate("2026-10-30")?.toISOString()).toBe("2026-10-30T00:00:00.000Z");
    expect(dateInputToDate("30.10.2026")).toBeNull();
  });
});

describe("imar ve alan hesapları", () => {
  it("emsal alanını ondalık hatası olmadan hesaplar", () => {
    // 0,1 + 0,2 gibi kayan nokta hataları olmamalı.
    expect(permittedFloorArea("1250.10", "1.2")?.toString()).toBe("1500.12");
    expect(permittedFloorArea(null, "1.2")).toBeNull();
  });

  it("blok inşaat alanlarını toplar", () => {
    const total = totalConstructionArea([
      { constructionArea: "1500.10" },
      { constructionArea: null },
      { constructionArea: "1499.90" },
    ]);
    expect(total.toString()).toBe("3000");
  });

  it("tahmini bitiş tarihini ay sonuna taşırmadan hesaplar", () => {
    const end = estimatedEndDate(new Date("2026-01-31T00:00:00Z"), 1);
    expect(end?.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(estimatedEndDate(new Date("2026-03-15T00:00:00Z"), 18)?.toISOString().slice(0, 10)).toBe(
      "2027-09-15",
    );
  });
});

describe("şifre özetleme", () => {
  it("doğru şifreyi kabul eder, yanlışı reddeder", async () => {
    const hash = await hashPassword("Gizli-Şifre-123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("Gizli");
    expect(await verifyPassword("Gizli-Şifre-123", hash)).toBe(true);
    expect(await verifyPassword("yanlis", hash)).toBe(false);
    expect(await verifyPassword("Gizli-Şifre-123", "bozuk")).toBe(false);
  });
});
