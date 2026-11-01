"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UnitOwner } from "@/generated/prisma/enums";
import { generateUnitsSchema, landownerSchema, unitSchema } from "@/lib/validation/building";
import { toActionResult } from "@/server/action-error";
import { deleteLandowner, deleteUnits, generateUnitsForBlock, saveLandowner, saveUnit, setUnitsOwner } from "@/server/units";

const id = z.string().min(1).max(100);
const ids = z.array(id).min(1).max(1000);
const refresh = (projectId: string) => revalidatePath(`/projects/${projectId}`, "layout");

async function run(projectId: string, action: () => Promise<unknown>) {
  try {
    const result = await action();
    refresh(projectId);
    return { ok: true as const, result: typeof result === "number" ? result : null };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveUnitAction(projectId: string, unitId: string | null, input: unknown) {
  return run(projectId, () => saveUnit(id.parse(projectId), unitId ? id.parse(unitId) : null, unitSchema.parse(input)));
}
export async function deleteUnitsAction(projectId: string, unitIds: string[]) {
  return run(projectId, () => deleteUnits(id.parse(projectId), ids.parse(unitIds)));
}
export async function setUnitsOwnerAction(projectId: string, unitIds: string[], owner: string, landownerId: string | null) {
  return run(projectId, () => setUnitsOwner(id.parse(projectId), ids.parse(unitIds), z.enum(UnitOwner).parse(owner), landownerId ? id.parse(landownerId) : null));
}
export async function generateUnitsAction(projectId: string, input: unknown) {
  return run(projectId, () => generateUnitsForBlock(id.parse(projectId), generateUnitsSchema.parse(input)));
}
export async function saveLandownerAction(projectId: string, landownerId: string | null, input: unknown) {
  return run(projectId, () => saveLandowner(id.parse(projectId), landownerId ? id.parse(landownerId) : null, landownerSchema.parse(input)));
}
export async function deleteLandownerAction(projectId: string, landownerId: string) {
  return run(projectId, () => deleteLandowner(id.parse(projectId), id.parse(landownerId)));
}
