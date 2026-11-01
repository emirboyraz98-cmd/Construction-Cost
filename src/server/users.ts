import "server-only";
import type { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { createUserSchema, updateUserSchema } from "@/lib/validation/user";
import { ActionError, getAccess, requireGlobalCapability } from "./access";
import { diffFields, writeAudit } from "./audit";
import { db, type Tx } from "./db";

type CreateUserData = z.output<typeof createUserSchema>;
type UpdateUserData = z.output<typeof updateUserSchema>;
type Permission = CreateUserData["permissions"][number];

export async function listUsers() {
  await requireGlobalCapability("users.manage");
  return db.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      lastLoginAt: true,
      _count: { select: { permissions: true } },
    },
  });
}

export async function getUserForEdit(userId: string) {
  await requireGlobalCapability("users.manage");
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      permissions: { select: { projectId: true, role: true } },
    },
  });
}

async function assertEmailFree(email: string, exceptUserId?: string) {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== exceptUserId) {
    throw new ActionError("Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.");
  }
}

/** Yönetici tüm projeleri zaten görür; projeye özel yetki yalnızca diğer roller için tutulur. */
async function replacePermissions(tx: Tx, userId: string, role: string, permissions: Permission[]) {
  await tx.projectPermission.deleteMany({ where: { userId } });
  if (role === "yonetici" || permissions.length === 0) return;
  const projectIds = new Set(
    (
      await tx.project.findMany({
        where: { id: { in: permissions.map((p) => p.projectId) } },
        select: { id: true },
      })
    ).map((p) => p.id),
  );
  await tx.projectPermission.createMany({
    data: permissions
      .filter((p) => projectIds.has(p.projectId) && p.role !== "yonetici")
      .map((p) => ({ userId, projectId: p.projectId, role: p.role })),
    skipDuplicates: true,
  });
}

export async function createUser(data: CreateUserData) {
  const { user: actor } = await requireGlobalCapability("users.manage");
  await assertEmailFree(data.email);
  const passwordHash = await hashPassword(data.password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        passwordHash,
      },
    });
    await replacePermissions(tx, user.id, data.role, data.permissions);
    await writeAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "User",
      entityId: user.id,
      changes: { email: user.email, role: user.role, projects: data.permissions.length },
    });
    return user;
  });
}

export async function updateUser(userId: string, data: UpdateUserData) {
  const { user: actor } = await requireGlobalCapability("users.manage");
  const before = await db.user.findUnique({ where: { id: userId } });
  if (!before) throw new ActionError("Kullanıcı bulunamadı.");
  await assertEmailFree(data.email, userId);

  const isSelf = actor.id === userId;
  if (isSelf && !data.active) throw new ActionError("Kendi hesabınızı pasifleştiremezsiniz.");
  if (isSelf && data.role !== "yonetici") {
    throw new ActionError("Kendi yönetici rolünüzü kaldıramazsınız.");
  }
  const losesAdmin = before.role === "yonetici" && (data.role !== "yonetici" || !data.active);
  if (losesAdmin) {
    const otherAdmins = await db.user.count({
      where: { role: "yonetici", active: true, NOT: { id: userId } },
    });
    if (otherAdmins === 0) throw new ActionError("En az bir aktif yönetici kalmalı.");
  }

  const passwordHash = data.password ? await hashPassword(data.password) : undefined;
  await db.$transaction(async (tx) => {
    const fields = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      active: data.active,
    };
    await tx.user.update({ where: { id: userId }, data: { ...fields, passwordHash } });
    await replacePermissions(tx, userId, data.role, data.permissions);
    // Pasifleştirilen veya şifresi değiştirilen kullanıcının açık oturumları kapatılır.
    if (!data.active || passwordHash) await tx.session.deleteMany({ where: { userId } });
    await writeAudit(tx, {
      userId: actor.id,
      action: before.active && !data.active ? "deactivate" : "update",
      entity: "User",
      entityId: userId,
      changes: {
        ...diffFields(before, fields),
        ...(passwordHash ? { password: { old: null, new: "(değiştirildi)" } } : {}),
        projectCount: data.role === "yonetici" ? "tümü" : data.permissions.length,
      },
    });
  });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const { user } = await getAccess();
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, record.passwordHash))) {
    throw new ActionError("Mevcut şifre hatalı.");
  }
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await writeAudit(tx, {
      userId: user.id,
      action: "update",
      entity: "User",
      entityId: user.id,
      changes: { password: { old: null, new: "(değiştirildi)" } },
    });
  });
}
