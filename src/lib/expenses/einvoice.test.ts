import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { invoiceToRows, parseUblInvoice, unitName } from "./einvoice";
import { resolveImportRow } from "./import-rows";
import Decimal from "decimal.js";

const xml = readFileSync(join(__dirname, "__fixtures__", "efatura-ornek.xml"), "utf8");

describe("e-Fatura (UBL-TR) okuma", () => {
  it("başlık, taraflar, kalemler ve toplamlar", () => {
    const r = parseUblInvoice(xml);
    if (!r.ok) throw new Error(r.error);
    const inv = r.invoice;
    expect(inv.number).toBe("ABC2026000000123");
    expect(inv.date).toBe("2026-10-28");
    expect(inv.dueDate).toBe("2026-11-27");
    expect(inv.supplier).toEqual({ name: "Örnek Yapı Malzemeleri A.Ş.", taxNumber: "1234567890" });
    expect(inv.buyer).toEqual({ name: "Ali Müteahhit", taxNumber: "10000000146" });
    expect(inv.lines.length).toBe(3);
    expect(inv.lines[1].name).toBe("Derz dolgusu – 5 kg torba");
    expect(inv.lines[2].vatRate.toString()).toBe("1");
    expect(inv.totals.payable?.toString()).toBe("15410");
    expect(inv.warnings).toEqual([]);
    expect(unitName("KGM")).toBe("kg");
    expect(unitName("XYZ")).toBe("XYZ");
  });

  it("satır satır ve KDV oranına göre özet satırlar; tablo modu satırı çözümler", () => {
    const r = parseUblInvoice(xml);
    if (!r.ok) throw new Error(r.error);
    const lines = invoiceToRows(r.invoice, "lines", "08.05");
    expect(lines[0]).toMatchObject({ date: "28.10.2026", documentNo: "ABC2026000000123", quantity: "800", unit: "kg", unitPrice: "13,5", netAmount: "10800", vatRate: "20", totalAmount: "12960" });
    const summary = invoiceToRows(r.invoice, "invoice");
    expect(summary.map((s) => [s.vatRate, s.netAmount, s.vatAmount, s.description])).toEqual([
      ["20", "12000", "2400", "Seramik yapıştırıcı C2TE + 1 kalem"],
      ["1", "1000", "10", "Nakliye"],
    ]);
    const resolved = resolveImportRow(lines[0], {
      costItems: [{ id: "c1", code: "08.05", name: "Seramik", active: true }],
      suppliers: [{ id: "s1", name: "Örnek Yapı Malzemeleri A.Ş.", taxNumber: "1234567890" }],
      blocks: [],
      findRate: () => new Decimal(1),
    }, { vatRate: new Decimal(20) });
    if (!resolved.ok) throw new Error(resolved.errors.join(", "));
    expect(resolved.value.supplierId).toBe("s1");
    expect(resolved.value.documentType).toBe("INVOICE");
    expect(resolved.value.amounts.totalAmountTry.toFixed(2)).toBe("12960.00");
  });

  it("geçersiz XML, e-Fatura olmayan belge ve uyarılar", () => {
    expect(parseUblInvoice("<Invoice><cbc:ID>").ok).toBe(false);
    expect(parseUblInvoice("<CreditNote/>").ok).toBe(false);
    const iade = parseUblInvoice(xml.replace("<cbc:InvoiceTypeCode>SATIS", "<cbc:InvoiceTypeCode>IADE").replace("13000.00</cbc:TaxExclusiveAmount>", "12000.00</cbc:TaxExclusiveAmount>"));
    if (!iade.ok) throw new Error(iade.error);
    expect(iade.invoice.warnings.length).toBe(2);
  });
});
