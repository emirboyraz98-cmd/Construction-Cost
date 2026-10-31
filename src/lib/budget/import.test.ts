import { describe, expect, it } from "vitest";
import { guessBudgetMapping, resolveBudgetRow } from "./import";

const lookups = {
  costItems: [
    { id: "a", code: "05.05", name: "İnşaat demiri" },
    { id: "b", code: "08.05", name: "Seramik" },
  ],
  blocks: [{ id: "x", name: "A Blok" }],
};

describe("metraj / bütçe içe aktarma", () => {
  it("başlıklardan sütun tahmini", () => {
    expect(guessBudgetMapping(["Kalem Kodu", "Poz Adı", "Metraj", "Birim", "Birim Fiyatı", "Blok", "Not"])).toEqual(["costItem", "description", "quantity", "unit", "unitPrice", "block", null]);
  });

  it("kod, Türkçe sayı, blok ve fiyatsız satır", () => {
    const r = resolveBudgetRow({ costItem: "05.05 İnşaat demiri", quantity: "216,33", unit: "ton", unitPrice: "28.500", block: "A" }, lookups);
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.value).toMatchObject({ costItemId: "a", blockId: "x", unit: "ton", currency: "TRY" });
    expect(r.value.quantity.toString()).toBe("216.33");
    expect(r.value.unitPrice?.toString()).toBe("28500");
    const noPrice = resolveBudgetRow({ costItem: "Seramik", quantity: "2412" }, lookups);
    expect(noPrice.ok && noPrice.warnings.length).toBe(1);
  });

  it("hatalar", () => {
    const r = resolveBudgetRow({ costItem: "99.01", quantity: "abc", block: "Z", currency: "yen" }, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(4);
  });
});
