"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MachineEntryType, MachineStatus, MachineUsageUnit } from "@/generated/prisma/enums";
import { optionalDate, optionalDecimalValue, optionalInt, optionalText, requiredDate, requiredDecimal, requiredText } from "@/lib/validation/fields";
import { toActionResult } from "@/server/action-error";
import { addMachineEntry, addMachineUsage, deleteMachine, deleteMachineEntry, deleteMachineUsage, saveMachine, setMachineEntryPaid } from "@/server/machines";

const id = z.string().min(1).max(100);

const machineSchema = z.object({
  code: requiredText("Kod", 30),
  name: requiredText("Ad", 120),
  category: optionalText(80),
  brand: optionalText(80),
  model: optionalText(80),
  plateOrSerial: optionalText(80),
  year: optionalInt("Model yılı", 1950, 2100),
  status: z.enum(MachineStatus),
  usageUnit: z.enum(MachineUsageUnit),
  internalRate: optionalDecimalValue("İç kullanım ücreti", 100_000_000),
  notes: optionalText(1000),
});

export async function saveMachineAction(machineId: string | null, input: unknown) {
  try {
    const savedId = await saveMachine(machineId ? id.parse(machineId) : null, machineSchema.parse(input));
    revalidatePath("/company", "layout");
    return { ok: true as const, id: savedId };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteMachineAction(machineId: string) {
  try {
    await deleteMachine(id.parse(machineId));
    revalidatePath("/company", "layout");
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

const entrySchema = z.object({
  date: requiredDate("Tarih"),
  type: z.enum(MachineEntryType),
  amount: requiredDecimal("Tutar", { positive: true }),
  description: optionalText(300),
  quantity: optionalDecimalValue("Miktar", 1_000_000_000),
  unit: optionalText(20),
  paid: z.boolean(),
  dueDate: optionalDate(),
  projectId: z.string().max(100).optional().transform((v) => v || null),
  counterparty: optionalText(160),
});

export async function addMachineEntryAction(machineId: string, input: unknown) {
  try {
    await addMachineEntry(id.parse(machineId), entrySchema.parse(input));
    revalidatePath("/company", "layout");
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setMachineEntryPaidAction(entryId: string, paid: boolean) {
  try {
    await setMachineEntryPaid(id.parse(entryId), z.boolean().parse(paid));
    revalidatePath("/company", "layout");
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteMachineEntryAction(entryId: string) {
  try {
    await deleteMachineEntry(id.parse(entryId));
    revalidatePath("/company", "layout");
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

const usageSchema = z.object({
  date: requiredDate("Tarih"),
  projectId: z.string({ error: "Proje seçin." }).min(1, "Proje seçin.").max(100),
  costItemId: z.string({ error: "Maliyet kalemi seçin." }).min(1, "Maliyet kalemi seçin.").max(100),
  quantity: requiredDecimal("Çalışma", { positive: true, max: 100_000 }),
  rate: requiredDecimal("Birim ücret", { positive: true, max: 100_000_000 }),
  description: optionalText(300),
});

export async function addMachineUsageAction(machineId: string, input: unknown) {
  try {
    const data = usageSchema.parse(input);
    const amount: Decimal = await addMachineUsage(id.parse(machineId), data);
    revalidatePath("/company", "layout");
    revalidatePath(`/projects/${data.projectId}`, "layout");
    return { ok: true as const, amount: amount.toString() };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteMachineUsageAction(usageId: string) {
  try {
    await deleteMachineUsage(id.parse(usageId));
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}
