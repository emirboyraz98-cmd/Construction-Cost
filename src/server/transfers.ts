import "server-only";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import type { z } from "zod";
import type { TransferInput, transferSchema } from "@/lib/validation/purchasing";
import { ActionError, getAccess } from "./access";
import { writeAudit } from "./audit";
import { db } from "./db";

// Projeler arası malzeme transferi (PLAN.md 5.1): kaynak projede eksi, hedef projede artı tutarlı
// iki TRANSFER satırı; maliyet böylece projeler arasında taşınır.

export type TransferData = z.output<typeof transferSchema>;
export type { TransferInput };

/** Kullanıcının transfer yapabildiği projeler ve kalem kodları. */
export async function transferOptions() {
  const { scope } = await getAccess();
  const [projects, templates] = await Promise.all([
    db.project.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.costItemTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true, unit: true } }),
  ]);
  return {
    projects: projects.filter((p) => hasCapability(projectRole(scope, p.id), "transfer.create")),
    costItems: templates,
  };
}

export async function listTransfers() {
  const { scope } = await getAccess();
  const rows = await db.materialTransfer.findMany({
    where: { deletedAt: null },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      fromProject: { select: { id: true, name: true } },
      toProject: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });
  const canSee = (id: string) => hasCapability(projectRole(scope, id), "expense.viewAll");
  return rows
    .filter((r) => canSee(r.fromProjectId) || canSee(r.toProjectId))
    .map((r) => ({
      ...r,
      canDelete: hasCapability(projectRole(scope, r.fromProjectId), "transfer.create") && hasCapability(projectRole(scope, r.toProjectId), "transfer.create"),
    }));
}

export async function createTransfer(data: TransferData) {
  const { user, scope } = await getAccess();
  for (const id of [data.fromProjectId, data.toProjectId]) {
    if (!hasCapability(projectRole(scope, id), "transfer.create")) throw new ActionError("İki projede de transfer yetkiniz olmalı.");
  }
  return db.$transaction(async (tx) => {
    const items = await tx.costItem.findMany({
      where: { projectId: { in: [data.fromProjectId, data.toProjectId] }, code: data.costItemCode },
      select: { id: true, projectId: true, active: true, project: { select: { name: true } } },
    });
    const from = items.find((i) => i.projectId === data.fromProjectId);
    const to = items.find((i) => i.projectId === data.toProjectId);
    if (!from || !to) throw new ActionError(`“${data.costItemCode}” maliyet kalemi iki projede de bulunmalı.`);
    if (!to.active) throw new ActionError(`“${data.costItemCode}” kalemi ${to.project.name} projesinde pasif.`);
    const transfer = await tx.materialTransfer.create({
      data: {
        date: data.date,
        fromProjectId: data.fromProjectId,
        toProjectId: data.toProjectId,
        description: data.description,
        costItemCode: data.costItemCode,
        quantity: data.quantity,
        unit: data.unit,
        amount: data.amount,
        notes: data.notes,
        createdById: user.id,
      },
    });
    for (const [projectId, costItemId, sign, other] of [
      [data.fromProjectId, from.id, -1, to.project.name],
      [data.toProjectId, to.id, 1, from.project.name],
    ] as const) {
      const amount = data.amount.times(sign);
      await tx.expense.create({
        data: {
          projectId,
          kind: "TRANSFER",
          date: data.date,
          costItemId,
          description: `${data.description} – ${sign < 0 ? `${other} projesine gönderildi` : `${other} projesinden geldi`}`,
          quantity: data.quantity ? data.quantity.times(sign) : null,
          unit: data.unit,
          currency: "TRY",
          exchangeRate: 1,
          vatRate: 0,
          netAmount: amount,
          vatAmount: 0,
          totalAmount: amount,
          netAmountTry: amount,
          vatAmountTry: 0,
          totalAmountTry: amount,
          documentType: "NONE",
          transferId: transfer.id,
          approvalStatus: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          createdById: user.id,
        },
      });
    }
    await writeAudit(tx, {
      userId: user.id,
      projectId: data.fromProjectId,
      action: "create",
      entity: "MaterialTransfer",
      entityId: transfer.id,
      changes: { to: data.toProjectId, amount: data.amount.toString(), description: data.description },
    });
    return transfer.id;
  });
}

export async function deleteTransfer(transferId: string) {
  const { user, scope } = await getAccess();
  const transfer = await db.materialTransfer.findFirst({ where: { id: transferId, deletedAt: null } });
  if (!transfer) throw new ActionError("Transfer bulunamadı.");
  for (const id of [transfer.fromProjectId, transfer.toProjectId]) {
    if (!hasCapability(projectRole(scope, id), "transfer.create")) throw new ActionError("İki projede de transfer yetkiniz olmalı.");
  }
  await db.$transaction(async (tx) => {
    const now = new Date();
    await tx.materialTransfer.update({ where: { id: transferId }, data: { deletedAt: now } });
    await tx.expense.updateMany({ where: { transferId, deletedAt: null }, data: { deletedAt: now } });
    await writeAudit(tx, { userId: user.id, projectId: transfer.fromProjectId, action: "delete", entity: "MaterialTransfer", entityId: transferId });
  });
}
