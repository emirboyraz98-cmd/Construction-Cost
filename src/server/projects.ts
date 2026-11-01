import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { projectWhere } from "@/lib/auth/access";
import { planCostTreeCopy } from "@/lib/cost-tree/tree";
import type { CreateProjectData, projectInfoSchema } from "@/lib/validation/project";
import {
  ActionError,
  getAccess,
  requireProjectAccess,
  requireProjectCapability,
  type AccessContext,
} from "./access";
import { diffFields, writeAudit } from "./audit";
import { db } from "./db";

/** Kullanıcının görebildiği projeler (yetki filtresi her zaman uygulanır). */
export async function listProjects(options: { statuses?: ProjectStatus[] } = {}) {
  const { scope } = await getAccess();
  return db.project.findMany({
    where: {
      ...projectWhere(scope),
      ...(options.statuses ? { status: { in: options.statuses } } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      _count: { select: { blocks: true } },
      blocks: { select: { constructionArea: true } },
    },
  });
}

/** Menü ve sekmeler için hafif proje listesi. */
export async function listProjectSummaries() {
  const { scope } = await getAccess();
  return db.project.findMany({
    where: projectWhere(scope),
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
}

/** Tek proje; erişim yoksa veya proje yoksa 404. */
export async function getProject(projectId: string) {
  const access = await requireProjectAccess(projectId);
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      blocks: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      _count: { select: { costItems: { where: { active: true } } } },
    },
  });
  return { ...access, project };
}

/** Yeni projeyi blokları, İKY ağacı, yetkisi ve sekmesiyle birlikte tek işlemde oluşturur. */
export async function createProject(access: AccessContext, data: CreateProjectData) {
  const { user, scope } = access;

  // Kopyalama kaynağı da kullanıcının görebildiği projelerden olmalı.
  const copySourceId = data.copyFromProjectId || null;
  if (copySourceId) {
    const visible = await db.project.count({ where: { id: copySourceId, ...projectWhere(scope) } });
    if (!visible) throw new Error("Kopyalanacak proje bulunamadı.");
  }

  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: data.name,
        type: data.type,
        status: data.status,
        address: data.address,
        landBlockNo: data.landBlockNo,
        landParcelNo: data.landParcelNo,
        landArea: data.landArea,
        floorAreaRatio: data.floorAreaRatio,
        groundCoverageRatio: data.groundCoverageRatio,
        landModel: data.landModel,
        startDate: data.startDate,
        durationMonths: data.durationMonths,
        createdById: user.id,
      },
    });

    await tx.block.createMany({
      data: data.blocks.map((block, index) => ({ ...block, projectId: project.id, sortOrder: index })),
    });

    const sources = copySourceId
      ? await tx.costItem.findMany({ where: { projectId: copySourceId } })
      : await tx.costItemTemplate.findMany({ where: { active: true } });
    const drafts = planCostTreeCopy(sources, project.id, randomUUID, !copySourceId);
    await tx.costItem.createMany({ data: drafts });

    // Projeyi açan kişi yönetici değilse kendi rolüyle projeye yetkilendirilir.
    if (user.role !== "yonetici") {
      await tx.projectPermission.create({
        data: { userId: user.id, projectId: project.id, role: user.role },
      });
    }

    const last = await tx.userTab.aggregate({ where: { userId: user.id }, _max: { position: true } });
    await tx.userTab.create({
      data: { userId: user.id, projectId: project.id, position: (last._max.position ?? -1) + 1 },
    });

    await writeAudit(tx, {
      userId: user.id,
      projectId: project.id,
      action: "create",
      entity: "Project",
      entityId: project.id,
      changes: {
        name: project.name,
        blocks: data.blocks.length,
        costItems: drafts.length,
        copiedFrom: copySourceId,
      },
    });
    return project;
  });
}

export async function updateProject(
  projectId: string,
  data: z.output<typeof projectInfoSchema>,
): Promise<void> {
  const { user } = await requireProjectCapability(projectId, "project.edit");
  const before = await db.project.findUnique({ where: { id: projectId } });
  if (!before) throw new ActionError("Proje bulunamadı.");
  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: "update",
      entity: "Project",
      entityId: projectId,
      changes: diffFields(before, data),
    });
  });
}

/** Projeye özel yetkisi olan kullanıcılar (yöneticiler tüm projeleri zaten görür). */
export async function listProjectTeam(projectId: string) {
  return db.projectPermission.findMany({
    where: { projectId, user: { active: true } },
    orderBy: { user: { name: "asc" } },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });
}
