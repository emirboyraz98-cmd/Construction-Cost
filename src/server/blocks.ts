import "server-only";
import type { z } from "zod";
import type { blockSchema } from "@/lib/validation/project";
import { ActionError, requireProjectCapability } from "./access";
import { diffFields, writeAudit } from "./audit";
import { db } from "./db";

type BlockData = z.output<typeof blockSchema>;

async function assertUniqueName(projectId: string, name: string, exceptId?: string) {
  const sameName = await db.block.findMany({
    where: { projectId, NOT: exceptId ? { id: exceptId } : undefined },
    select: { name: true },
  });
  const key = name.toLocaleLowerCase("tr-TR");
  if (sameName.some((block) => block.name.toLocaleLowerCase("tr-TR") === key)) {
    throw new ActionError(`"${name}" adında bir blok zaten var.`);
  }
}

export async function createBlock(projectId: string, data: BlockData) {
  const { user } = await requireProjectCapability(projectId, "blocks.edit");
  await assertUniqueName(projectId, data.name);
  return db.$transaction(async (tx) => {
    const last = await tx.block.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    const block = await tx.block.create({
      data: { ...data, projectId, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: "create",
      entity: "Block",
      entityId: block.id,
      changes: { name: block.name },
    });
    return block;
  });
}

export async function updateBlock(projectId: string, blockId: string, data: BlockData) {
  const { user } = await requireProjectCapability(projectId, "blocks.edit");
  const before = await db.block.findFirst({ where: { id: blockId, projectId } });
  if (!before) throw new ActionError("Blok bulunamadı.");
  await assertUniqueName(projectId, data.name, blockId);
  await db.$transaction(async (tx) => {
    await tx.block.update({ where: { id: blockId }, data });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: "update",
      entity: "Block",
      entityId: blockId,
      changes: diffFields(before, data),
    });
  });
}

export async function deleteBlock(projectId: string, blockId: string) {
  const { user } = await requireProjectCapability(projectId, "blocks.edit");
  const block = await db.block.findFirst({ where: { id: blockId, projectId } });
  if (!block) throw new ActionError("Blok bulunamadı.");
  const count = await db.block.count({ where: { projectId } });
  if (count <= 1) throw new ActionError("Projede en az bir blok kalmalı.");
  await db.$transaction(async (tx) => {
    await tx.block.delete({ where: { id: blockId } });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: "delete",
      entity: "Block",
      entityId: blockId,
      changes: { name: block.name },
    });
  });
}
