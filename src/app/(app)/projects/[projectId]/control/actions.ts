"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optionalText, requiredDecimal, requiredText } from "@/lib/validation/fields";
import { toActionResult } from "@/server/action-error";
import { createBaseline, deleteBaseline, setItemProgress } from "@/server/control";

const id = z.string().min(1).max(100);
const refresh = (projectId: string) => {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/portfolio");
};

export async function createBaselineAction(projectId: string, input: unknown) {
  try {
    const data = z.object({ name: requiredText("Ad", 100), note: optionalText(500) }).parse(input);
    const baselineId = await createBaseline(id.parse(projectId), data.name, data.note);
    refresh(projectId);
    return { ok: true as const, id: baselineId };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteBaselineAction(projectId: string, baselineId: string) {
  try {
    await deleteBaseline(id.parse(projectId), id.parse(baselineId));
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setProgressAction(projectId: string, costItemId: string, input: { percent: string; note: string }) {
  try {
    const percent = input.percent.trim() ? requiredDecimal("Tamamlanma", { min: 0, max: 100 }).parse(input.percent) : null;
    await setItemProgress(id.parse(projectId), id.parse(costItemId), percent, optionalText(300).parse(input.note));
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}
