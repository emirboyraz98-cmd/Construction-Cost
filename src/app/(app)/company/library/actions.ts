"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recipeSchema, resourcePriceSchema, resourceSchema } from "@/lib/validation/building";
import { toActionResult } from "@/server/action-error";
import { addResourcePrice, applyLearnedMatches, deleteResourcePrice, matchInvoices, saveRecipe, saveResource } from "@/server/library";

const id = z.string().min(1).max(100);

function refresh() {
  revalidatePath("/company/library", "layout");
  revalidatePath("/projects", "layout");
}

export async function saveResourceAction(resourceId: string | null, input: unknown) {
  try {
    const savedId = await saveResource(resourceId ? id.parse(resourceId) : null, resourceSchema.parse(input));
    refresh();
    return { ok: true as const, id: savedId };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function addPriceAction(resourceId: string, input: unknown) {
  try {
    await addResourcePrice(id.parse(resourceId), resourcePriceSchema.parse(input));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deletePriceAction(priceId: string) {
  try {
    await deleteResourcePrice(id.parse(priceId));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveRecipeAction(recipeId: string | null, input: unknown) {
  try {
    const savedId = await saveRecipe(recipeId ? id.parse(recipeId) : null, recipeSchema.parse(input));
    refresh();
    return { ok: true as const, id: savedId };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function matchInvoicesAction(pairs: { expenseId: string; resourceId: string | null }[]) {
  try {
    const count = await matchInvoices(z.array(z.object({ expenseId: id, resourceId: id.nullable() })).min(1).max(500).parse(pairs));
    refresh();
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function applyLearnedAction() {
  try {
    const count = await applyLearnedMatches();
    refresh();
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}
