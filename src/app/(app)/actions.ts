"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getNotifications } from "@/server/notifications";
import { destroySession } from "@/server/session";
import { closeProjectTab, moveProjectTab, openProjectTab } from "@/server/tabs";
import { VIEW_COOKIE } from "@/server/view-mode";

const projectId = z.string().min(1).max(100);

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function openTabAction(id: string) {
  await openProjectTab(projectId.parse(id));
  revalidatePath("/", "layout");
}

export async function closeTabAction(id: string) {
  await closeProjectTab(projectId.parse(id));
  revalidatePath("/", "layout");
}

export async function moveTabAction(id: string, toIndex: number) {
  await moveProjectTab(projectId.parse(id), z.number().int().min(0).parse(toIndex));
  revalidatePath("/", "layout");
}

/** Bildirim zili için güncel bildirimler (Faz 8). */
export async function notificationsAction() {
  try {
    return { ok: true as const, items: await getNotifications() };
  } catch {
    return { ok: false as const, items: [] };
  }
}

/** Basit / gelişmiş görünüm seçimi (bir yıl hatırlanır). */
export async function setViewModeAction(advanced: boolean) {
  z.boolean().parse(advanced);
  (await cookies()).set(VIEW_COOKIE, advanced ? "gelismis" : "basit", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}
