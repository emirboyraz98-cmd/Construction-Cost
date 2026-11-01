// Excel'den kopyala-yapıştır ve CSV/Excel içe aktarma için tablo ayrıştırma ve sütun eşleştirme.
import Decimal from "decimal.js";
import { parseDecimalInput } from "../format";

/** İçe aktarılan sütunların karşılık geldiği harcama alanları. */
export const IMPORT_FIELDS = [
  "date",
  "supplierName",
  "supplierTaxNumber",
  "documentType",
  "documentNo",
  "description",
  "costItem",
  "block",
  "quantity",
  "unit",
  "unitPrice",
  "netAmount",
  "vatRate",
  "vatAmount",
  "totalAmount",
  "currency",
  "exchangeRate",
  "dueDate",
  "paymentStatus",
  "paymentMethod",
  "paidAt",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  date: "Tarih",
  supplierName: "Tedarikçi",
  supplierTaxNumber: "Vergi / TC no",
  documentType: "Belge türü",
  documentNo: "Belge no",
  description: "Açıklama",
  costItem: "Maliyet kalemi (kod veya ad)",
  block: "Blok",
  quantity: "Miktar",
  unit: "Birim",
  unitPrice: "Birim fiyat (KDV hariç)",
  netAmount: "Matrah (KDV hariç)",
  vatRate: "KDV %",
  vatAmount: "KDV tutarı",
  totalAmount: "Toplam (KDV dahil)",
  currency: "Para birimi",
  exchangeRate: "Kur",
  dueDate: "Vade",
  paymentStatus: "Ödeme durumu",
  paymentMethod: "Ödeme şekli",
  paidAt: "Ödeme tarihi",
};

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "KDV Tutarı (₺)" → "kdv tutari". */
export function normalizeKey(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

/** Sütun başlığı eşanlamlıları (sadeleştirilmiş). Önce tam eşleşme, sonra içerme aranır. */
const SYNONYMS: Record<ImportField, string[]> = {
  date: ["tarih", "fatura tarihi", "belge tarihi", "islem tarihi", "date"],
  supplierName: ["tedarikci", "firma", "cari", "unvan", "cari unvan", "satici", "tedarikci adi", "firma adi", "tasaron"],
  supplierTaxNumber: ["vergi no", "vkn", "tckn", "vergi numarasi", "vergi kimlik no", "tc no", "vkn tckn"],
  documentType: ["belge turu", "belge tipi", "evrak turu", "fatura tipi"],
  documentNo: ["belge no", "fatura no", "evrak no", "seri no", "fatura numarasi", "belge numarasi"],
  description: ["aciklama", "urun", "hizmet", "mal hizmet", "detay", "not"],
  costItem: ["maliyet kalemi", "kalem", "iky", "iky kodu", "kalem kodu", "kod", "gider kalemi"],
  block: ["blok"],
  quantity: ["miktar", "adet"],
  unit: ["birim", "olcu birimi"],
  unitPrice: ["birim fiyat", "birim fiyati", "fiyat"],
  netAmount: ["matrah", "tutar", "kdv haric", "kdv haric tutar", "ara toplam", "net tutar"],
  vatRate: ["kdv %", "kdv orani", "kdv oran", "%"],
  vatAmount: ["kdv", "kdv tutari", "hesaplanan kdv"],
  totalAmount: ["toplam", "genel toplam", "kdv dahil", "kdv dahil tutar", "odenecek tutar", "toplam tutar"],
  currency: ["para birimi", "doviz", "doviz cinsi", "pb"],
  exchangeRate: ["kur", "doviz kuru", "islem kuru"],
  dueDate: ["vade", "vade tarihi", "son odeme tarihi"],
  paymentStatus: ["odeme durumu", "odendi mi", "durum"],
  paymentMethod: ["odeme sekli", "odeme yontemi", "odeme turu"],
  paidAt: ["odeme tarihi", "odendigi tarih"],
};

/** Başlıklardan sütun → alan eşleştirmesi tahmini (her alan en fazla bir sütuna). */
export function guessColumnMapping(headers: readonly string[]): (ImportField | null)[] {
  const keys = headers.map(normalizeKey);
  const result: (ImportField | null)[] = keys.map(() => null);
  const used = new Set<ImportField>();
  const assign = (matcher: (key: string, synonym: string) => boolean) => {
    keys.forEach((key, column) => {
      if (result[column] || !key) return;
      for (const field of IMPORT_FIELDS) {
        if (used.has(field)) continue;
        if (SYNONYMS[field].some((synonym) => matcher(key, synonym))) {
          result[column] = field;
          used.add(field);
          return;
        }
      }
    });
  };
  assign((key, synonym) => key === synonym);
  assign((key, synonym) => synonym.length > 2 && key.includes(synonym));
  return result;
}

/** Sekme, noktalı virgül veya virgülle ayrılmış metni (Excel'den yapıştırma, CSV) satırlara böler. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : (firstLine.match(/;/g)?.length ?? 0) > 0
      ? ";"
      : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Tarih: Date, Excel seri numarası, "30.10.2026", "30/10/26", "2026-10-30" → UTC gece yarısı. */
export function parseDateValue(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "number") {
    if (value < 1 || value > 100000) return null;
    return new Date(EXCEL_EPOCH + Math.floor(value) * 86_400_000);
  }
  const text = String(value).trim();
  let year: number;
  let month: number;
  let day: number;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
    if (!match) {
      if (/^\d{5}$/.test(text)) return parseDateValue(Number(text));
      return null;
    }
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (year < 100) year += 2000;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export type NumberParse = { ok: true; value: Decimal | null } | { ok: false };

/** Sayı: Excel'den gelen sayı ya da Türkçe/İngilizce biçimli metin ("1.250,50", "₺ 1.250,50", "%20"). */
export function parseNumberValue(value: unknown): NumberParse {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { ok: true, value: new Decimal(String(value)) } : { ok: false };
  }
  const text = String(value).replace(/[₺$€£%]|TL|TRY/gi, "");
  return parseDecimalInput(text);
}
