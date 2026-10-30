// Proje bazlı erişim kapsamı (saf mantık). Tüm proje sorguları bu kapsamdan
// üretilen filtreyle çalışır: yönetici tüm projeleri, diğer roller yalnızca
// ProjectPermission kaydı olan projeleri görür.
import { Role } from "@/generated/prisma/enums";
import { hasCapability, type Capability } from "./roles";

export type AccessUser = { id: string; role: Role; active: boolean };
export type ProjectGrant = { projectId: string; role: Role };

export type AccessScope =
  | { readonly all: true; readonly userRole: Role }
  | { readonly all: false; readonly userRole: Role; readonly grants: ReadonlyMap<string, Role> };

export function resolveAccessScope(
  user: AccessUser,
  grants: readonly ProjectGrant[],
): AccessScope {
  if (!user.active) return { all: false, userRole: user.role, grants: new Map() };
  if (user.role === Role.yonetici) return { all: true, userRole: user.role };
  return {
    all: false,
    userRole: user.role,
    grants: new Map(grants.map((grant) => [grant.projectId, grant.role])),
  };
}

/** Kullanıcının bu projedeki rolü; erişimi yoksa null. */
export function projectRole(scope: AccessScope, projectId: string): Role | null {
  if (scope.all) return scope.userRole;
  return scope.grants.get(projectId) ?? null;
}

export function canSeeProject(scope: AccessScope, projectId: string): boolean {
  return projectRole(scope, projectId) !== null;
}

export function canInProject(
  scope: AccessScope,
  projectId: string,
  capability: Capability,
): boolean {
  return hasCapability(projectRole(scope, projectId), capability);
}

/** Proje sorgularına eklenecek Prisma filtresi (`where`). */
export function projectWhere(scope: AccessScope): { id?: { in: string[] } } {
  return scope.all ? {} : { id: { in: [...scope.grants.keys()] } };
}

/** Bellekteki bir proje listesini kapsama göre süzer. */
export function filterVisibleProjects<T extends { id: string }>(
  scope: AccessScope,
  projects: readonly T[],
): T[] {
  return projects.filter((project) => canSeeProject(scope, project.id));
}
