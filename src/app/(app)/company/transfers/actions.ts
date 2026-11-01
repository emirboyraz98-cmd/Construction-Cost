"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transferSchema } from "@/lib/validation/purchasing";
import { toActionResult } from "@/server/action-error";
import { createTransfer, deleteTransfer } from "@/server/transfers";

function refresh() {
  revalidatePath("/company/transfers");
  revalidatePath("/projects", "layout");
  revalidatePath("/portfolio");
}

export async function createTransferAction(input: unknown) {
  try {
    await createTransfer(transferSchema.parse(input));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteTransferAction(transferId: string) {
  try {
    await deleteTransfer(z.string().min(1).max(100).parse(transferId));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}
