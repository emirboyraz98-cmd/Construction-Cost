import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { resolveImportRow, type ImportLookups } from "./import-rows";
import { dueBucket } from "./payables";
import { guessColumnMapping, parseDateValue, parseDelimited, parseNumberValue } from "./tabular";
import { parseTcmbXml, tcmbUrl } from "./tcmb";

describe("Excel'den yapıştırma / CSV ayrıştırma", () => {
  it("sekmeyle ayrılmış metni (Excel kopyası) satırlara böler", () => {
    const rows = parseDelimited("Tarih\tTedarikçi\tToplam\r\n30.10.2026\tAkın Beton\t1.200,00\r\n\r\n");
    expect(rows).toEqual([
      ["Tarih", "Tedarikçi", "Toplam"],
      ["30.10.2026", "Akın Beton", "1.200,00"],
    ]);
  });

  it("noktalı virgüllü CSV ve tırnak içindeki ayırıcıları okur", () => {
    const rows = parseDelimited('Tarih;Açıklama;Tutar\n01.10.2026;"Demir; 12 mm ""nervürlü""";5000');
    expect(rows[1]).toEqual(["01.10.2026", 'Demir; 12 mm "nervürlü"', "5000"]);
  });

  it("Türkçe başlıklardan sütunları tahmin eder", () => {
    const mapping = guessColumnMapping([
      "Fatura Tarihi",
      "Cari Ünvan",
      "VKN",
      "Fatura No",
      "Matrah",
      "KDV",
      "Genel Toplam",
      "Maliyet Kalemi",
      "Bilinmeyen",
    ]);
    expect(mapping).toEqual([
      "date",
      "supplierName",
      "supplierTaxNumber",
      "documentNo",
      "netAmount",
      "vatAmount",
      "totalAmount",
      "costItem",
      null,
    ]);
  });

  it("tarih biçimlerini ve Excel seri numarasını okur", () => {
    const iso = (v: unknown) => parseDateValue(v)?.toISOString().slice(0, 10) ?? null;
    expect(iso("30.10.2026")).toBe("2026-10-30");
    expect(iso("30/10/26")).toBe("2026-10-30");
    expect(iso("2026-10-30")).toBe("2026-10-30");
    expect(iso(46325)).toBe("2026-10-30");
    expect(iso("31.02.2026")).toBeNull();
    expect(iso("dün")).toBeNull();
  });

  it("para ve yüzde işaretli sayıları okur", () => {
    const val = (v: unknown) => {
      const r = parseNumberValue(v);
      return r.ok ? (r.value?.toString() ?? null) : "hata";
    };
    expect(val("₺ 1.250,50")).toBe("1250.5");
    expect(val("%20")).toBe("20");
    expect(val(1250.5)).toBe("1250.5");
    expect(val("on iki")).toBe("hata");
  });
});

const lookups: ImportLookups = {
  costItems: [
    { id: "c1", code: "05.04.01", name: "Hazır beton", active: true },
    { id: "c2", code: "05.05", name: "İnşaat demiri, kesme-bükme işçiliği", active: true },
    { id: "c3", code: "14.01", name: "Dijital reklam", active: false },
  ],
  suppliers: [{ id: "s1", name: "Akın Beton A.Ş.", taxNumber: "1234567890" }],
  blocks: [{ id: "b1", name: "A Blok" }],
  findRate: (_date, currency) => (currency === "USD" ? new Decimal("34.5") : null),
};

