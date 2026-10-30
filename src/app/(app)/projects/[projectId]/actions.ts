"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { optionalText, requiredText } from "@/lib/validation/fields";
import { blockSchema, projectInfoSchema, type BlockInput, type ProjectInfoInput } from "@/lib/validation/project";
import { toActionResult } from "@/server/action-error";
import { createBlock, deleteBlock, updateBlock } from "@/server/blocks";
import { addCostItem, setCostItemActive } from "@/server/cost-items";
import { updateProject } from "@/server/projects";

const id = z.string().min(1).max(100);

export async function updateProjectAction(projectId: string, input: ProjectInfoInput): Promise<ActionResult> {
  try {
    await updateProject(id.parse(projectId), projectInfoSchema.parse(input));
  } catch (error) {
    return toActionResult(error);
  }
  // Proje adı sekmelerde ve menüde de görünür.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveBlockAction(
  projectId: string,
  blockId: string | null,
  input: BlockInput,
): Promise<ActionResult> {
  try {
    const data = blockSchema.parse(input);
    if (blockId) await updateBlock(id.parse(projectId), id.parse(blockId), data);
    else await createBlock(id.parse(projectId), data);
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true };
}

export async function deleteBlockAction(projectId: string, blockId: string): Promise<ActionResult> {
  try {
    await deleteBlock(id.parse(projectId), id.parse(blockId));
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true };
}

const costItemSchema = z.object({
  parentId: z.string().min(1).nullable(),
  code: z.string().trim().min(1, "Kod zorunludur.").max(20),
  name: requiredText("Kalem adı", 200),
  unit: optionalText(20),
  description: optionalText(500),
});

export async function addCostItemAction(
  projectId: string,
  input: z.input<typeof costItemSchema>,
): Promise<ActionResult> {
  try {
    await addCostItem(id.parse(projectId), costItemSchema.parse(input));
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true };
}

export async function setCostItemActiveAction(
  projectId: string,
  itemId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    await setCostItemActive(id.parse(projectId), id.parse(itemId), z.boolean().parse(active));
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true };
}
