"use server";

import { revalidatePath } from "next/cache";
import { toActionResult } from "@/server/action-error";
import { runBackupNow } from "@/server/admin";

export async function backupNowAction() {
  try {
    const message = await runBackupNow();
    revalidatePath("/settings/backups");
    return { ok: true as const, message };
  } catch (error) {
    return toActionResult(error);
  }
}
