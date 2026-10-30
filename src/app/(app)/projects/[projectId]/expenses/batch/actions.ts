"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import ExcelJS from "exceljs";
import { z } from "zod";
import type { Currency } from "@/generated/prisma/enums";
import { resolveImportRow, type ImportRow, type RowResult } from "@/lib/expenses/import-rows";
import { IMPORT_FIELDS, parseDateValue } from "@/lib/expenses/tabular";
import { parseDecimalInput } from "@/lib/format";
import { ActionError } from "@/server/access";
import { toActionResult } from "@/server/action-error";
import { findImportDuplicates, importExpenses, importLookups } from "@/server/expenses";
import { ratesBetween } from "@/server/rates";

const MAX_ROWS = 2000;
const rowSchema = z.record(z.enum(IMPORT_FIELDS), z.string().max(500)).array().max(MAX_ROWS);

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const d = String(value.getUTCDate()).padStart(2, "0");
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${d}.${m}.${value.getUTCFullYear()}`;
  }
  // Excel sayısı Türkçe ondalık virgülle yazılır ("12.345" binlik sanılmasın).
  if (typeof value === "number") return String(value).replace(".", ",");
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "string") return value.trim();
  if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  if ("result" in value) return cellText((value.result ?? null) as ExcelJS.CellValue);
  if ("text" in value) return String(value.text).trim();
  return "";
}

/** .xlsx dosyasının sayfalarını metin tablosuna çevirir. */
export async function readSpreadsheetAction(formData: FormData) {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ActionError("Dosya seçin.");
    if (file.size > 20 * 1024 * 1024) throw new ActionError("Dosya çok büyük (en fazla 20 MB).");
    if (/\.xls$/i.test(file.name)) {
      throw new ActionError("Eski .xls biçimi okunamıyor; dosyayı Excel'de “Farklı kaydet → .xlsx” ile kaydedin.");
    }
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      throw new ActionError("Dosya okunamadı; geçerli bir Excel (.xlsx) dosyası olduğundan emin olun.");
    }
    const sheets = workbook.worksheets.map((sheet) => {
      const rows: string[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        if (rows.length >= MAX_ROWS + 1) return;
        const cells: string[] = [];
        for (let col = 1; col <= Math.min(row.cellCount, 40); col++) cells.push(cellText(row.getCell(col).value));
        if (cells.some((c) => c !== "")) rows.push(cells);
      });
      return { name: sheet.name, rows };
    });
    return { ok: true as const, sheets: sheets.filter((s) => s.rows.length > 0) };
  } catch (error) {
    return toActionResult(error);
  }
}

export type RowCheck = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: string | null;
  totalTry: string | null;
};

async function resolveAll(projectId: string, rows: ImportRow[], defaultVatRate: string) {
  const lookups = await importLookups(projectId);
  const vat = parseDecimalInput(defaultVatRate);
  const dates = rows.map((row) => parseDateValue(row.date)).filter((d): d is Date => d !== null);
  const rates = dates.length
    ? await ratesBetween(new Date(Math.min(...dates.map(Number))), new Date(Math.max(...dates.map(Number))))
    : [];
  const findRate = (date: Date, currency: Currency) => {
    const candidates = rates.filter((r) => r.currency === currency && r.date <= date && date.getTime() - r.date.getTime() <= 10 * 86_400_000);
    const best = candidates.at(-1);
    return best ? new Decimal(best.buying.toString()) : null;
  };
  const results: RowResult[] = rows.map((row) =>
    resolveImportRow(row, { ...lookups, findRate }, { vatRate: vat.ok ? vat.value : null }),
  );

  // Kayıtlı veya aynı tablo içinde tekrar eden tedarikçi + belge no
  const existing = await findImportDuplicates(
    results.map((r) => (r.ok ? { supplierId: r.value.supplierId, documentNo: r.value.documentNo } : { supplierId: null, documentNo: null })),
  );
  const seen = new Map<string, number>();
  results.forEach((result, index) => {
    if (!result.ok) return;
    if (existing.has(index)) {
      results[index] = { ok: false, errors: ["Bu tedarikçide aynı belge no zaten kayıtlı (mükerrer)"], warnings: result.warnings };
      return;
    }
    const supplierKey = result.value.supplierId ?? result.value.newSupplier?.name.toLocaleLowerCase("tr-TR");
    if (supplierKey && result.value.documentNo) {
      const key = `${supplierKey}|${result.value.documentNo}`;
      if (seen.has(key)) result.warnings.push(`${seen.get(key)! + 1}. satırla aynı belge no (aynı faturanın kalemleri olabilir)`);
      else seen.set(key, index);
    }
  });
  return { results, lookups };
}

export async function checkImportAction(projectId: string, rows: ImportRow[], defaultVatRate: string) {
  try {
    const parsed = rowSchema.parse(rows);
    const { results, lookups } = await resolveAll(z.string().parse(projectId), parsed, defaultVatRate);
    const itemLabel = new Map(lookups.costItems.map((c) => [c.id, `${c.code} ${c.name}`]));
    const supplierLabel = new Map(lookups.suppliers.map((s) => [s.id, s.name]));
    const checks: RowCheck[] = results.map((result) =>
      result.ok
        ? {
            ok: true,
            errors: [],
            warnings: result.warnings,
            summary: [
              itemLabel.get(result.value.costItemId),
              result.value.supplierId ? supplierLabel.get(result.value.supplierId) : result.value.newSupplier?.name,
            ]
              .filter(Boolean)
              .join(" · "),
            totalTry: result.value.amounts.totalAmountTry.toString(),
          }
        : { ok: false, errors: result.errors, warnings: result.warnings, summary: null, totalTry: null },
    );
    return { ok: true as const, checks };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function commitImportAction(
  projectId: string,
  rows: ImportRow[],
  defaultVatRate: string,
  fileName: string | null,
  skipInvalid: boolean,
) {
  try {
    const parsed = rowSchema.parse(rows);
    const { results } = await resolveAll(z.string().parse(projectId), parsed, defaultVatRate);
    const invalid = results.filter((r) => !r.ok).length;
    if (invalid > 0 && !skipInvalid) throw new ActionError(`${invalid} satır hatalı; düzeltin veya hatalıları atlamayı seçin.`);
    const valid = results.flatMap((r) => (r.ok ? [r.value] : []));
    const result = await importExpenses(projectId, valid, fileName?.slice(0, 200) ?? null);
    revalidatePath(`/projects/${projectId}`, "layout");
    revalidatePath("/portfolio");
    return { ok: true as const, ...result, skipped: invalid };
  } catch (error) {
    return toActionResult(error);
  }
}
