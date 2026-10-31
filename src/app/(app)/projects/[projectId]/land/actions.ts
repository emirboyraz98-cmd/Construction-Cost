"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optionalText, requiredDate, requiredDecimal } from "@/lib/validation/fields";
import { toActionResult } from "@/server/action-error";
import { addLandInstallment } from "@/server/land";

export async function addLandInstallmentAction(projectId: string, input: unknown) {
  try {
    const data = z
      .object({ dueDate: requiredDate("Vade"), amount: requiredDecimal("Tutar", { positive: true }), vatRate: requiredDecimal("KDV oranı", { min: 0, max: 100 }), description: optionalText(200) })
      .parse(input);
    await addLandInstallment(z.string().min(1).parse(projectId), { ...data, supplierId: null });
    revalidatePath(`/projects/${projectId}`, "layout");
    revalidatePath("/company/payables");
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}
