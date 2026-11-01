import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { lineAmount, squareMeterCosts, summarizeBudget } from "./budget";
import { evaluateFormula } from "./formula";
import { actualCoefficient, formulaVariables, parametricQuantity, projectMetrics } from "./metrics";
import { effectivePrice, recipeUnitPrice, toTry } from "./pricing";
import { areaChecks, generateUnits } from "./units";

const d = (v: string | number) => new Decimal(v);
const money = (v: Decimal | null) => v?.toFixed(2) ?? null;

describe("PLAN 7.7 sayısal örnek", () => {
  it("inşaat ve müteahhit satılabilir m² maliyeti", () => {
    // 90 M TL toplam maliyet, 3.000 m² inşaat, 2.400 m² satılabilir, arsa sahibi %45 → müteahhide 1.320 m²
    const summary = summarizeBudget([{ costItemCode: "05.04.01", blockId: null, amount: d(90_000_000) }], []);
    const m2 = squareMeterCosts(summary, { constructionArea: d(3000), contractorGross: d(2400).times(0.55) });
    expect(money(m2.construction)).toBe("30000.00");
    expect(money(m2.contractorSellable)).toBe("68181.82");
  });
});

describe("bütçe", () => {
  it("kalem maliyeti = miktar × birim fiyat × (1 + fire)", () => {
    expect(money(lineAmount(d(1260), d(3200), d(0)))).toBe("4032000.00");
    expect(money(lineAmount(d("100"), d("312.5"), d(8)))).toBe("33750.00");
  });

  it("grup toplamı, yapım maliyeti ve ortak giderin bloklara alan oranında dağıtımı", () => {
    const s = summarizeBudget(
      [
        { costItemCode: "01.01", blockId: null, amount: d(10_000_000) },
        { costItemCode: "05.04.01", blockId: "A", amount: d(3_000_000) },
        { costItemCode: "05.04.01", blockId: "B", amount: d(1_000_000) },
        { costItemCode: "03.02", blockId: null, amount: d("1000000.01") },
      ],
      [
        { id: "A", constructionArea: d(3000) },
        { id: "B", constructionArea: d(1000) },
      ],
    );
    expect(money(s.total)).toBe("15000000.01");
    expect(money(s.construction)).toBe("4000000.00");
    expect(money(s.byGroup.get("01")!)).toBe("10000000.00");
    expect(s.byBlock.map((b) => [b.blockId, money(b.direct), money(b.common), money(b.total)])).toEqual([
      ["A", "3000000.00", "8250000.01", "11250000.01"],
      ["B", "1000000.00", "2750000.00", "3750000.00"],
    ]);
  });

  it("alan yoksa m² maliyeti hesaplanmaz", () => {
    expect(squareMeterCosts({ total: d(1), construction: d(1) }, { constructionArea: d(0), contractorGross: d(0) })).toEqual({
      construction: null,
      totalPerConstruction: null,
      contractorSellable: null,
    });
  });
});

describe("fiyat önceliği ve reçete", () => {
  const day = (s: string) => new Date(s);
  it("bağlantı → fatura → teklif → piyasa; kaynak içinde en yeni", () => {
    const c = [
      { kind: "MARKET" as const, price: d(10), currency: "TRY" as const, date: day("2026-10-01") },
      { kind: "INVOICE" as const, price: d(12), currency: "TRY" as const, date: day("2026-09-01") },
      { kind: "INVOICE" as const, price: d(13), currency: "TRY" as const, date: day("2026-10-15") },
      { kind: "QUOTE" as const, price: d(11), currency: "TRY" as const, date: day("2026-10-20") },
    ];
    expect(effectivePrice(c)?.price.toString()).toBe("13");
    expect(effectivePrice([...c, { kind: "CONNECTION", price: d(9), currency: "TRY", date: day("2026-01-01") }])?.kind).toBe("CONNECTION");
    expect(effectivePrice([])).toBeNull();
  });

  it("dövizli fiyat kurla TL'ye çevrilir; kur yoksa null", () => {
    expect(toTry(d(100), "USD", new Map([["USD", d("41.8")]]))?.toString()).toBe("4180");
    expect(toTry(d(100), "EUR", new Map())).toBeNull();
  });

  it("PLAN 4.2 seramik reçetesi: fire kaynak satırında", () => {
    // 1 m² seramik (%8 fire) + 5 kg yapıştırıcı + 0,4 kg derz + 1 m² işçilik
    const r = recipeUnitPrice([
      { quantity: d(1), wastePercent: d(8), priceTry: d(400) },
      { quantity: d(5), wastePercent: d(0), priceTry: d(12) },
      { quantity: d("0.4"), wastePercent: d(0), priceTry: d(30) },
      { quantity: d(1), wastePercent: d(0), priceTry: d(250) },
      { quantity: d(1), wastePercent: d(0), priceTry: null },
    ]);
    expect(r.unitPrice.toString()).toBe("754");
    expect(r.missing).toBe(1);
  });
});

