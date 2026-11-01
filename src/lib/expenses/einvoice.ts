// e-Fatura / e-Arşiv (UBL-TR XML) okuma ve tablo moduna satır üretme (PLAN.md 14, Faz 8; saf modül).
// GİB portalından inen XML'ler UBL 2.1 Invoice biçimindedir; ad alanı ön ekleri yok sayılır.
import Decimal from "decimal.js";
import { SaxesParser } from "saxes";
import type { ImportRow } from "./import-rows";

type Node = { name: string; attrs: Record<string, string>; text: string; children: Node[] };

const local = (name: string) => name.slice(name.indexOf(":") + 1);

/** XML'i ad alanı ön eki olmadan basit bir ağaca çevirir. */
function parseTree(xml: string): Node {
  const parser = new SaxesParser();
  const root: Node = { name: "#root", attrs: {}, text: "", children: [] };
  const stack: Node[] = [root];
  parser.on("opentag", (tag) => {
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(tag.attributes)) attrs[local(k)] = String(v);
    const node: Node = { name: local(tag.name), attrs, text: "", children: [] };
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });
  parser.on("text", (t) => (stack[stack.length - 1].text += t));
  parser.on("cdata", (t) => (stack[stack.length - 1].text += t));
  parser.on("closetag", () => void stack.pop());
  parser.write(xml.replace(/^﻿/, "")).close();
  return root;
}

const child = (n: Node | undefined, ...path: string[]): Node | undefined => {
  let cur = n;
  for (const p of path) cur = cur?.children.find((c) => c.name === p);
  return cur;
};
const children = (n: Node | undefined, name: string) => n?.children.filter((c) => c.name === name) ?? [];
const text = (n: Node | undefined, ...path: string[]) => child(n, ...path)?.text.trim() ?? "";
const num = (n: Node | undefined, ...path: string[]) => {
  const t = text(n, ...path);
  return t && /^-?\d+(\.\d+)?$/.test(t) ? new Decimal(t) : null;
};

export type EInvoiceLine = {
  name: string;
  quantity: Decimal | null;
  unitCode: string | null;
  unitPrice: Decimal | null;
  net: Decimal;
  vatRate: Decimal;
  vatAmount: Decimal;
};

export type EInvoice = {
  number: string;
  uuid: string | null;
  profile: string | null;
  typeCode: string | null;
  date: string;
  dueDate: string | null;
  currency: string;
  exchangeRate: Decimal | null;
  supplier: { name: string; taxNumber: string | null };
  buyer: { name: string; taxNumber: string | null };
  lines: EInvoiceLine[];
  totals: { net: Decimal | null; vat: Decimal | null; total: Decimal | null; payable: Decimal | null };
  warnings: string[];
};

function party(p: Node | undefined) {
  const ids = children(p, "PartyIdentification").map((x) => child(x, "ID"));
  const tax = ids.find((i) => /^(VKN|TCKN)$/i.test(i?.attrs.schemeID ?? ""))?.text.trim() ?? null;
  const personName = [text(p, "Person", "FirstName"), text(p, "Person", "FamilyName")].filter(Boolean).join(" ");
  return { name: text(p, "PartyName", "Name") || personName, taxNumber: tax };
}

/** VAT (0015) oranı ve tutarı; yoksa ilk vergi alt toplamı. */
function vatOf(taxTotal: Node | undefined) {
  const subs = children(taxTotal, "TaxSubtotal");
  const vat = subs.find((s) => text(s, "TaxCategory", "TaxScheme", "TaxTypeCode") === "0015") ?? subs[0];
  return { rate: num(vat, "Percent") ?? new Decimal(0), amount: num(vat, "TaxAmount") ?? new Decimal(0) };
}

