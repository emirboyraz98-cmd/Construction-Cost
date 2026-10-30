"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseDecimalInput } from "@/lib/format";
import { ActionError } from "@/server/access";
import { toActionResult } from "@/server/action-error";
import { deleteParameter, saveParameter } from "@/server/parameters";

const schema = z.object({
  year: z.coerce.number().int().min(2000, "Yıl geçersiz.").max(2100, "Yıl geçersiz."),
  municipality: z.string().trim().max(100).transform((v) => v || null),
  kind: z
    .string()
    .trim()
    .min(1, "Tür seçin.")
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Tür kodu küçük harf, rakam ve alt çizgi olmalı (ör. kdv_orani)."),
  value: z.string(),
  unit: z.string().trim().max(20).transform((v) => v || null),
  description: z.string().trim().max(200).transform((v) => v || null),
});

export async function saveParameterAction(parameterId: string | null, input: z.input<typeof schema>) {
  try {
    const data = schema.parse(input);
    const value = parseDecimalInput(data.value);
    if (!value.ok || value.value == null) throw new ActionError("Değer geçerli bir sayı olmalı.");
    await saveParameter(parameterId, { ...data, value: value.value });
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/settings/parameters");
  return { ok: true as const };
}

export async function deleteParameterAction(parameterId: string) {
  try {
    await deleteParameter(z.string().min(1).parse(parameterId));
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/settings/parameters");
  return { ok: true as const };
}
