"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optionalDecimalValue, optionalText, requiredDecimal, requiredText } from "@/lib/validation/fields";
import { ActionError } from "@/server/access";
import { toActionResult } from "@/server/action-error";
import { approvePriceList, copyFactors, saveFactors, savePricingSettings, setUnitsLocked, setUnitVatOverride } from "@/server/pricing";

const id = z.string().min(1).max(100);
const refresh = (projectId: string) => {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/portfolio");
};

const settingsSchema = z
  .object({
    profitMethod: z.enum(["MARGIN", "MARKUP"]),
    profitPercent: requiredDecimal("Kâr oranı", { min: 0, max: 500 }),
    commissionPercent: requiredDecimal("Komisyon", { min: 0, max: 50 }),
    advertisingBudget: optionalDecimalValue("Reklam bütçesi"),
    costBasis: z.enum(["BUDGET", "EAC", "MANUAL"]),
    manualCost: optionalDecimalValue("Toplam maliyet"),
    roundingStep: requiredDecimal("Yuvarlama", { min: 0, max: 10_000_000 }),
    extraAreaFactor: requiredDecimal("Ek alan oranı", { min: 0, max: 1 }),
    reducedVatEligible: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.costBasis === "MANUAL" && !v.manualCost) ctx.addIssue({ code: "custom", path: ["manualCost"], message: "Elle maliyet için tutar girin." });
  });

export async function savePricingSettingsAction(projectId: string, input: unknown) {
  try {
    const data = settingsSchema.parse(input);
    await savePricingSettings(id.parse(projectId), data);
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveFactorsAction(projectId: string, kind: string, input: { key: string; value: string }[]) {
  try {
    const k = z.enum(["USAGE", "FLOOR", "FACADE", "VIEW", "LAYOUT"]).parse(kind);
    const entries = z
      .array(z.object({ key: z.string().max(100), value: optionalDecimalValue("Katsayı", 10) }))
      .max(500)
      .parse(input);
    if (entries.some((e) => e.value?.isZero())) throw new ActionError("Katsayı sıfır olamaz; varsayılan (1,00) için boş bırakın.");
    await saveFactors(id.parse(projectId), k, entries);
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function copyFactorsAction(projectId: string, sourceProjectId: string) {
  try {
    const count = await copyFactors(id.parse(projectId), id.parse(sourceProjectId));
    refresh(projectId);
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setVatOverrideAction(projectId: string, unitId: string, rate: string) {
  try {
    const value = optionalDecimalValue("KDV oranı", 100).parse(rate);
    await setUnitVatOverride(id.parse(projectId), id.parse(unitId), value);
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function setLockedAction(projectId: string, unitIds: string[], locked: boolean) {
  try {
    await setUnitsLocked(id.parse(projectId), z.array(id).min(1).max(1000).parse(unitIds), locked);
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function approvePriceListAction(projectId: string, input: unknown) {
  try {
    const data = z.object({ name: requiredText("Ad", 100), note: optionalText(500) }).parse(input);
    const listId = await approvePriceList(id.parse(projectId), data.name, data.note);
    refresh(projectId);
    return { ok: true as const, id: listId };
  } catch (error) {
    return toActionResult(error);
  }
}
