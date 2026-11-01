import "server-only";
import { ancestorIds, descendantIds, isDirectChildCode } from "@/lib/cost-tree/tree";
import { ActionError, requireGlobalCapability } from "./access";
import { writeAudit } from "./audit";
import type { NewCostItem } from "./cost-items";
import { db } from "./db";

// Maliyet ağacı (İKY) şablonu: yeni projeler bu ağaçla açılır. Mevcut projeler etkilenmez.

export async function listTemplateItems() {
  await requireGlobalCapability("costTree.edit");
  const rows = await db.costItemTemplate.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, parentId: true, code: true, name: true, unit: true, description: true, active: true } });
  return rows.map((r) => ({ ...r, templateId: null }));
}

export async function addTemplateItem(input: NewCostItem) {
  const { user } = await requireGlobalCapability("costTree.edit");
  return db.$transaction(async (tx) => {
    const parent = input.parentId ? await tx.costItemTemplate.findUnique({ where: { id: input.parentId } }) : null;
    if (input.parentId && !parent) throw new ActionError("Üst kalem bulunamadı.");
    if (!isDirectChildCode(input.code, parent?.code ?? null)) {
      throw new ActionError(parent ? `Kod "${parent.code}." ile başlamalı ve bir seviye alt olmalı (ör. ${parent.code}.01).` : "Ana grup kodu iki haneli olmalı (ör. 17).");
    }
    if (await tx.costItemTemplate.findUnique({ where: { code: input.code } })) throw new ActionError(`"${input.code}" kodu şablonda zaten var.`);
    const last = await tx.costItemTemplate.aggregate({ _max: { sortOrder: true } });
    const item = await tx.costItemTemplate.create({
      data: { parentId: parent?.id ?? null, code: input.code, name: input.name, unit: input.unit, description: input.description, sortOrder: (last._max.sortOrder ?? 0) + 1, active: parent ? parent.active : true },
    });
    await writeAudit(tx, { userId: user.id, action: "create", entity: "CostItemTemplate", entityId: item.id, changes: { code: item.code, name: item.name } });
    return item;
  });
}

export async function setTemplateItemActive(itemId: string, active: boolean) {
  const { user } = await requireGlobalCapability("costTree.edit");
  await db.$transaction(async (tx) => {
    const rows = await tx.costItemTemplate.findMany({ select: { id: true, parentId: true, code: true } });
    const item = rows.find((r) => r.id === itemId);
    if (!item) throw new ActionError("Kalem bulunamadı.");
    const affected = [itemId, ...descendantIds(rows, itemId), ...(active ? ancestorIds(rows, itemId) : [])];
    await tx.costItemTemplate.updateMany({ where: { id: { in: affected } }, data: { active } });
    await writeAudit(tx, { userId: user.id, action: active ? "activate" : "deactivate", entity: "CostItemTemplate", entityId: itemId, changes: { code: item.code } });
  });
}
