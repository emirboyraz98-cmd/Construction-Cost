"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ConnectionStatus } from "@/generated/prisma/enums";
import {
  allocationSchema,
  connectionInvoiceSchema,
  connectionPaymentSchema,
  connectionSchema,
  drawSchema,
  paymentPaidSchema,
} from "@/lib/validation/purchasing";
import { toActionResult } from "@/server/action-error";
import {
  addConnectionPayment,
  createConnection,
  createConnectionInvoice,
  createDraw,
  deleteConnection,
  deleteConnectionInvoice,
  deleteConnectionPayment,
  saveAllocations,
  setAdvanceConnection,
  setConnectionPaymentsPaid,
  setConnectionStatus,
  updateConnection,
  updateConnectionPayment,
} from "@/server/connections";
import { readFormData } from "@/server/form-data";

const id = z.string().min(1).max(100);

function refresh() {
  revalidatePath("/company", "layout");
  revalidatePath("/portfolio");
  revalidatePath("/projects", "layout");
}

export async function createConnectionAction(formData: FormData) {
  try {
    const { payload, files } = readFormData(formData);
    const connectionId = await createConnection(connectionSchema.parse(payload), files);
    refresh();
    return { ok: true as const, id: connectionId };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateConnectionAction(connectionId: string, formData: FormData) {
  try {
    const { payload, files, removeDocuments } = readFormData(formData);
    await updateConnection(id.parse(connectionId), connectionSchema.parse(payload), files, removeDocuments);
    refresh();
    return { ok: true as const, id: connectionId };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setConnectionStatusAction(connectionId: string, status: string) {
  try {
    await setConnectionStatus(id.parse(connectionId), z.enum(ConnectionStatus).parse(status));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteConnectionAction(connectionId: string) {
  try {
    await deleteConnection(id.parse(connectionId));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveAllocationsAction(input: unknown) {
  try {
    const data = allocationSchema.parse(input);
    await saveAllocations(data.itemId, data.allocations);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function savePaymentAction(connectionId: string, paymentId: string | null, input: unknown) {
  try {
    const data = connectionPaymentSchema.parse(input);
    if (paymentId) await updateConnectionPayment(id.parse(paymentId), data);
    else await addConnectionPayment(id.parse(connectionId), data);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deletePaymentAction(paymentId: string) {
  try {
    await deleteConnectionPayment(id.parse(paymentId));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setPaymentPaidAction(paymentIds: string[], input: unknown) {
  try {
    const ids = z.array(id).min(1).max(200).parse(paymentIds);
    if (input === null) await setConnectionPaymentsPaid(ids, { paid: false });
    else {
      const data = paymentPaidSchema.parse(input);
      await setConnectionPaymentsPaid(ids, { paid: true, paidAt: data.paidAt, method: data.paymentMethod, exchangeRate: data.exchangeRate });
    }
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createInvoiceAction(connectionId: string, formData: FormData) {
  try {
    const { payload, files } = readFormData(formData);
    const warnings = await createConnectionInvoice(id.parse(connectionId), connectionInvoiceSchema.parse(payload), files);
    refresh();
    return { ok: true as const, warnings };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteInvoiceAction(invoiceId: string) {
  try {
    await deleteConnectionInvoice(id.parse(invoiceId));
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function linkAdvanceAction(expenseId: string, connectionId: string | null) {
  try {
    await setAdvanceConnection(id.parse(expenseId), connectionId ? id.parse(connectionId) : null);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

/** "Malzeme geldi" (proje içinden, şantiye şefi de kullanır). */
export async function createDrawAction(projectId: string, formData: FormData) {
  try {
    const { payload, files } = readFormData(formData);
    const expenseId = await createDraw(id.parse(projectId), drawSchema.parse(payload), files);
    refresh();
    return { ok: true as const, id: expenseId };
  } catch (error) {
    return toActionResult(error);
  }
}
