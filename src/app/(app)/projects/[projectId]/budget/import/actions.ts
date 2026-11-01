"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BUDGET_FIELDS, resolveBudgetRow } from "@/lib/budget/import";
import { toActionResult } from "@/server/action-error";
import { budgetImportLookups, importBudgetLines } from "@/server/budget";

const rows = z.partialRecord(z.enum(BUDGET_FIELDS), z.string().max(500)).array().max(3000);

export type BudgetRowCheck = { ok: boolean; errors: string[]; warnings: string[]; label: string | null };

export async function checkBudgetImportAction(projectId: string, input: unknown) {
  try {
    const lookups = await budgetImportLookups(z.string().parse(projectId));
    const label = new Map(lookups.costItems.map((c) => [c.id, `${c.code} ${c.name}`]));
    const checks: BudgetRowCheck[] = rows.parse(input).map((row) => {
      const r = resolveBudgetRow(row, lookups);
      return r.ok ? { ok: true, errors: [], warnings: r.warnings, label: label.get(r.value.costItemId) ?? null } : { ok: false, errors: r.errors, warnings: [], label: null };
    });
    return { ok: true as const, checks };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function importBudgetAction(projectId: string, input: unknown) {
  try {
    const pid = z.string().parse(projectId);
    const lookups = await budgetImportLookups(pid);
    const valid = rows
      .parse(input)
      .map((row) => resolveBudgetRow(row, lookups))
      .flatMap((r) => (r.ok ? [r.value] : []));
    const count = await importBudgetLines(pid, valid);
    revalidatePath(`/projects/${pid}`, "layout");
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}
