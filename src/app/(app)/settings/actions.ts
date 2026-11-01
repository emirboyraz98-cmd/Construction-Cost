"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { fieldErrors } from "@/lib/validation/fields";
import {
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validation/user";
import { toActionResult } from "@/server/action-error";
import { changeOwnPassword, createUser, updateUser } from "@/server/users";

export async function createUserAction(input: CreateUserInput): Promise<ActionResult> {
  try {
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Formdaki hataları düzeltin.", fieldErrors: fieldErrors(parsed.error) };
    }
    await createUser(parsed.data);
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function updateUserAction(userId: string, input: UpdateUserInput): Promise<ActionResult> {
  try {
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Formdaki hataları düzeltin.", fieldErrors: fieldErrors(parsed.error) };
    }
    await updateUser(z.string().min(1).parse(userId), parsed.data);
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/", "layout");
  redirect("/settings/users");
}

export type PasswordState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export async function changePasswordAction(_previous: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Formdaki hataları düzeltin.", fieldErrors: fieldErrors(parsed.error) };
  try {
    await changeOwnPassword(parsed.data.currentPassword, parsed.data.newPassword);
  } catch (error) {
    return toActionResult(error);
  }
  return { ok: true };
}
