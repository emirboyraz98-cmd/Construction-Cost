"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { destroySession } from "@/server/session";
import { closeProjectTab, moveProjectTab, openProjectTab } from "@/server/tabs";

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
