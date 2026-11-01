"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ContractStatus, PaymentMethod } from "@/generated/prisma/enums";
import { dateInputToDate } from "@/lib/format";
import { billingSchema, contractSchema } from "@/lib/validation/purchasing";
import { toActionResult } from "@/server/action-error";
import {
  approveBilling,
  createContract,
  deleteBilling,
  rejectBilling,
  revertBilling,
  saveBilling,
  setAdvanceContract,
  setBillingsPaid,
  setContractStatus,
  submitBilling,
  updateContract,
} from "@/server/contracts";
import { readFormData } from "@/server/form-data";

const id = z.string().min(1).max(100);

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/portfolio");
  revalidatePath("/company", "layout");
}

export async function saveContractAction(projectId: string, contractId: string | null, formData: FormData) {
  try {
    const { payload, files, removeDocuments } = readFormData(formData);
    const data = contractSchema.parse(payload);
    const savedId = contractId
      ? (await updateContract(id.parse(projectId), id.parse(contractId), data, files, removeDocuments), contractId)
      : await createContract(id.parse(projectId), data, files);
    refresh(projectId);
    return { ok: true as const, id: savedId };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setContractStatusAction(projectId: string, contractId: string, status: string) {
  try {
    await setContractStatus(id.parse(projectId), id.parse(contractId), z.enum(ContractStatus).parse(status));
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function linkContractAdvanceAction(projectId: string, expenseId: string, contractId: string | null) {
  try {
    await setAdvanceContract(id.parse(projectId), id.parse(expenseId), contractId ? id.parse(contractId) : null);
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveBillingAction(projectId: string, contractId: string, billingId: string | null, formData: FormData) {
  try {
    const { payload, files } = readFormData(formData);
    const result = await saveBilling(id.parse(projectId), id.parse(contractId), billingId ? id.parse(billingId) : null, billingSchema.parse(payload), files);
    refresh(projectId);
    return { ok: true as const, ...result };
  } catch (error) {
    return toActionResult(error);
  }
}

const BILLING_ACTIONS = {
  submit: submitBilling,
  approve: approveBilling,
  revert: revertBilling,
  delete: deleteBilling,
} as const;

export async function billingAction(projectId: string, billingId: string, action: keyof typeof BILLING_ACTIONS) {
  try {
    const run = BILLING_ACTIONS[z.enum(["submit", "approve", "revert", "delete"]).parse(action)];
    await run(id.parse(projectId), id.parse(billingId));
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function rejectBillingAction(projectId: string, billingId: string, note: string) {
  try {
    await rejectBilling(id.parse(projectId), id.parse(billingId), z.string().trim().max(500).parse(note));
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setBillingPaidAction(projectId: string, billingId: string, input: { paid: boolean; paidAt?: string; method?: string | null }) {
  try {
    const paidAt = dateInputToDate(input.paidAt ?? "") ?? new Date();
    const method = input.method ? z.enum(PaymentMethod).parse(input.method) : null;
    await setBillingsPaid([id.parse(billingId)], input.paid ? { paid: true, paidAt, method } : { paid: false });
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}
