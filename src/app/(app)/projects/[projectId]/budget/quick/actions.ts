"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionResult } from "@/server/action-error";
import { saveQuickBudget } from "@/server/budget";

const rows = z
  .object({ costItemId: z.string().min(1).max(100), mode: z.enum(["m2", "lump"]), amount: z.string().regex(/^\d+(\.\d+)?$/).max(30) })
  .array()
  .max(100);

export async function saveQuickBudgetAction(projectId: string, input: unknown) {
  try {
    const pid = z.string().min(1).max(100).parse(projectId);
    const count = await saveQuickBudget(pid, rows.parse(input).map((r) => ({ ...r, amount: new Decimal(r.amount) })));
    revalidatePath(`/projects/${pid}`, "layout");
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}
