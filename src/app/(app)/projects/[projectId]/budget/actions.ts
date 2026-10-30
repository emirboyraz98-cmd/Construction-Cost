"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { budgetLineSchema, coefficientSchema } from "@/lib/validation/building";
import { toActionResult } from "@/server/action-error";
import { addCoefficientLines, deleteBudgetLine, deleteCoefficient, saveBudgetLine, saveCoefficient } from "@/server/budget";

const id = z.string().min(1).max(100);

async function run(projectId: string, action: () => Promise<unknown>) {
  try {
    const result = await action();
    revalidatePath(`/projects/${projectId}`, "layout");
    revalidatePath("/portfolio");
    return { ok: true as const, count: typeof result === "number" ? result : 0 };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveBudgetLineAction(projectId: string, lineId: string | null, input: unknown) {
  return run(projectId, () => saveBudgetLine(id.parse(projectId), lineId ? id.parse(lineId) : null, budgetLineSchema.parse(input)));
}
export async function deleteBudgetLineAction(projectId: string, lineId: string) {
  return run(projectId, () => deleteBudgetLine(id.parse(projectId), id.parse(lineId)));
}
export async function saveCoefficientAction(projectId: string, coefficientId: string | null, input: unknown) {
  return run(projectId, () => saveCoefficient(id.parse(projectId), coefficientId ? id.parse(coefficientId) : null, coefficientSchema.parse(input)));
}
export async function deleteCoefficientAction(projectId: string, coefficientId: string) {
  return run(projectId, () => deleteCoefficient(id.parse(projectId), id.parse(coefficientId)));
}
export async function addCoefficientLinesAction(projectId: string, coefficientIds: string[]) {
  return run(projectId, () => addCoefficientLines(id.parse(projectId), z.array(id).min(1).max(200).parse(coefficientIds)));
}
