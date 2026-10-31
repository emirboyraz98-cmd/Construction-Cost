"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optionalDate, optionalDecimalValue, optionalText, requiredDate, requiredDecimal, requiredText } from "@/lib/validation/fields";
import { toActionResult } from "@/server/action-error";
import {
  addCollection,
  cancelContract,
  cancelReservation,
  createReservation,
  createSale,
  deleteCollection,
  deleteCustomer,
  saveCustomer,
  setChequeStatus,
  setHandover,
  updateContractInfo,
  updatePlan,
} from "@/server/sales";

const id = z.string().min(1).max(100);
const refresh = (projectId: string) => {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/portfolio");
};
const ok = <T extends object>(extra?: T) => ({ ok: true as const, ...(extra ?? ({} as T)) });

const customerSchema = z.object({
  name: requiredText("Ad soyad / unvan", 200),
  identityNo: optionalText(20),
  taxOffice: optionalText(100),
  phone: optionalText(40),
  email: optionalText(200),
  address: optionalText(500),
  notes: optionalText(1000),
});

export async function saveCustomerAction(projectId: string, customerId: string | null, input: unknown) {
  try {
    const data = customerSchema.parse(input);
    if (data.identityNo && !/^\d{10,11}$/.test(data.identityNo)) {
      return { ok: false as const, error: "Formdaki hataları düzeltin.", fieldErrors: { identityNo: "T.C. kimlik no 11, vergi no 10 haneli olmalı." } };
    }
    const savedId = await saveCustomer(id.parse(projectId), customerId ? id.parse(customerId) : null, data);
    refresh(projectId);
    return ok({ id: savedId });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteCustomerAction(projectId: string, customerId: string) {
  try {
    await deleteCustomer(id.parse(projectId), id.parse(customerId));
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createReservationAction(projectId: string, input: unknown) {
  try {
    const data = z
      .object({
        unitId: id,
        customerId: z.string({ error: "Müşteri seçin." }).min(1, "Müşteri seçin."),
        startDate: requiredDate("Başlangıç"),
        expiresAt: requiredDate("Bitiş"),
        deposit: optionalDecimalValue("Kapora"),
        quotedPrice: optionalDecimalValue("Teklif fiyatı"),
        note: optionalText(500),
      })
      .parse(input);
    await createReservation(id.parse(projectId), data);
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function cancelReservationAction(projectId: string, reservationId: string) {
  try {
    await cancelReservation(id.parse(projectId), id.parse(reservationId));
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

const installmentSchema = z.object({
  dueDate: requiredDate("Vade"),
  amount: requiredDecimal("Tutar", { positive: true }),
  kind: z.enum(["DOWN_PAYMENT", "INSTALLMENT", "INTERIM", "KEY_DELIVERY", "BANK_LOAN"]),
  note: optionalText(200),
});

export async function createSaleAction(projectId: string, input: unknown) {
  try {
    const data = z
      .object({
        unitId: z.string({ error: "Bölüm seçin." }).min(1, "Bölüm seçin."),
        customerId: z.string({ error: "Müşteri seçin." }).min(1, "Müşteri seçin."),
        contractNo: optionalText(50),
        date: requiredDate("Sözleşme tarihi"),
        currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
        exchangeRate: requiredDecimal("Kur", { positive: true }),
        listPrice: requiredDecimal("Liste fiyatı", { positive: true }),
        discount: requiredDecimal("İndirim", { min: 0 }),
        vatRate: requiredDecimal("KDV oranı", { min: 0, max: 100 }),
        agent: optionalText(200),
        commissionAmount: optionalDecimalValue("Komisyon"),
        notes: optionalText(1000),
        installments: z.array(installmentSchema).min(1, "Ödeme planı boş.").max(240),
      })
      .parse(input);
    const contractId = await createSale(id.parse(projectId), data);
    refresh(projectId);
    return ok({ id: contractId });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updatePlanAction(projectId: string, contractId: string, input: unknown) {
  try {
    await updatePlan(id.parse(projectId), id.parse(contractId), z.array(installmentSchema).min(1).max(240).parse(input));
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateContractInfoAction(projectId: string, contractId: string, input: unknown) {
  try {
    const data = z.object({ contractNo: optionalText(50), agent: optionalText(200), commissionAmount: optionalDecimalValue("Komisyon"), notes: optionalText(1000) }).parse(input);
    await updateContractInfo(id.parse(projectId), id.parse(contractId), data);
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function cancelContractAction(projectId: string, contractId: string, reason: string) {
  try {
    await cancelContract(id.parse(projectId), id.parse(contractId), requiredText("İptal nedeni", 500).parse(reason));
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setHandoverAction(projectId: string, unitId: string, date: string) {
  try {
    await setHandover(id.parse(projectId), id.parse(unitId), optionalDate().parse(date));
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function addCollectionAction(projectId: string, contractId: string, input: unknown) {
  try {
    const data = z
      .object({
        date: requiredDate("Tarih"),
        amount: requiredDecimal("Tutar", { positive: true }),
        exchangeRate: requiredDecimal("Kur", { positive: true }),
        method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "PROMISSORY_NOTE", "CREDIT_CARD"]),
        documentNo: optionalText(50),
        chequeDueDate: optionalDate(),
        bank: optionalText(100),
        note: optionalText(500),
      })
      .parse(input);
    await addCollection(id.parse(projectId), id.parse(contractId), data);
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setChequeStatusAction(projectId: string, collectionId: string, status: string) {
  try {
    await setChequeStatus(id.parse(projectId), id.parse(collectionId), z.enum(["PENDING", "CLEARED", "BOUNCED"]).parse(status));
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteCollectionAction(projectId: string, collectionId: string) {
  try {
    await deleteCollection(id.parse(projectId), id.parse(collectionId));
    refresh(projectId);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
