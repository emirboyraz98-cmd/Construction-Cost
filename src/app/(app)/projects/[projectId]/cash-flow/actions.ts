"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optionalDecimalValue, optionalInt, optionalText, requiredDecimal, requiredText } from "@/lib/validation/fields";
import { toActionResult } from "@/server/action-error";
import { applyDefaultSchedule, deleteScenario, duplicateScenario, saveCashSettings, saveScenario, saveScheduleEntry } from "@/server/cashflow";

const id = z.string().min(1).max(100);
const refresh = (projectId: string) => {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/company/cash-flow");
};

export async function saveCashSettingsAction(projectId: string, input: unknown) {
  try {
    const data = z
      .object({
        openingCash: requiredDecimal("Başlangıç nakdi", { min: -1e12, max: 1e12 }),
        costVatPercent: optionalDecimalValue("KDV oranı", 100),
        monthlyInflationPercent: requiredDecimal("Aylık enflasyon", { min: -10, max: 50 }),
        fxChangePercent: requiredDecimal("Kur değişimi", { min: -90, max: 500 }),
        monthlyInterestPercent: requiredDecimal("Aylık finansman maliyeti", { min: 0, max: 50 }),
        salesPerMonth: requiredDecimal("Aylık satış", { min: 0, max: 1000 }),
        salesStartMonth: optionalInt("Satış başlangıç ayı", 1, 240),
        downPaymentPercent: requiredDecimal("Peşinat", { min: 0, max: 100 }),
        installmentMonths: optionalInt("Taksit sayısı", 0, 240).transform((v) => v ?? 0),
      })
      .parse(input);
    await saveCashSettings(id.parse(projectId), data);
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveScheduleAction(projectId: string, costItemId: string, input: { startMonth: string; endMonth: string } | null) {
  try {
    const range = input
      ? z.object({ startMonth: z.coerce.number({ error: "Başlangıç ayı girin." }).int().min(1, "En az 1.").max(240), endMonth: z.coerce.number({ error: "Bitiş ayı girin." }).int().min(1, "En az 1.").max(240) }).parse(input)
      : null;
    await saveScheduleEntry(id.parse(projectId), id.parse(costItemId), range);
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function applyDefaultScheduleAction(projectId: string) {
  try {
    const count = await applyDefaultSchedule(id.parse(projectId));
    refresh(projectId);
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}

const scenarioSchema = z.object({
  name: requiredText("Ad", 100),
  note: optionalText(500),
  monthlyInflationPercent: optionalDecimalValue("Aylık enflasyon", 50),
  fxChangePercent: optionalDecimalValue("Kur değişimi", 500),
  monthlyInterestPercent: optionalDecimalValue("Finansman maliyeti", 50),
  delayMonths: optionalInt("Gecikme", 0, 60).transform((v) => v ?? 0),
  salesPriceChangePercent: requiredDecimal("Satış fiyatı değişimi", { min: -90, max: 300 }),
  salesSpeedPercent: requiredDecimal("Satış hızı", { min: 0, max: 1000 }),
  landownerSharePercent: optionalDecimalValue("Arsa payı", 100),
  adjustments: z
    .array(z.object({ costItemCode: z.string().trim().regex(/^\d{2}(\.\d{2})*$/, "Kod ör. 05 veya 05.05 olmalı."), changePercent: requiredDecimal("Değişim", { min: -90, max: 500 }) }))
    .max(50),
});

export async function saveScenarioAction(projectId: string, scenarioId: string | null, input: unknown) {
  try {
    const data = scenarioSchema.parse(input);
    const savedId = await saveScenario(id.parse(projectId), scenarioId ? id.parse(scenarioId) : null, data);
    refresh(projectId);
    return { ok: true as const, id: savedId };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteScenarioAction(projectId: string, scenarioId: string) {
  try {
    await deleteScenario(id.parse(projectId), id.parse(scenarioId));
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function duplicateScenarioAction(projectId: string, scenarioId: string) {
  try {
    await duplicateScenario(id.parse(projectId), id.parse(scenarioId));
    refresh(projectId);
    return { ok: true as const };
  } catch (error) {
    return toActionResult(error);
  }
}
