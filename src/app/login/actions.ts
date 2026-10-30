"use server";

import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { createSession } from "@/server/session";

export type LoginState = { error?: string; email?: string };

// Var olmayan e-postada da şifre doğrulaması yapılır ki yanıt süresi hesabın
// varlığını ele vermesin.
let dummyHash: Promise<string> | undefined;

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "E-posta ve şifrenizi girin.", email };

  const user = await db.user.findUnique({ where: { email } });
  dummyHash ??= hashPassword("yok-boyle-bir-sifre");
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) return { error: "E-posta veya şifre hatalı.", email };
  if (!user.active) return { error: "Hesabınız pasif durumda. Yöneticinize başvurun.", email };

  await createSession(user.id);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(tx, { userId: user.id, action: "login", entity: "User", entityId: user.id });
  });
  redirect("/");
}
