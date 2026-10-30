"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseDecimalInput } from "@/lib/format";
import { parseExpenseForm } from "@/lib/validation/expense";
import { ActionError } from "@/server/access";
import { toActionResult } from "@/server/action-error";
import { createSplitExpense } from "@/server/expenses";

const payloadSchema = z.object({
  form: z.unknown(),
  costItemCode: z.string().trim().regex(/^\d{2}(\.\d{2,3})*$/, "Maliyet kalemini seçin."),
  allocations: z
    .array(z.object({ projectId: z.string().min(1), weight: z.string() }))
    .min(2, "En az iki proje seçin.")
    .max(50),
});

export async function createSharedInvoiceAction(formData: FormData) {
  try {
    const payload = payloadSchema.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    const parsed = parseExpenseForm(payload.form, { requireCostItem: false });
    if (!parsed.ok) return { ok: false as const, error: "Formdaki hataları düzeltin.", fieldErrors: parsed.fieldErrors };
    if (parsed.data.kind !== "EXPENSE") throw new ActionError("Ortak fatura yalnızca harcama olarak girilebilir.");
    const allocations = payload.allocations.map((a) => {
      const weight = parseDecimalInput(a.weight);
      if (!weight.ok || weight.value == null || weight.value.isNegative()) throw new ActionError("Dağıtım oranları geçerli sayı olmalı.");
      return { projectId: a.projectId, costItemCode: payload.costItemCode, weight: weight.value };
    });
    const result = await createSplitExpense(parsed.data, allocations, files);
    if (result.status === "duplicate") {
      return {
        ok: false as const,
        duplicate: result.duplicates.map((d) => ({
          id: d.id,
          date: d.date.toISOString().slice(0, 10),
          total: d.totalAmountTry.toString(),
          project: d.project.name,
        })),
      };
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}
