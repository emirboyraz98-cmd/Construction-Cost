import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { db } from "./db";

const COOKIE_NAME = "oturum";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Giriş başarılı olunca oturum açar ve çerezi yazar (yalnızca Server Action içinde). */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });

  const forwardedProto = (await headers()).get("x-forwarded-proto");
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: forwardedProto === "https" || process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

/** Geçerli oturumun kullanıcısı (istek başına bir kez sorgulanır); yoksa null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true, active: true } },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
});

/** Oturum yoksa giriş ekranına yönlendirir. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(COOKIE_NAME);
}
