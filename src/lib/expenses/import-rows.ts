// İçe aktarılan / tabloya yapıştırılan bir satırı harcama kaydına çevirir (saf mantık).
// Maliyet kalemi, tedarikçi, blok ve kur eşleştirmeleri dışarıdan verilen listelerle yapılır.
import Decimal from "decimal.js";
import type {
  Currency,
  DocumentType,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { computeExpenseAmounts, impliedVatRate, type ExpenseAmounts } from "./amounts";
import { normalizeKey, parseDateValue, parseNumberValue, type ImportField } from "./tabular";

export type ImportRow = Partial<Record<ImportField, string>>;

export type ImportLookups = {
  costItems: readonly { id: string; code: string; name: string; active: boolean }[];
  suppliers: readonly { id: string; name: string; taxNumber: string | null }[];
  blocks: readonly { id: string; name: string }[];
  /** Tarih ve para birimi için kayıtlı kur (yoksa null) */
  findRate: (date: Date, currency: Currency) => Decimal | null;
};

export type ResolvedImportRow = {
  date: Date;
  costItemId: string;
  blockId: string | null;
  supplierId: string | null;
  /** Kayıtlı olmayan tedarikçi: kaydederken oluşturulur */
  newSupplier: { name: string; taxNumber: string | null } | null;
  description: string | null;
  documentType: DocumentType;
  documentNo: string | null;
  quantity: Decimal | null;
  unit: string | null;
  unitPrice: Decimal | null;
  currency: Currency;
  exchangeRate: Decimal;
  vatRate: Decimal;
  amounts: ExpenseAmounts;
  dueDate: Date | null;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paidAt: Date | null;
};

export type RowResult =
  | { ok: true; value: ResolvedImportRow; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const CURRENCY_WORDS: Record<string, Currency> = {
  tl: "TRY", try: "TRY", "": "TRY", "turk lirasi": "TRY",
  usd: "USD", dolar: "USD", "abd dolari": "USD", "$": "USD",
  eur: "EUR", euro: "EUR", avro: "EUR",
  gbp: "GBP", sterlin: "GBP", "ingiliz sterlini": "GBP",
};

function parseCurrency(raw: string | undefined): Currency | null {
  const text = (raw ?? "").trim();
  if (text === "₺") return "TRY";
  if (text === "€") return "EUR";
  if (text === "£") return "GBP";
  if (text === "$") return "USD";
  return CURRENCY_WORDS[normalizeKey(text)] ?? null;
}

function parseDocumentType(raw: string | undefined): DocumentType | null {
  const key = normalizeKey(raw ?? "");
  if (!key || key.includes("fatura") || key.includes("arsiv")) return "INVOICE";
  if (key.includes("irsaliye")) return "DELIVERY_NOTE";
  if (key.includes("fis") || key.includes("yazar kasa")) return "RECEIPT";
  if (key.includes("hakedis")) return "PROGRESS_BILLING";
  if (key.includes("makbuz") || key.includes("pusula") || key === "smm") return "VOUCHER";
  if (key.includes("belgesiz") || key === "yok") return "NONE";
  return null;
}

function parsePaymentStatus(raw: string | undefined): PaymentStatus {
  const key = normalizeKey(raw ?? "");
  return ["odendi", "odenmis", "evet", "e", "paid", "kapali"].includes(key) ? "PAID" : "UNPAID";
}

function parsePaymentMethod(raw: string | undefined): PaymentMethod | null | "invalid" {
  const key = normalizeKey(raw ?? "");
  if (!key) return null;
  if (key.includes("nakit")) return "CASH";
  if (key.includes("havale") || key.includes("eft") || key.includes("banka") || key.includes("fast")) return "BANK_TRANSFER";
  if (key === "cek" || key.startsWith("cek ")) return "CHEQUE";
  if (key.includes("senet")) return "PROMISSORY_NOTE";
  if (key.includes("kart") || key === "kk") return "CREDIT_CARD";
  return "invalid";
}

/** Maliyet kalemi: önce kod, sonra tam ad, sonra adın içinde tek eşleşme. */
function matchCostItem(raw: string, items: ImportLookups["costItems"]) {
  const text = raw.trim();
  const code = text.match(/^\d{2}(\.\d{2,3})*/)?.[0];
  if (code) {
    const byCode = items.find((item) => item.code === code);
    if (byCode) return byCode;
  }
  const key = normalizeKey(text);
  const exact = items.filter((item) => normalizeKey(item.name) === key);
  if (exact.length === 1) return exact[0];
  const partial = items.filter((item) => normalizeKey(item.name).includes(key));
  return partial.length === 1 ? partial[0] : null;
}

export function resolveImportRow(
  row: ImportRow,
  lookups: ImportLookups,
  defaults: { vatRate: Decimal | null },
): RowResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const number = (field: ImportField, label: string): Decimal | null => {
    const parsed = parseNumberValue(row[field]);
    if (!parsed.ok) {
      errors.push(`${label} sayı değil: "${row[field]}"`);
      return null;
    }
    return parsed.value;
  };

  const date = parseDateValue(row.date);
  if (!date) errors.push(row.date ? `Tarih okunamadı: "${row.date}"` : "Tarih yok");

  let costItemId = "";
  if (!row.costItem?.trim()) {
    errors.push("Maliyet kalemi yok");
  } else {
    const item = matchCostItem(row.costItem, lookups.costItems);
    if (!item) errors.push(`Maliyet kalemi bulunamadı: "${row.costItem}"`);
    else if (!item.active) errors.push(`Maliyet kalemi pasif: ${item.code} ${item.name}`);
    else costItemId = item.id;
  }

  let blockId: string | null = null;
  if (row.block?.trim()) {
    const block = lookups.blocks.find((b) => normalizeKey(b.name) === normalizeKey(row.block!));
    if (block) blockId = block.id;
    else errors.push(`Blok bulunamadı: "${row.block}"`);
  }

  let supplierId: string | null = null;
  let newSupplier: ResolvedImportRow["newSupplier"] = null;
  const taxNumber = row.supplierTaxNumber?.replace(/\s/g, "") || null;
  const supplierName = row.supplierName?.trim() || null;
  const byTax = taxNumber ? lookups.suppliers.find((s) => s.taxNumber === taxNumber) : undefined;
  const byName = supplierName
    ? lookups.suppliers.find((s) => normalizeKey(s.name) === normalizeKey(supplierName))
    : undefined;
  if (byTax ?? byName) {
    supplierId = (byTax ?? byName)!.id;
  } else if (supplierName) {
    newSupplier = { name: supplierName, taxNumber };
    warnings.push(`Yeni tedarikçi oluşturulacak: ${supplierName}`);
  } else if (taxNumber) {
    errors.push(`Vergi no ${taxNumber} ile kayıtlı tedarikçi yok; tedarikçi adını da yazın`);
  }

  const documentType = parseDocumentType(row.documentType);
  if (!documentType) errors.push(`Belge türü anlaşılamadı: "${row.documentType}"`);

  const currency = parseCurrency(row.currency);
  if (!currency) errors.push(`Para birimi anlaşılamadı: "${row.currency}"`);

  let exchangeRate = new Decimal(1);
  if (currency && currency !== "TRY") {
    const given = number("exchangeRate", "Kur");
    const found = date ? lookups.findRate(date, currency) : null;
    if (given?.gt(0)) exchangeRate = given;
    else if (found) {
      exchangeRate = found;
      warnings.push(`Kur kayıtlı kurlardan alındı: ${found.toString()}`);
    } else errors.push(`${currency} için kur yok (sütun ekleyin veya Ayarlar > Kurlar'dan girin)`);
  }

  const quantity = number("quantity", "Miktar");
  const unitPrice = number("unitPrice", "Birim fiyat");
  const net = number("netAmount", "Matrah");
  const vat = number("vatAmount", "KDV tutarı");
  const total = number("totalAmount", "Toplam");
  const vatRateGiven = number("vatRate", "KDV oranı");

  let amounts: ExpenseAmounts | null = null;
  let vatRate = vatRateGiven ?? defaults.vatRate;
  if (net && vat) {
    amounts = computeExpenseAmounts({ mode: "explicit", netAmount: net, vatAmount: vat, exchangeRate });
    if (total && total.minus(amounts.totalAmount).abs().gt("0.01")) {
      errors.push(`Matrah + KDV (${amounts.totalAmount.toString()}) toplamla (${total.toString()}) tutmuyor`);
    }
    vatRate = vatRateGiven ?? impliedVatRate(net, vat);
  } else if (vatRate == null && (net || total || (quantity && unitPrice))) {
    errors.push("KDV oranı yok (sütun ekleyin veya varsayılan oranı seçin)");
  } else if (vatRate != null && net) {
    amounts = computeExpenseAmounts({ mode: "total", amount: net, includesVat: false, vatRate, exchangeRate });
  } else if (vatRate != null && total) {
    amounts = computeExpenseAmounts({ mode: "total", amount: total, includesVat: true, vatRate, exchangeRate });
  } else if (vatRate != null && quantity && unitPrice) {
    amounts = computeExpenseAmounts({ mode: "unit", quantity, unitPrice, vatRate, exchangeRate });
  } else {
    errors.push("Tutar yok (matrah, toplam veya miktar × birim fiyat gerekli)");
  }
  if (amounts && amounts.totalAmount.lte(0)) errors.push("Tutar sıfırdan büyük olmalı");

  const dueDate = parseDateValue(row.dueDate);
  if (row.dueDate && !dueDate) errors.push(`Vade tarihi okunamadı: "${row.dueDate}"`);
  const paymentStatus = parsePaymentStatus(row.paymentStatus);
  const paymentMethod = parsePaymentMethod(row.paymentMethod);
  if (paymentMethod === "invalid") errors.push(`Ödeme şekli anlaşılamadı: "${row.paymentMethod}"`);
  const paidAtParsed = parseDateValue(row.paidAt);
  if (row.paidAt && !paidAtParsed) errors.push(`Ödeme tarihi okunamadı: "${row.paidAt}"`);

  if (errors.length > 0 || !date || !amounts || !documentType || !currency || vatRate == null) {
    return { ok: false, errors, warnings };
  }
  return {
    ok: true,
    warnings,
    value: {
      date,
      costItemId,
      blockId,
      supplierId,
      newSupplier,
      description: row.description?.trim() || null,
      documentType,
      documentNo: row.documentNo?.trim() || null,
      quantity,
      unit: row.unit?.trim() || null,
      unitPrice,
      currency,
      exchangeRate,
      vatRate,
      amounts,
      dueDate,
      paymentStatus,
      paymentMethod: paymentMethod === "invalid" ? null : paymentMethod,
      paidAt: paymentStatus === "PAID" ? (paidAtParsed ?? date) : null,
    },
  };
}
