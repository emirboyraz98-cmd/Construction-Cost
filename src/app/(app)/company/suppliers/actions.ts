"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { fieldErrors } from "@/lib/validation/fields";
import { supplierSchema, type SupplierInput } from "@/lib/validation/supplier";
import { toActionResult } from "@/server/action-error";
import { createSupplier, updateSupplier } from "@/server/suppliers";

export async function saveSupplierAction(supplierId: string | null, input: SupplierInput): Promise<ActionResult> {
  let id: string;
  try {
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Formdaki hataları düzeltin.", fieldErrors: fieldErrors(parsed.error) };
    }
    if (supplierId) {
      await updateSupplier(supplierId, parsed.data);
      id = supplierId;
    } else {
      id = (await createSupplier(parsed.data)).id;
    }
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/company/suppliers", "layout");
  redirect(`/company/suppliers/${id}`);
}
