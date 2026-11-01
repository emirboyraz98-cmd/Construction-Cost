import "server-only";
import Decimal from "decimal.js";
import type { UnitOwner, UsageType } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { areaChecks, generateUnits } from "@/lib/budget/units";
import { ActionError, requireProjectAccess, requireProjectCapability } from "./access";
import { writeAudit } from "./audit";
import { db } from "./db";

// Bağımsız bölümler ve arsa sahipleri (PLAN.md 5.3, 5.5).

const dec = (value: { toString(): string } | null | undefined) => (value == null ? null : new Decimal(value.toString()));

export async function getUnitsOverview(projectId: string) {
  const { role } = await requireProjectAccess(projectId);
  const [project, blocks, units, landowners] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { landModel: true } }),
    db.block.findMany({ where: { projectId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.unit.findMany({ where: { projectId }, orderBy: [{ floor: "asc" }, { doorNo: "asc" }], include: { landowner: { select: { name: true } } } }),
    db.landowner.findMany({ where: { projectId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const checks = areaChecks(
    blocks.map((b) => ({ id: b.id, name: b.name, constructionArea: dec(b.constructionArea) })),
    units.map((u) => ({ blockId: u.blockId, grossArea: dec(u.grossArea)!, netArea: dec(u.netArea)!, owner: u.owner, landownerId: u.landownerId })),
    landowners.map((l) => ({ id: l.id, name: l.name, sharePercent: dec(l.sharePercent)! })),
  );
  // Kapı no'ları sayısal sırada (2, 10 değil 10, 2).
  units.sort((a, b) => a.floor - b.floor || a.doorNo.localeCompare(b.doorNo, "tr", { numeric: true }));
  return { landModel: project?.landModel ?? null, blocks, units, landowners, checks, canEdit: hasCapability(role, "units.edit") };
}

export type UnitData = {
  blockId: string;
  floor: number;
  doorNo: string;
  usageType: UsageType;
  layout: string | null;
  netArea: Decimal;
  grossArea: Decimal;
  commonAreaShare: Decimal | null;
  facade: string | null;
  view: string | null;
  extraArea: Decimal | null;
  owner: UnitOwner;
  landownerId: string | null;
  notes: string | null;
};

async function validateUnitRefs(projectId: string, data: Pick<UnitData, "blockId" | "landownerId" | "owner">) {
  if (!(await db.block.count({ where: { id: data.blockId, projectId } }))) throw new ActionError("Blok bu projede yok.");
  if (data.owner === "LANDOWNER" && data.landownerId && !(await db.landowner.count({ where: { id: data.landownerId, projectId } }))) {
    throw new ActionError("Arsa sahibi bu projede yok.");
  }
}

export async function saveUnit(projectId: string, unitId: string | null, data: UnitData) {
  const { user } = await requireProjectCapability(projectId, "units.edit");
  await validateUnitRefs(projectId, data);
  const columns = { ...data, landownerId: data.owner === "LANDOWNER" ? data.landownerId : null };
  const dup = await db.unit.findFirst({ where: { blockId: data.blockId, doorNo: data.doorNo, id: unitId ? { not: unitId } : undefined } });
  if (dup) throw new ActionError(`Bu blokta ${data.doorNo} numaralı bölüm zaten var.`);
  await db.$transaction(async (tx) => {
    const saved = unitId
      ? await tx.unit.update({ where: { id: unitId, projectId }, data: columns })
      : await tx.unit.create({ data: { projectId, ...columns } });
    await writeAudit(tx, { userId: user.id, projectId, action: unitId ? "update" : "create", entity: "Unit", entityId: saved.id, changes: { doorNo: data.doorNo, gross: data.grossArea.toString() } });
  });
}

export async function deleteUnits(projectId: string, unitIds: string[]) {
  const { user } = await requireProjectCapability(projectId, "units.edit");
  await db.$transaction(async (tx) => {
    const result = await tx.unit.deleteMany({ where: { id: { in: unitIds }, projectId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "Unit", changes: { count: result.count } });
  });
}

/** Seçilen bölümlerin sahipliğini toplu değiştirir (arsa sahibine verilecekler). */
export async function setUnitsOwner(projectId: string, unitIds: string[], owner: UnitOwner, landownerId: string | null) {
  const { user } = await requireProjectCapability(projectId, "units.edit");
  if (owner === "LANDOWNER" && landownerId && !(await db.landowner.count({ where: { id: landownerId, projectId } }))) throw new ActionError("Arsa sahibi bu projede yok.");
  await db.$transaction(async (tx) => {
    const result = await tx.unit.updateMany({ where: { id: { in: unitIds }, projectId }, data: { owner, landownerId: owner === "LANDOWNER" ? landownerId : null } });
    await writeAudit(tx, { userId: user.id, projectId, action: "set_owner", entity: "Unit", changes: { count: result.count, owner, landownerId } });
  });
}

export async function generateUnitsForBlock(projectId: string, spec: Parameters<typeof generateUnits>[0]) {
  const { user } = await requireProjectCapability(projectId, "units.edit");
  if (!(await db.block.count({ where: { id: spec.blockId, projectId } }))) throw new ActionError("Blok bu projede yok.");
  if (spec.toFloor < spec.fromFloor) throw new ActionError("Son kat ilk kattan küçük olamaz.");
  const rows = generateUnits(spec);
  if (rows.length > 500) throw new ActionError("Bir seferde en fazla 500 bölüm üretilir.");
  const existing = new Set((await db.unit.findMany({ where: { blockId: spec.blockId }, select: { doorNo: true } })).map((u) => u.doorNo));
  const clash = rows.find((r) => existing.has(r.doorNo));
  if (clash) throw new ActionError(`Bu blokta ${clash.doorNo} numaralı bölüm zaten var; başlangıç kapı no'sunu değiştirin.`);
  await db.$transaction(async (tx) => {
    await tx.unit.createMany({ data: rows.map((r) => ({ projectId, ...r })) });
    await writeAudit(tx, { userId: user.id, projectId, action: "generate", entity: "Unit", changes: { blockId: spec.blockId, count: rows.length } });
  });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Arsa sahipleri
// ---------------------------------------------------------------------------

export type LandownerData = {
  name: string;
  sharePercent: Decimal;
  monthlyRentAid: Decimal | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export async function saveLandowner(projectId: string, landownerId: string | null, data: LandownerData) {
  const { user } = await requireProjectCapability(projectId, "units.edit");
  const others = await db.landowner.aggregate({ where: { projectId, id: landownerId ? { not: landownerId } : undefined }, _sum: { sharePercent: true } });
  if (new Decimal(others._sum.sharePercent?.toString() ?? 0).plus(data.sharePercent).gt(100)) throw new ActionError("Arsa sahiplerinin payları toplamı %100'ü aşamaz.");
  await db.$transaction(async (tx) => {
    const saved = landownerId
      ? await tx.landowner.update({ where: { id: landownerId, projectId }, data })
      : await tx.landowner.create({ data: { projectId, ...data } });
    await writeAudit(tx, { userId: user.id, projectId, action: landownerId ? "update" : "create", entity: "Landowner", entityId: saved.id, changes: { name: data.name, share: data.sharePercent.toString() } });
  });
}

export async function deleteLandowner(projectId: string, landownerId: string) {
  const { user } = await requireProjectCapability(projectId, "units.edit");
  await db.$transaction(async (tx) => {
    await tx.unit.updateMany({ where: { landownerId, projectId }, data: { owner: "CONTRACTOR", landownerId: null } });
    const removed = await tx.landowner.delete({ where: { id: landownerId, projectId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "Landowner", entityId: landownerId, changes: { name: removed.name } });
  });
}
