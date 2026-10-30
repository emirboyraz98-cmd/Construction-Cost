// Form alanları için ortak zod yardımcıları. Formlar metin gönderir; sayılar Türkçe
// biçimde ("1.250,50") yazılabilir ve Decimal'e kayıpsız çevrilir.
import { z } from "zod";
import { dateInputToDate, parseDecimalInput } from "../format";

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir.`)
    .optional()
    .transform((value) => (value ? value : null));

export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} zorunludur.` })
    .trim()
    .min(1, `${label} zorunludur.`)
    .max(max, `${label} en fazla ${max} karakter olabilir.`);

/** Boş → null, aksi halde Decimal metni ("1250.5"). */
export const optionalDecimal = (label: string, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      const result = parseDecimalInput(value);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: `${label} geçerli bir sayı değil.` });
        return z.NEVER;
      }
      if (result.value && (result.value.lt(min) || result.value.gt(max))) {
        ctx.addIssue({ code: "custom", message: `${label} ${min} ile ${max} arasında olmalı.` });
        return z.NEVER;
      }
      return result.value ? result.value.toString() : null;
    });

export const optionalInt = (label: string, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      const raw = (value ?? "").trim();
      if (raw === "") return null;
      if (!/^-?\d+$/.test(raw)) {
        ctx.addIssue({ code: "custom", message: `${label} tam sayı olmalı.` });
        return z.NEVER;
      }
      const number = Number(raw);
      if (number < min || number > max) {
        ctx.addIssue({ code: "custom", message: `${label} ${min} ile ${max} arasında olmalı.` });
        return z.NEVER;
      }
      return number;
    });

/** zod hatalarını { alan: mesaj } biçimine çevirir (iç içe alanlar "blocks.0.name"). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    result[key] ??= issue.message;
  }
  return result;
}

/** Zorunlu sayı → Decimal (Türkçe biçim kabul edilir). */
export const requiredDecimal = (label: string, opts: { min?: number; max?: number; positive?: boolean } = {}) =>
  z.string({ error: `${label} zorunludur.` }).transform((value, ctx) => {
    const result = parseDecimalInput(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: `${label} geçerli bir sayı değil.` });
      return z.NEVER;
    }
    if (result.value == null) {
      ctx.addIssue({ code: "custom", message: `${label} zorunludur.` });
      return z.NEVER;
    }
    const v = result.value;
    if (opts.positive && v.lte(0)) ctx.addIssue({ code: "custom", message: `${label} sıfırdan büyük olmalı.` });
    else if (opts.min != null && v.lt(opts.min)) ctx.addIssue({ code: "custom", message: `${label} en az ${opts.min} olmalı.` });
    else if (opts.max != null && v.gt(opts.max)) ctx.addIssue({ code: "custom", message: `${label} en fazla ${opts.max} olabilir.` });
    return v;
  });

/** Boş → null, aksi halde Decimal (alt sınır 0). */
export const optionalDecimalValue = (label: string, max?: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      const result = parseDecimalInput(value);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: `${label} geçerli bir sayı değil.` });
        return z.NEVER;
      }
      const v = result.value;
      if (v && v.isNegative()) ctx.addIssue({ code: "custom", message: `${label} negatif olamaz.` });
      if (v && max != null && v.gt(max)) ctx.addIssue({ code: "custom", message: `${label} en fazla ${max} olabilir.` });
      return v;
    });

/** "2026-10-30" → Date (UTC gece yarısı). */
export const requiredDate = (label: string) =>
  z.string({ error: `${label} zorunludur.` }).transform((value, ctx) => {
    const date = dateInputToDate(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: `${label} seçin.` });
      return z.NEVER;
    }
    return date;
  });

export const optionalDate = () =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return null;
      const date = dateInputToDate(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Geçerli bir tarih seçin." });
        return z.NEVER;
      }
      return date;
    });