describe("metraj", () => {
  const m = projectMetrics({
    landArea: d("1250.5"),
    blocks: [
      { constructionArea: d(3000), floorCount: 8, basementCount: 2 },
      { constructionArea: d("2150.75"), floorCount: 6, basementCount: 1 },
    ],
    units: [
      { netArea: d(100), grossArea: d(125), owner: "CONTRACTOR" },
      { netArea: d(80), grossArea: d(100), owner: "LANDOWNER" },
    ],
  });

  it("parametrik miktar ve gerçekleşen katsayı", () => {
    expect(m.constructionArea.toString()).toBe("5150.75");
    expect(parametricQuantity("CONSTRUCTION_AREA", d("0.42"), m).toString()).toBe("2163.315");
    expect(parametricQuantity("SELLABLE_NET", d("2.75"), m).toString()).toBe("495");
    expect(actualCoefficient(d(2000), "CONSTRUCTION_AREA", m)?.toString()).toBe("0.388293");
    expect(actualCoefficient(d(1), "SELLABLE_GROSS", { ...m, sellableGross: d(0) })).toBeNull();
  });

  it("formül: değişkenler, öncelik, parantez, Türkçe ondalık", () => {
    const vars = formulaVariables(m);
    expect(evaluateFormula("insaat_alani * 0,42", vars)).toEqual({ ok: true, value: d("2163.315") });
    expect(evaluateFormula("(bolum_sayisi * 2 + 4) * 1.5", vars)).toEqual({ ok: true, value: d(12) });
    expect(evaluateFormula("kat_sayisi - -bodrum_sayisi", vars)).toEqual({ ok: true, value: d(10) });
    expect(evaluateFormula("10 / 3", vars)).toEqual({ ok: true, value: d("3.3333") });
  });

  it("formül hataları", () => {
    expect(evaluateFormula("alan * 2", {})).toEqual({ ok: false, error: "“alan” bilinmeyen değişken." });
    expect(evaluateFormula("(1 + 2", {}).ok).toBe(false);
    expect(evaluateFormula("1 / 0", {}).ok).toBe(false);
    expect(evaluateFormula("1 ; 2", {}).ok).toBe(false);
    expect(evaluateFormula("", {}).ok).toBe(false);
  });
});

describe("bağımsız bölümler", () => {
  it("kat kat üretim", () => {
    const rows = generateUnits({ blockId: "A", fromFloor: -1, toFloor: 1, perFloor: 2, startNo: 1, usageType: "RESIDENTIAL", layout: "2+1", netArea: d(90), grossArea: d(115) });
    expect(rows.map((r) => `${r.floor}/${r.doorNo}`)).toEqual(["-1/1", "-1/2", "0/3", "0/4", "1/5", "1/6"]);
  });

  it("alan ve arsa sahibi payı kontrolleri", () => {
    const units = [
      { blockId: "A", grossArea: d(120), netArea: d(100), owner: "LANDOWNER" as const, landownerId: "L1" },
      { blockId: "A", grossArea: d(120), netArea: d(100), owner: "CONTRACTOR" as const, landownerId: null },
      { blockId: "A", grossArea: d(160), netArea: d(130), owner: "CONTRACTOR" as const, landownerId: null },
    ];
    const checks = areaChecks(
      [{ id: "A", name: "A Blok", constructionArea: d(500) }],
      units,
      [{ id: "L1", name: "Ahmet Bey", sharePercent: d(45) }],
    );
    expect(checks[0]).toMatchObject({ level: "info" });
    expect(checks[0].message).toContain("%80");
    // 120 / 400 = %30 ↔ sözleşme %45
    expect(checks[1]).toMatchObject({ level: "danger" });
    expect(checks[1].message).toContain("15 puan eksik");
    const over = areaChecks([{ id: "A", name: "A Blok", constructionArea: d(300) }], units, []);
    expect(over[0].level).toBe("danger");
  });
});
