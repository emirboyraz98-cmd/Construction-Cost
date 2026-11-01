// Türkçe sayı / para / tarih biçimleme ve kullanıcı girdisinden ondalık okuma.
// Hesaplarda float kullanılmaz; değerler decimal.js ile taşınır.
import Decimal from "decimal.js";

export { Decimal };

export type DecimalParseResult = { ok: true; value: Decimal | null } | { ok: false };

/**
 * "1.250,50" → 1250.50, "1,5" → 1.5, "0.35" → 0.35, "1.500" → 1500, "" → null.
 * Virgül varsa ondalık ayırıcıdır ve noktalar binlik ayırıcıdır. Yalnızca nokta varsa,
 * "1.500" / "12.500.000" gibi binlik gruplama biçimindeyse binlik, değilse ondalık sayılır.
 */
export function parseDecimalInput(input: string | null | undefined): DecimalParseResult {
  const raw = (input ?? "").replace(/[\s  ]/g, "");
  if (raw === "") return { ok: true, value: null };

  let normalized: string;
  if (raw.includes(",")) {
    if (raw.split(",").length > 2) return { ok: false };
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else {
    normalized = raw;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return { ok: false };
  return { ok: true, value: new Decimal(normalized) };
}

type DecimalLike = Decimal | string | number | { toString(): string };

function toDecimalString(value: DecimalLike): `${number}` {
  return new Decimal(value.toString()).toString() as `${number}`;
}

/** 1250.5 → "1.250,5" */
export function formatNumber(value: DecimalLike | null | undefined, maxFractionDigits = 2): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: maxFractionDigits }).format(
    toDecimalString(value),
  );
}

/** 1250000 → "₺1.250.000,00" */
export function formatMoney(value: DecimalLike | null | undefined, currency = "TRY"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(
    toDecimalString(value),
  );
}

/** Formdaki metin kutusuna geri yazmak için: 1250.5 → "1250,5" (binlik ayırıcısız). */
export function decimalToInput(value: DecimalLike | null | undefined): string {
  if (value == null) return "";
  return new Decimal(value.toString()).toString().replace(".", ",");
}

/** Yalnızca tarih alanları (veritabanında DATE): UTC gece yarısı olarak saklanır. */
export function formatDateOnly(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(value),
  );
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

/** <input type="date"> değeri ("2026-10-30") ↔ Date (UTC gece yarısı) */
export function dateInputToDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateToDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
