"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AttemptLimiter, EMAIL_RULE, IP_RULE, minutesText } from "@/lib/auth/rate-limit";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { createSession } from "@/server/session";

export type LoginState = { error?: string; email?: string };

// Var olmayan e-postada da şifre doğrulaması yapılır ki yanıt süresi hesabın
// varlığını ele vermesin.
let dummyHash: Promise<string> | undefined;

// Şifre deneme saldırılarına karşı: e-posta başına 15 dakikada 5, adres başına 20 hatalı deneme.
const byEmail = new AttemptLimiter(EMAIL_RULE);
const byIp = new AttemptLimiter(IP_RULE);

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "E-posta ve şifrenizi girin.", email };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "yerel";
  const locked = Math.max(byEmail.lockedFor(email), byIp.lockedFor(ip));
  if (locked) return { error: `Çok fazla hatalı deneme. ${minutesText(locked)} sonra tekrar deneyin veya yöneticinizden şifre sıfırlamasını isteyin.`, email };

  const user = await db.user.findUnique({ where: { email } });
  dummyHash ??= hashPassword("yok-boyle-bir-sifre");
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) {
    const lock = Math.max(byEmail.fail(email), byIp.fail(ip));
    if (lock) {
      await db.$transaction((tx) => writeAudit(tx, { userId: user?.id ?? null, action: "login_locked", entity: "User", entityId: user?.id ?? null, changes: { email, ip } }));
      return { error: `Çok fazla hatalı deneme; giriş ${minutesText(lock)} kilitlendi.`, email };
    }
    return { error: "E-posta veya şifre hatalı.", email };
  }
  byEmail.reset(email);
  if (!user.active) return { error: "Hesabınız pasif durumda. Yöneticinize başvurun.", email };

  await createSession(user.id);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(tx, { userId: user.id, action: "login", entity: "User", entityId: user.id });
  });
  redirect("/");
}
