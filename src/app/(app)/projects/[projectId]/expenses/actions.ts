"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Currency, PaymentMethod } from "@/generated/prisma/enums";
import type { ActionFailure } from "@/lib/action-result";
import { dateInputToDate } from "@/lib/format";
import { parseExpenseForm } from "@/lib/validation/expense";
import { ActionError } from "@/server/access";
import { toActionResult } from "@/server/action-error";
import {
  createExpense,
  deleteExpense,
  lastUsedFor,
  setApproval,
  setPaymentStatus,
  updateExpense,
  type SaveResult,
} from "@/server/expenses";
import { fetchTcmbRates, suggestedRate } from "@/server/rates";
import { quickCreateSupplier } from "@/server/suppliers";

const id = z.string().min(1).max(100);
const ids = z.array(id).min(1).max(500);

export type ExpenseSaveResult =
  | { ok: true; id: string }
  | { ok: false; duplicate: { id: string; date: string; total: string; project: string }[] }
  | ActionFailure;

function revalidateProject(projectId: string) {
  // Panel, liste ve raporlar aynı proje altında; portföy özetleri de değişir.
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/portfolio");
  revalidatePath("/company", "layout");
}

function toSaveResult(result: SaveResult): ExpenseSaveResult {
  if (result.status === "saved") return { ok: true, id: result.id };
  return {
    ok: false,
    duplicate: result.duplicates.map((d) => ({
      id: d.id,
      date: d.date.toISOString().slice(0, 10),
      total: d.totalAmountTry.toString(),
      project: d.project.name,
    })),
  };
}

function readForm(formData: FormData) {
  const payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  return { payload, files };
}

export async function createExpenseAction(projectId: string, formData: FormData): Promise<ExpenseSaveResult> {
  try {
    const { payload, files } = readForm(formData);
    const parsed = parseExpenseForm(payload);
    if (!parsed.ok) return { ok: false, error: "Formdaki hataları düzeltin.", fieldErrors: parsed.fieldErrors };
    const result = toSaveResult(await createExpense(id.parse(projectId), parsed.data, files));
    if (result.ok) revalidateProject(projectId);
    return result;
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateExpenseAction(
  projectId: string,
  expenseId: string,
  formData: FormData,
): Promise<ExpenseSaveResult> {
  try {
    const { payload, files } = readForm(formData);
    const parsed = parseExpenseForm(payload);
    if (!parsed.ok) return { ok: false, error: "Formdaki hataları düzeltin.", fieldErrors: parsed.fieldErrors };
    const removed = z.array(id).max(50).parse(JSON.parse(String(formData.get("removeDocuments") ?? "[]")));
    const result = toSaveResult(
      await updateExpense(id.parse(projectId), id.parse(expenseId), parsed.data, files, removed),
    );
    if (result.ok) revalidateProject(projectId);
    return result;
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteExpenseAction(projectId: string, expenseId: string) {
  try {
    await deleteExpense(id.parse(projectId), id.parse(expenseId));
  } catch (error) {
    return toActionResult(error);
  }
  revalidateProject(projectId);
  return { ok: true as const };
}

export async function approveExpensesAction(projectId: string, expenseIds: string[]) {
  try {
    const count = await setApproval(id.parse(projectId), ids.parse(expenseIds), "APPROVED", null);
    revalidateProject(projectId);
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function rejectExpensesAction(projectId: string, expenseIds: string[], note: string) {
  try {
    const reason = z.string().trim().max(500).parse(note) || null;
    const count = await setApproval(id.parse(projectId), ids.parse(expenseIds), "REJECTED", reason);
    revalidateProject(projectId);
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setPaidAction(
  expenseIds: string[],
  input: { paid: boolean; paidAt?: string; method?: string | null },
) {
  try {
    const paidAt = dateInputToDate(input.paidAt ?? "") ?? new Date();
    const method = input.method ? z.enum(PaymentMethod).parse(input.method) : null;
    const count = await setPaymentStatus(
      ids.parse(expenseIds),
      input.paid ? { paid: true, paidAt, method } : { paid: false },
    );
    revalidatePath("/", "layout");
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}

/** Kalem seçilince öneriler (son tedarikçi, KDV oranı, birim fiyat). */
export async function lastUsedAction(projectId: string, costItemId: string) {
  try {
    return await lastUsedFor(id.parse(projectId), id.parse(costItemId));
  } catch {
    return null;
  }
}

export async function suggestRateAction(date: string, currency: string) {
  const day = dateInputToDate(date);
  const code = z.enum(Currency).safeParse(currency);
  if (!day || !code.success) return null;
  const rate = await suggestedRate(day, code.data);
  return rate ? { value: rate.value, date: rate.date.toISOString().slice(0, 10), source: rate.source } : null;
}

export async function fetchTcmbAction(date: string) {
  try {
    const result = await fetchTcmbRates(dateInputToDate(date));
    revalidatePath("/settings/rates");
    return { ok: true as const, date: result.date.toISOString().slice(0, 10), count: result.count };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function quickCreateSupplierAction(name: string, taxNumber: string | null) {
  try {
    const cleanName = z.string().trim().min(2, "Tedarikçi adı en az 2 karakter olmalı.").max(200).parse(name);
    const cleanTax = taxNumber?.replace(/\s/g, "") || null;
    if (cleanTax && !/^\d{10,11}$/.test(cleanTax)) {
      throw new ActionError("Vergi no 10, TC kimlik no 11 haneli olmalı.");
    }
    const supplier = await quickCreateSupplier(cleanName, cleanTax);
    return { ok: true as const, supplier };
  } catch (error) {
    return toActionResult(error);
  }
}
