// Form alanları için ortak zod yardımcıları. Formlar metin gönderir; sayılar Türkçe
// biçimde ("1.250,50") yazılabilir ve Decimal'e kayıpsız çevrilir.
import { z } from "zod";
import { parseDecimalInput } from "../format";

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
