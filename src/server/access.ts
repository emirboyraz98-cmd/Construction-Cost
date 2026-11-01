import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { projectRole, resolveAccessScope, type AccessScope } from "@/lib/auth/access";
import { hasCapability, type Capability } from "@/lib/auth/roles";
import { db } from "./db";
import { requireUser, type SessionUser } from "./session";

export type AccessContext = { user: SessionUser; scope: AccessScope };

/** Oturumdaki kullanıcı ve erişebildiği projeler (istek başına bir kez hesaplanır). */
export const getAccess = cache(async (): Promise<AccessContext> => {
  const user = await requireUser();
  const grants =
    user.role === "yonetici"
      ? []
      : await db.projectPermission.findMany({
          where: { userId: user.id },
          select: { projectId: true, role: true },
        });
  return { user, scope: resolveAccessScope(user, grants) };
});

/** Kullanıcının bu projeye erişimi yoksa 404 (projenin varlığı da açığa çıkmaz). */
export async function requireProjectAccess(
  projectId: string,
): Promise<AccessContext & { role: Role }> {
  const access = await getAccess();
  const role = projectRole(access.scope, projectId);
  if (!role) notFound();
  return { ...access, role };
}

/** Server Action'larda yetki hatası; mesaj kullanıcıya gösterilir. */
export class ActionError extends Error {}

export function assertCapability(role: Role | null, capability: Capability): void {
  if (!hasCapability(role, capability)) {
    throw new ActionError("Bu işlem için yetkiniz yok.");
  }
}

export async function requireGlobalCapability(capability: Capability): Promise<AccessContext> {
  const access = await getAccess();
  assertCapability(access.user.role, capability);
  return access;
}

export async function requireProjectCapability(
  projectId: string,
  capability: Capability,
): Promise<AccessContext & { role: Role }> {
  const access = await getAccess();
  const role = projectRole(access.scope, projectId);
  if (!role) throw new ActionError("Proje bulunamadı veya bu projeye erişiminiz yok.");
  assertCapability(role, capability);
  return { ...access, role };
}
