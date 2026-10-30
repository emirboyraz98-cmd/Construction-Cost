import "server-only";
import { canSeeProject } from "@/lib/auth/access";
import { moveTab } from "@/lib/tabs";
import { Prisma } from "@/generated/prisma/client";
import { getAccess } from "./access";
import { db } from "./db";

export type OpenTab = { projectId: string; name: string; position: number };

/** Kullanıcının açık sekmeleri; yetkisi kaldırılan projelerin sekmeleri gösterilmez. */
export async function listOpenTabs(): Promise<OpenTab[]> {
  const { user, scope } = await getAccess();
  const tabs = await db.userTab.findMany({
    where: { userId: user.id },
    orderBy: { position: "asc" },
    select: { projectId: true, position: true, project: { select: { name: true } } },
  });
  return tabs
    .filter((tab) => canSeeProject(scope, tab.projectId))
    .map((tab) => ({ projectId: tab.projectId, name: tab.project.name, position: tab.position }));
}

export async function openProjectTab(projectId: string): Promise<void> {
  const { user, scope } = await getAccess();
  if (!canSeeProject(scope, projectId)) return;
  const exists = await db.userTab.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  });
  if (exists) return;
  const last = await db.userTab.aggregate({ where: { userId: user.id }, _max: { position: true } });
  try {
    await db.userTab.create({
      data: { userId: user.id, projectId, position: (last._max.position ?? -1) + 1 },
    });
  } catch (error) {
    // Aynı anda iki istekle açılmışsa sorun değil.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
}

/** Sekmeyi kapatır; proje silinmez, Projeler listesinden yeniden açılır. */
export async function closeProjectTab(projectId: string): Promise<void> {
  const { user } = await getAccess();
  await db.userTab.deleteMany({ where: { userId: user.id, projectId } });
}

export async function moveProjectTab(projectId: string, toIndex: number): Promise<void> {
  const { user } = await getAccess();
  await db.$transaction(async (tx) => {
    const tabs = await tx.userTab.findMany({
      where: { userId: user.id },
      select: { projectId: true, position: true },
    });
    const reordered = moveTab(tabs, projectId, toIndex);
    for (const tab of reordered) {
      await tx.userTab.update({
        where: { userId_projectId: { userId: user.id, projectId: tab.projectId } },
        data: { position: tab.position },
      });
    }
  });
}
