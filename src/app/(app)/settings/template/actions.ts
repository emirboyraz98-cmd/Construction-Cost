"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { optionalText, requiredText } from "@/lib/validation/fields";
import { toActionResult } from "@/server/action-error";
import { addTemplateItem, setTemplateItemActive } from "@/server/templates";

const schema = z.object({
  parentId: z.string().max(100).nullable(),
  code: z.string().trim().regex(/^\d{2}(\.\d{2})*$/, "Kod ör. 17 veya 05.12 biçiminde olmalı."),
  name: requiredText("Kalem adı", 200),
  unit: optionalText(20),
  description: optionalText(500),
});

/** Maliyet ağacı ekranıyla aynı imza (ilk parametre şablonda kullanılmaz). */
export async function addTemplateItemAction(_scope: string, input: z.input<typeof schema>): Promise<ActionResult> {
  try {
    await addTemplateItem(schema.parse(input));
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/settings/template");
  return { ok: true };
}

export async function setTemplateItemActiveAction(_scope: string, itemId: string, active: boolean): Promise<ActionResult> {
  try {
    await setTemplateItemActive(z.string().min(1).max(100).parse(itemId), z.boolean().parse(active));
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/settings/template");
  return { ok: true };
}
