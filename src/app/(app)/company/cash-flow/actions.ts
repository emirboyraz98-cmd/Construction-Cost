"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requiredDecimal } from "@/lib/validation/fields";
import { toActionResult } from "@/server/action-error";
import { saveCompanyCashSettings } from "@/server/cashflow";

export async function saveCompanyCashAction(input: unknown) {
  try {
    const data = z.object({ openingCash: requiredDecimal("Başlangıç nakdi", { min: -1e12, max: 1e12 }), monthlyOverhead: requiredDecimal("Genel merkez gideri", { min: 0, max: 1e11 }) }).parse(input);
    await saveCompanyCashSettings(data);
    revalidatePath("/company/cash-flow");
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}
