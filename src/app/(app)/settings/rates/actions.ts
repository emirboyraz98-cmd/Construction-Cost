"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dateInputToDate, parseDecimalInput } from "@/lib/format";
import { ActionError } from "@/server/access";
import { toActionResult } from "@/server/action-error";
import { saveManualRate } from "@/server/rates";

export async function saveRateAction(input: { date: string; currency: string; buying: string; selling: string }) {
  try {
    const date = dateInputToDate(input.date);
    if (!date) throw new ActionError("Tarih seçin.");
    const currency = z.enum(["USD", "EUR", "GBP"]).parse(input.currency);
    const buying = parseDecimalInput(input.buying);
    const selling = parseDecimalInput(input.selling);
    if (!buying.ok || !buying.value?.gt(0)) throw new ActionError("Alış kuru geçerli bir sayı olmalı.");
    if (!selling.ok || !selling.value?.gt(0)) throw new ActionError("Satış kuru geçerli bir sayı olmalı.");
    await saveManualRate(date, currency, buying.value, selling.value);
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/settings/rates");
  return { ok: true as const };
}
