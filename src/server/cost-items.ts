import "server-only";
import { ancestorIds, descendantIds, isDirectChildCode } from "@/lib/cost-tree/tree";
import { ActionError, requireProjectCapability } from "./access";
import { writeAudit } from "./audit";
import { db } from "./db";

export type NewCostItem = {
  parentId: string | null;
  code: string;
  name: string;
  unit: string | null;
  description: string | null;
};

export async function listCostItems(projectId: string) {
  return db.costItem.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      parentId: true,
      code: true,
      name: true,
      unit: true,
      description: true,
      active: true,
      templateId: true,
    },
  });
}

export async function addCostItem(projectId: string, input: NewCostItem) {
  const { user } = await requireProjectCapability(projectId, "costTree.edit");

  return db.$transaction(async (tx) => {
    const parent = input.parentId
      ? await tx.costItem.findFirst({ where: { id: input.parentId, projectId } })
      : null;
    if (input.parentId && !parent) throw new ActionError("Üst kalem bulunamadı.");
    if (!isDirectChildCode(input.code, parent?.code ?? null)) {
      throw new ActionError(
        parent
          ? `Kod "${parent.code}." ile başlamalı ve bir seviye alt olmalı (ör. ${parent.code}.01).`
          : "Ana grup kodu iki haneli olmalı (ör. 17).",
      );
    }
    const duplicate = await tx.costItem.findUnique({
      where: { projectId_code: { projectId, code: input.code } },
    });
    if (duplicate) throw new ActionError(`"${input.code}" kodu bu projede zaten kullanılıyor.`);

    const last = await tx.costItem.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    const item = await tx.costItem.create({
      data: {
        projectId,
        parentId: parent?.id ?? null,
        code: input.code,
        name: input.name,
        unit: input.unit,
        description: input.description,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        // Pasif bir grubun altına eklenen kalem de pasif başlar.
        active: parent ? parent.active : true,
      },
    });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: "create",
      entity: "CostItem",
      entityId: item.id,
      changes: { code: item.code, name: item.name, unit: item.unit },
    });
    return item;
  });
}

/**
 * Kalemi pasifleştirir/aktifleştirir. Pasifleştirme alt kalemlere de uygulanır;
 * aktifleştirme alt kalemlere ve (görünür olması için) üst kalemlere uygulanır.
 * Kalemler silinmez; harcamalar (Faz 1) pasif kalemlere bağlı kalabilir.
 */
export async function setCostItemActive(projectId: string, itemId: string, active: boolean) {
  const { user } = await requireProjectCapability(projectId, "costTree.edit");

  return db.$transaction(async (tx) => {
    const rows = await tx.costItem.findMany({
      where: { projectId },
      select: { id: true, parentId: true, code: true },
    });
    const item = rows.find((row) => row.id === itemId);
    if (!item) throw new ActionError("Kalem bulunamadı.");

    const affected = [
      itemId,
      ...descendantIds(rows, itemId),
      ...(active ? ancestorIds(rows, itemId) : []),
    ];
    const result = await tx.costItem.updateMany({
      where: { projectId, id: { in: affected }, active: !active },
      data: { active },
    });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: active ? "activate" : "deactivate",
      entity: "CostItem",
      entityId: itemId,
      changes: { code: item.code, affectedCount: result.count },
    });
    return result.count;
  });
}
