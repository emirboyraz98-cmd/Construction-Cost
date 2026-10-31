// Metraj / bütçe Excel içe aktarma (PLAN.md 6: manuel / Excel metraj; saf modül).
import Decimal from "decimal.js";
import type { Currency } from "@/generated/prisma/enums";
import { normalizeKey, parseNumberValue } from "../expenses/tabular";

export const BUDGET_FIELDS = ["costItem", "description", "quantity", "unit", "unitPrice", "currency", "wastePercent", "block"] as const;
export type BudgetField = (typeof BUDGET_FIELDS)[number];
export type BudgetImportRow = Partial<Record<BudgetField, string>>;

export const BUDGET_FIELD_LABELS: Record<BudgetField, string> = {
  costItem: "Maliyet kalemi (kod)",
  description: "Açıklama / poz",
  quantity: "Miktar",
  unit: "Birim",
  unitPrice: "Birim fiyat (KDV hariç)",
  currency: "Para birimi",
  wastePercent: "Fire %",
  block: "Blok",
};

const SYNONYMS: Record<BudgetField, string[]> = {
  costItem: ["maliyet kalemi", "kalem", "kalem kodu", "iky", "iky kodu", "kod", "is kalemi kodu"],
  description: ["aciklama", "poz", "poz adi", "is kalemi", "imalat", "tanim", "is tanimi"],
  quantity: ["miktar", "metraj", "adet", "toplam miktar"],
  unit: ["birim", "olcu birimi"],
  unitPrice: ["birim fiyat", "birim fiyati", "fiyat"],
  currency: ["para birimi", "doviz"],
  wastePercent: ["fire", "fire %", "fire orani"],
  block: ["blok"],
};

/** Başlık satırından sütun eşleştirme tahmini. */
export function guessBudgetMapping(header: readonly string[]): (BudgetField | null)[] {
  const used = new Set<BudgetField>();
  return header.map((cell) => {
    const key = normalizeKey(cell);
    const field = BUDGET_FIELDS.find((f) => !used.has(f) && SYNONYMS[f].includes(key)) ?? BUDGET_FIELDS.find((f) => !used.has(f) && SYNONYMS[f].some((s) => key.startsWith(s)));
    if (field) used.add(field);
    return field ?? null;
  });
}

export type BudgetLookups = {
  costItems: readonly { id: string; code: string; name: string }[];
  blocks: readonly { id: string; name: string }[];
};

export type ResolvedBudgetRow = {
  costItemId: string;
  blockId: string | null;
  description: string | null;
  quantity: Decimal;
  unit: string | null;
  unitPrice: Decimal | null;
  currency: Currency;
  wastePercent: Decimal;
};

const CURRENCIES: Record<string, Currency> = { "": "TRY", tl: "TRY", try: "TRY", usd: "USD", dolar: "USD", eur: "EUR", euro: "EUR", avro: "EUR", gbp: "GBP", sterlin: "GBP" };

/** Bir satırı bütçe satırına çevirir; kod "05.05" veya "05.05 İnşaat demiri" olabilir. */
export function resolveBudgetRow(row: BudgetImportRow, lookups: BudgetLookups): { ok: true; value: ResolvedBudgetRow; warnings: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const codeText = (row.costItem ?? "").trim();
  const code = codeText.match(/^\d{2}(\.\d{2})*/)?.[0] ?? "";
  const item = code ? lookups.costItems.find((c) => c.code === code) : lookups.costItems.find((c) => normalizeKey(c.name) === normalizeKey(codeText));
  if (!codeText) errors.push("Maliyet kalemi boş");
  else if (!item) errors.push(`Maliyet kalemi bulunamadı: "${codeText}"`);
  const qty = parseNumberValue(row.quantity);
  if (!qty.ok || qty.value == null) errors.push("Miktar geçersiz veya boş");
  else if (qty.value.isNegative()) errors.push("Miktar negatif olamaz");
  const price = parseNumberValue(row.unitPrice);
  if (!price.ok) errors.push("Birim fiyat geçersiz");
  else if (price.value == null) warnings.push("Birim fiyat yok (bütçe ekranında girilebilir)");
  const waste = parseNumberValue(row.wastePercent);
  if (!waste.ok || (waste.value && (waste.value.isNegative() || waste.value.gt(100)))) errors.push("Fire % 0–100 arasında olmalı");
  const currency = CURRENCIES[normalizeKey(row.currency ?? "")];
  if (!currency) errors.push(`Para birimi anlaşılamadı: "${row.currency}"`);
  let blockId: string | null = null;
  if (row.block?.trim()) {
    const block = lookups.blocks.find((b) => normalizeKey(b.name) === normalizeKey(row.block!) || normalizeKey(b.name) === normalizeKey(`${row.block} blok`));
    if (!block) errors.push(`Blok bulunamadı: "${row.block}"`);
    else blockId = block.id;
  }
  if (errors.length || !item || !qty.ok || qty.value == null || !price.ok || !waste.ok || !currency) return { ok: false, errors };
  return {
    ok: true,
    warnings,
    value: {
      costItemId: item.id,
      blockId,
      description: row.description?.trim() || null,
      quantity: qty.value,
      unit: row.unit?.trim() || null,
      unitPrice: price.value,
      currency,
      wastePercent: waste.value ?? new Decimal(0),
    },
  };
}