export function parseUblInvoice(xml: string): { ok: true; invoice: EInvoice } | { ok: false; error: string } {
  let root: Node;
  try {
    root = parseTree(xml);
  } catch {
    return { ok: false, error: "XML okunamadı (bozuk dosya)." };
  }
  const inv = root.children[0];
  if (!inv || inv.name !== "Invoice") return { ok: false, error: "UBL e-Fatura (Invoice) değil." };
  const number = text(inv, "ID");
  const date = text(inv, "IssueDate");
  if (!number || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Fatura numarası veya tarihi yok." };
  const warnings: string[] = [];
  const typeCode = text(inv, "InvoiceTypeCode") || null;
  if (typeCode === "IADE") warnings.push("İade faturası: tutarları eksi olarak kontrol edin.");
  if (children(inv, "WithholdingTaxTotal").length) warnings.push("KDV tevkifatlı fatura: ödenecek tutar toplamdan düşüktür.");
  if (children(inv, "AllowanceCharge").length) warnings.push("Fatura altı iskonto / masraf var: satır tutarlarıyla toplamı karşılaştırın.");

  const lines: EInvoiceLine[] = children(inv, "InvoiceLine").map((l) => {
    const qtyNode = child(l, "InvoicedQuantity");
    const vat = vatOf(child(l, "TaxTotal"));
    return {
      name: [text(l, "Item", "Name"), text(l, "Item", "Description")].filter(Boolean).join(" – ") || "Kalem",
      quantity: num(l, "InvoicedQuantity"),
      unitCode: qtyNode?.attrs.unitCode ?? null,
      unitPrice: num(l, "Price", "PriceAmount"),
      net: num(l, "LineExtensionAmount") ?? new Decimal(0),
      vatRate: vat.rate,
      vatAmount: vat.amount,
    };
  });
  if (lines.length === 0) return { ok: false, error: "Faturada kalem satırı yok." };
  const totals = {
    net: num(inv, "LegalMonetaryTotal", "TaxExclusiveAmount") ?? num(inv, "LegalMonetaryTotal", "LineExtensionAmount"),
    vat: num(inv, "TaxTotal", "TaxAmount"),
    total: num(inv, "LegalMonetaryTotal", "TaxInclusiveAmount"),
    payable: num(inv, "LegalMonetaryTotal", "PayableAmount"),
  };
  const lineNet = lines.reduce((s, l) => s.plus(l.net), new Decimal(0));
  if (totals.net && !totals.net.minus(lineNet).abs().lte("0.05")) warnings.push(`Satırların matrahı (${lineNet.toFixed(2)}) fatura matrahından (${totals.net.toFixed(2)}) farklı.`);
  const currency = text(inv, "DocumentCurrencyCode") || "TRY";
  return {
    ok: true,
    invoice: {
      number,
      uuid: text(inv, "UUID") || null,
      profile: text(inv, "ProfileID") || null,
      typeCode,
      date,
      dueDate: text(inv, "PaymentMeans", "PaymentDueDate") || null,
      currency,
      exchangeRate: currency !== "TRY" ? num(inv, "PricingExchangeRate", "CalculationRate") : null,
      supplier: party(child(inv, "AccountingSupplierParty", "Party")),
      buyer: party(child(inv, "AccountingCustomerParty", "Party")),
      lines,
      totals,
      warnings,
    },
  };
}

/** UN/ECE Rec. 20 birim kodları (e-Faturada en sık kullanılanlar). */
const UNIT_CODES: Record<string, string> = {
  C62: "adet",
  NIU: "adet",
  H87: "adet",
  KGM: "kg",
  GRM: "g",
  TNE: "ton",
  MTR: "m",
  MTK: "m²",
  MTQ: "m³",
  LTR: "litre",
  KWH: "kWh",
  DAY: "gün",
  HUR: "saat",
  MON: "ay",
  SET: "takım",
  BX: "kutu",
  PA: "paket",
  KMT: "km",
};

export const unitName = (code: string | null) => (code ? (UNIT_CODES[code.toUpperCase()] ?? code) : "");

/** Türkçe sayı metni (binlik ayırıcısız, ondalık virgül): tablo modu bu biçimi okur. */
const tr = (v: Decimal | null) => (v == null ? "" : v.toString().replace(".", ","));
const trDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/**
 * Tablo modu satırları: "lines" her fatura kalemi için bir satır, "invoice" KDV oranına göre
 * gruplanmış tek satır (fatura özeti). Maliyet kalemi kullanıcı tarafından seçilir (öneri verilebilir).
 */
export function invoiceToRows(inv: EInvoice, mode: "lines" | "invoice", costItem = ""): ImportRow[] {
  const base: ImportRow = {
    date: trDate(inv.date),
    supplierName: inv.supplier.name,
    supplierTaxNumber: inv.supplier.taxNumber ?? "",
    documentType: inv.profile === "EARSIVFATURA" ? "e-Arşiv fatura" : "e-Fatura",
    documentNo: inv.number,
    currency: inv.currency,
    exchangeRate: tr(inv.exchangeRate),
    dueDate: trDate(inv.dueDate),
    costItem,
  };
  if (mode === "lines") {
    return inv.lines.map((l) => ({
      ...base,
      description: l.name,
      quantity: tr(l.quantity),
      unit: unitName(l.unitCode),
      unitPrice: tr(l.unitPrice),
      netAmount: tr(l.net),
      vatRate: tr(l.vatRate),
      vatAmount: tr(l.vatAmount),
      totalAmount: tr(l.net.plus(l.vatAmount)),
    }));
  }
  const groups = new Map<string, { net: Decimal; vat: Decimal; names: string[] }>();
  for (const l of inv.lines) {
    const g = groups.get(l.vatRate.toString()) ?? groups.set(l.vatRate.toString(), { net: new Decimal(0), vat: new Decimal(0), names: [] }).get(l.vatRate.toString())!;
    g.net = g.net.plus(l.net);
    g.vat = g.vat.plus(l.vatAmount);
    g.names.push(l.name);
  }
  return [...groups.entries()].map(([rate, g]) => ({
    ...base,
    description: g.names.length > 1 ? `${g.names[0]} + ${g.names.length - 1} kalem` : g.names[0],
    netAmount: tr(g.net),
    vatRate: tr(new Decimal(rate)),
    vatAmount: tr(g.vat),
    totalAmount: tr(g.net.plus(g.vat)),
  }));
}