describe("içe aktarılan satırın harcamaya çevrilmesi", () => {
  it("kod, vergi no ve matrah/KDV ile eşleştirir", () => {
    const result = resolveImportRow(
      {
        date: "15.10.2026",
        costItem: "05.04.01",
        supplierTaxNumber: "1234567890",
        documentNo: "AKN2026000123",
        netAmount: "10.000,00",
        vatAmount: "2.000,00",
        totalAmount: "12.000,00",
        block: "a blok",
      },
      lookups,
      { vatRate: null },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.costItemId).toBe("c1");
    expect(result.value.supplierId).toBe("s1");
    expect(result.value.blockId).toBe("b1");
    expect(result.value.vatRate.toString()).toBe("20");
    expect(result.value.amounts.totalAmountTry.toFixed(2)).toBe("12000.00");
    expect(result.value.documentType).toBe("INVOICE");
  });

  it("kalem adıyla eşleştirir, bilinmeyen tedarikçiyi yeni tedarikçi olarak işaretler", () => {
    const result = resolveImportRow(
      { date: "2026-10-01", costItem: "inşaat demiri", supplierName: "Demir Ltd", totalAmount: "1200", paymentStatus: "Ödendi" },
      lookups,
      { vatRate: new Decimal(20) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.costItemId).toBe("c2");
    expect(result.value.newSupplier).toEqual({ name: "Demir Ltd", taxNumber: null });
    expect(result.warnings[0]).toMatch(/Yeni tedarikçi/);
    expect(result.value.amounts.netAmount.toFixed(2)).toBe("1000.00");
    expect(result.value.paymentStatus).toBe("PAID");
    expect(result.value.paidAt?.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("dövizde kayıtlı kuru kullanır", () => {
    const result = resolveImportRow(
      { date: "01.10.2026", costItem: "05.05", netAmount: "1000", vatRate: "20", currency: "USD" },
      lookups,
      { vatRate: null },
    );
    expect(result.ok && result.value.amounts.totalAmountTry.toFixed(2)).toBe("41400.00");
  });

  it("hatalı satırda tüm sorunları birlikte bildirir", () => {
    const result = resolveImportRow(
      { date: "32.13.2026", costItem: "14.01", netAmount: "1000", vatAmount: "200", totalAmount: "1300", currency: "EUR" },
      lookups,
      { vatRate: null },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" | ")).toMatch(/Tarih okunamadı/);
    expect(result.errors.join(" | ")).toMatch(/pasif/);
    expect(result.errors.join(" | ")).toMatch(/EUR için kur yok/);
    expect(result.errors.join(" | ")).toMatch(/tutmuyor/);
  });
});

describe("TCMB kur bülteni", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="30.10.2026" Date="10/30/2026" Bulten_No="2026/207">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit><Isim>ABD DOLARI</Isim>
    <ForexBuying>34.2945</ForexBuying><ForexSelling>34.3563</ForexSelling>
  </Currency>
  <Currency CrossOrder="1" Kod="JPY" CurrencyCode="JPY">
    <Unit>100</Unit><ForexBuying>22.1</ForexBuying><ForexSelling>22.3</ForexSelling>
  </Currency>
  <Currency CrossOrder="9" Kod="EUR" CurrencyCode="EUR">
    <Unit>1</Unit><ForexBuying>37.1012</ForexBuying><ForexSelling>37.1681</ForexSelling>
  </Currency>
</Tarih_Date>`;

  it("tarih ile USD/EUR alış-satış kurlarını okur", () => {
    const bulletin = parseTcmbXml(xml);
    expect(bulletin.date.toISOString().slice(0, 10)).toBe("2026-10-30");
    expect(bulletin.rates.map((r) => [r.currency, r.buying.toString(), r.selling.toString()])).toEqual([
      ["USD", "34.2945", "34.3563"],
      ["EUR", "37.1012", "37.1681"],
    ]);
  });

  it("tarihli bülten adresini üretir", () => {
    expect(tcmbUrl(new Date("2026-03-05T00:00:00Z"))).toBe("https://www.tcmb.gov.tr/kurlar/202603/05032026.xml");
  });
});

describe("vade listesi", () => {
  const today = new Date("2026-10-30T15:00:00Z");
  it("vadeleri gruplar", () => {
    expect(dueBucket(new Date("2026-10-29T00:00:00Z"), today)).toBe("overdue");
    expect(dueBucket(new Date("2026-10-30T00:00:00Z"), today)).toBe("thisWeek");
    expect(dueBucket(new Date("2026-11-05T00:00:00Z"), today)).toBe("thisWeek");
    expect(dueBucket(new Date("2026-11-06T00:00:00Z"), today)).toBe("later");
    expect(dueBucket(null, today)).toBe("noDueDate");
  });
});
