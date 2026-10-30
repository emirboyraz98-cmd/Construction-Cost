import "server-only";
import Decimal from "decimal.js";
import type { Currency, PriceSource, ResourceType } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { effectivePrice, recipeUnitPrice, toTry, type PriceCandidate } from "@/lib/budget/pricing";
import { projectIdsWithCapability } from "@/lib/auth/access";
import { normalizeForSearch } from "@/lib/utils";
import { ActionError, getAccess, requireGlobalCapability } from "./access";
import { writeAudit } from "./audit";
import { db } from "./db";

// Malzeme / fiyat kütüphanesi ve reçeteler (PLAN.md 4). Şirket geneli. Fiyatlar üç yerden gelir:
// aktif bağlantı kalemleri, kütüphaneye eşleştirilmiş faturalar (harcama) ve elle girilen
// teklif / piyasa fiyatları. Bütçede öncelik: bağlantı → fatura → teklif → piyasa.

const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);

/** Her döviz için en son kur (bütçe kur varsayımı). */
export async function latestRates(): Promise<Map<Currency, Decimal>> {
  const rows = await db.exchangeRate.findMany({ orderBy: { date: "desc" }, distinct: ["currency"], select: { currency: true, buying: true } });
  return new Map(rows.map((r) => [r.currency, dec(r.buying)]));
}

/** Kaynakların fiyat adayları (bağlantı, fatura, teklif, piyasa). */
async function priceCandidates(resourceIds: string[]) {
  const today = new Date();
  const [connections, invoices, manual] = await Promise.all([
    db.connectionItem.findMany({
      where: {
        resourceId: { in: resourceIds },
        connection: { status: "ACTIVE", OR: [{ validUntil: null }, { validUntil: { gte: today } }] },
      },
      select: { resourceId: true, unitPrice: true, connection: { select: { no: true, date: true, currency: true, supplier: { select: { name: true } } } } },
    }),
    db.expense.findMany({
      where: { resourceId: { in: resourceIds }, kind: "EXPENSE", deletedAt: null, approvalStatus: { not: "REJECTED" }, unitPrice: { not: null } },
      orderBy: { date: "desc" },
      take: 2000,
      select: { resourceId: true, unitPrice: true, currency: true, date: true, documentNo: true, supplier: { select: { name: true } } },
    }),
    db.resourcePrice.findMany({ where: { resourceId: { in: resourceIds } }, include: { supplier: { select: { name: true } } } }),
  ]);
  const map = new Map<string, PriceCandidate[]>();
  const push = (id: string | null, c: PriceCandidate) => id && (map.get(id) ?? map.set(id, []).get(id)!).push(c);
  for (const c of connections) {
    push(c.resourceId, { kind: "CONNECTION", price: dec(c.unitPrice), currency: c.connection.currency, date: c.connection.date, label: `${c.connection.no} · ${c.connection.supplier.name}` });
  }
  for (const e of invoices) {
    push(e.resourceId, { kind: "INVOICE", price: dec(e.unitPrice), currency: e.currency, date: e.date, label: [e.supplier?.name, e.documentNo].filter(Boolean).join(" · ") });
  }
  for (const p of manual) {
    push(p.resourceId, { kind: p.source, price: dec(p.price), currency: p.currency, date: p.date, label: [p.supplier?.name, p.note].filter(Boolean).join(" · ") });
  }
  return map;
}

export type PriceInfo = { candidate: PriceCandidate | null; priceTry: Decimal | null };

/** Kaynak başına geçerli fiyat ve TL karşılığı. */
export async function priceBook(resourceIds: string[], options: { excludeConnection?: boolean } = {}): Promise<Map<string, PriceInfo>> {
  const [candidates, rates] = await Promise.all([priceCandidates(resourceIds), latestRates()]);
  const book = new Map<string, PriceInfo>();
  for (const id of resourceIds) {
    // Bağlantı kazancı için güncel piyasa fiyatı: bağlantı fiyatı hariç en öncelikli kaynak.
    const list = (candidates.get(id) ?? []).filter((c) => !options.excludeConnection || c.kind !== "CONNECTION");
    const candidate = effectivePrice(list);
    book.set(id, { candidate, priceTry: candidate ? toTry(candidate.price, candidate.currency, rates) : null });
  }
  return book;
}

/** Reçete birim fiyatları (TL); eksik fiyatlı kaynak sayısıyla. */
export async function recipePrices(recipeIds: string[]) {
  const recipes = await db.recipe.findMany({ where: { id: { in: recipeIds } }, include: { lines: { include: { resource: { select: { id: true, wastePercent: true } } } } } });
  const book = await priceBook([...new Set(recipes.flatMap((r) => r.lines.map((l) => l.resourceId)))]);
  return new Map(
    recipes.map((r) => [
      r.id,
      recipeUnitPrice(r.lines.map((l) => ({ quantity: dec(l.quantity), wastePercent: dec(l.resource.wastePercent), priceTry: book.get(l.resourceId)?.priceTry ?? null }))),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Kaynaklar
// ---------------------------------------------------------------------------

export async function listResources(options: { query?: string; type?: ResourceType | null; includeInactive?: boolean } = {}) {
  const { user } = await requireGlobalCapability("library.view");
  const rows = await db.resource.findMany({
    where: { active: options.includeInactive ? undefined : true, type: options.type ?? undefined },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { defaultSupplier: { select: { name: true } } },
  });
  const term = options.query ? normalizeForSearch(options.query) : "";
  const filtered = term ? rows.filter((r) => normalizeForSearch(`${r.code} ${r.name} ${r.category ?? ""}`).includes(term)) : rows;
  const book = await priceBook(filtered.map((r) => r.id));
  return { rows: filtered.map((r) => ({ ...r, price: book.get(r.id)! })), canManage: hasCapability(user.role, "library.manage") };
}

export async function resourceOptions() {
  await getAccess();
  return db.resource.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, unit: true, type: true } });
}

export async function getResource(resourceId: string) {
  const { user } = await requireGlobalCapability("library.view");
  const resource = await db.resource.findUnique({ where: { id: resourceId }, include: { defaultSupplier: { select: { id: true, name: true } } } });
  if (!resource) return null;
  const [candidates, rates, manual, recipes] = await Promise.all([
    priceCandidates([resourceId]),
    latestRates(),
    db.resourcePrice.findMany({ where: { resourceId }, orderBy: { date: "desc" }, select: { id: true } }),
    db.recipeLine.findMany({ where: { resourceId }, include: { recipe: { select: { id: true, code: true, name: true } } } }),
  ]);
  const list = (candidates.get(resourceId) ?? []).sort((a, b) => b.date.getTime() - a.date.getTime());
  const effective = effectivePrice(list);
  return {
    resource,
    history: list,
    manualIds: manual.map((m) => m.id),
    effective,
    effectiveTry: effective ? toTry(effective.price, effective.currency, rates) : null,
    recipes: recipes.map((l) => l.recipe),
    canManage: hasCapability(user.role, "library.manage"),
  };
}

export async function manualPrices(resourceId: string) {
  await requireGlobalCapability("library.view");
  return db.resourcePrice.findMany({ where: { resourceId }, orderBy: { date: "desc" }, include: { supplier: { select: { name: true } } } });
}

export type ResourceData = {
  code: string;
  name: string;
  type: ResourceType;
  category: string | null;
  unit: string;
  wastePercent: Decimal;
  currency: Currency;
  spec: string | null;
  defaultSupplierId: string | null;
  active: boolean;
};

async function nextResourceCode(type: ResourceType) {
  const prefix = { MATERIAL: "M", LABOR: "I", EQUIPMENT: "K", SERVICE: "H" }[type];
  const count = await db.resource.count({ where: { code: { startsWith: `${prefix}-` } } });
  for (let n = count + 1; ; n++) {
    const code = `${prefix}-${String(n).padStart(4, "0")}`;
    if (!(await db.resource.count({ where: { code } }))) return code;
  }
}

export async function saveResource(resourceId: string | null, data: Omit<ResourceData, "code"> & { code: string | null }) {
  const { user } = await requireGlobalCapability("library.manage");
  const code = data.code ?? (resourceId ? undefined : await nextResourceCode(data.type));
  const dup = code ? await db.resource.findFirst({ where: { code, id: resourceId ? { not: resourceId } : undefined } }) : null;
  if (dup) throw new ActionError(`“${code}” kodu kullanılıyor.`);
  return db.$transaction(async (tx) => {
    const saved = resourceId
      ? await tx.resource.update({ where: { id: resourceId }, data: { ...data, code: code ?? undefined } })
      : await tx.resource.create({ data: { ...data, code: code! } });
    await writeAudit(tx, { userId: user.id, action: resourceId ? "update" : "create", entity: "Resource", entityId: saved.id, changes: { code: saved.code, name: saved.name } });
    return saved.id;
  });
}

export async function addResourcePrice(
  resourceId: string,
  data: { date: Date; price: Decimal; currency: Currency; source: PriceSource; supplierId: string | null; note: string | null },
) {
  const { user } = await requireGlobalCapability("library.manage");
  await db.$transaction(async (tx) => {
    const created = await tx.resourcePrice.create({ data: { resourceId, ...data, createdById: user.id } });
    await writeAudit(tx, { userId: user.id, action: "create", entity: "ResourcePrice", entityId: created.id, changes: { resourceId, price: data.price.toString(), source: data.source } });
  });
}

export async function deleteResourcePrice(priceId: string) {
  const { user } = await requireGlobalCapability("library.manage");
  await db.$transaction(async (tx) => {
    const removed = await tx.resourcePrice.delete({ where: { id: priceId } });
    await writeAudit(tx, { userId: user.id, action: "delete", entity: "ResourcePrice", entityId: priceId, changes: { price: removed.price.toString() } });
  });
}

// ---------------------------------------------------------------------------
// Reçeteler
// ---------------------------------------------------------------------------

export async function listRecipes() {
  const { user } = await requireGlobalCapability("library.view");
  const recipes = await db.recipe.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { lines: true, budgetLines: true } } } });
  const prices = await recipePrices(recipes.map((r) => r.id));
  return { rows: recipes.map((r) => ({ ...r, price: prices.get(r.id)! })), canManage: hasCapability(user.role, "library.manage") };
}

export async function getRecipe(recipeId: string) {
  const { user } = await requireGlobalCapability("library.view");
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    include: { lines: { orderBy: { sortOrder: "asc" }, include: { resource: { select: { id: true, code: true, name: true, unit: true, wastePercent: true } } } } },
  });
  if (!recipe) return null;
  const book = await priceBook(recipe.lines.map((l) => l.resourceId));
  const lines = recipe.lines.map((l) => {
    const info = book.get(l.resourceId)!;
    const factor = dec(l.quantity).times(dec(l.resource.wastePercent).div(100).plus(1));
    return { ...l, price: info, amount: info.priceTry ? factor.times(info.priceTry).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null };
  });
  const total = recipeUnitPrice(recipe.lines.map((l) => ({ quantity: dec(l.quantity), wastePercent: dec(l.resource.wastePercent), priceTry: book.get(l.resourceId)?.priceTry ?? null })));
  return { recipe: { ...recipe, lines }, total, canManage: hasCapability(user.role, "library.manage") };
}

export type RecipeData = {
  code: string;
  name: string;
  unit: string;
  description: string | null;
  active: boolean;
  lines: { resourceId: string; quantity: Decimal }[];
};

export async function saveRecipe(recipeId: string | null, data: RecipeData) {
  const { user } = await requireGlobalCapability("library.manage");
  const dup = await db.recipe.findFirst({ where: { code: data.code, id: recipeId ? { not: recipeId } : undefined } });
  if (dup) throw new ActionError(`“${data.code}” kodlu reçete zaten var.`);
  if ((await db.resource.count({ where: { id: { in: data.lines.map((l) => l.resourceId) } } })) !== new Set(data.lines.map((l) => l.resourceId)).size) {
    throw new ActionError("Reçetedeki kaynaklardan biri bulunamadı.");
  }
  return db.$transaction(async (tx) => {
    const { lines, ...header } = data;
    const saved = recipeId ? await tx.recipe.update({ where: { id: recipeId }, data: header }) : await tx.recipe.create({ data: header });
    await tx.recipeLine.deleteMany({ where: { recipeId: saved.id } });
    await tx.recipeLine.createMany({ data: lines.map((l, i) => ({ recipeId: saved.id, resourceId: l.resourceId, quantity: l.quantity, sortOrder: i })) });
    await writeAudit(tx, { userId: user.id, action: recipeId ? "update" : "create", entity: "Recipe", entityId: saved.id, changes: { code: data.code, lines: lines.length } });
    return saved.id;
  });
}

export async function recipeOptions() {
  await getAccess();
  return db.recipe.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, unit: true } });
}

// ---------------------------------------------------------------------------
// Faturalardan fiyat: harcamaları kütüphane kaynaklarıyla eşleştirme (PLAN 4.3)
// ---------------------------------------------------------------------------

const normalizeText = (text: string | null) => normalizeForSearch((text ?? "").replace(/\s+/g, " ").trim());

/**
 * Birim fiyatı olan, eşleşmemiş faturalar. Daha önce aynı açıklamayla (ve birimle) eşleştirilmiş
 * bir fatura varsa öneri olarak o kaynak gelir.
 */
export async function unmatchedInvoices(limit = 100) {
  const { scope } = await requireGlobalCapability("library.manage");
  const where = { ...projectIdsWithCapability(scope, "expense.viewAll"), kind: "EXPENSE" as const, deletedAt: null, approvalStatus: { not: "REJECTED" as const }, unitPrice: { not: null } };
  const [rows, matched, count] = await Promise.all([
    db.expense.findMany({
      where: { ...where, resourceId: null },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        projectId: true,
        date: true,
        description: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        currency: true,
        documentNo: true,
        project: { select: { name: true } },
        supplier: { select: { name: true } },
        costItem: { select: { code: true, name: true } },
      },
    }),
    db.expense.findMany({ where: { ...where, resourceId: { not: null } }, select: { description: true, unit: true, resourceId: true, costItem: { select: { code: true } } }, take: 5000 }),
    db.expense.count({ where: { ...where, resourceId: null } }),
  ]);
  const learned = new Map<string, string>();
  for (const m of matched) {
    if (m.description) learned.set(`${normalizeText(m.description)}|${normalizeText(m.unit)}`, m.resourceId!);
  }
  return {
    count,
    rows: rows.map((r) => ({ ...r, suggestion: r.description ? (learned.get(`${normalizeText(r.description)}|${normalizeText(r.unit)}`) ?? null) : null })),
  };
}

export async function matchInvoices(pairs: { expenseId: string; resourceId: string | null }[]) {
  const { user, scope } = await requireGlobalCapability("library.manage");
  const allowed = projectIdsWithCapability(scope, "expense.viewAll");
  const ids = pairs.map((p) => p.expenseId);
  const found = await db.expense.count({ where: { id: { in: ids }, ...allowed, kind: "EXPENSE", deletedAt: null } });
  if (found !== new Set(ids).size) throw new ActionError("Bazı faturalar bulunamadı veya yetkiniz yok.");
  await db.$transaction(async (tx) => {
    for (const pair of pairs) await tx.expense.update({ where: { id: pair.expenseId }, data: { resourceId: pair.resourceId } });
    await writeAudit(tx, { userId: user.id, action: "match_resource", entity: "Expense", changes: { count: pairs.length } });
  });
  return pairs.length;
}

/** Öğrenilmiş eşleşmeleri (aynı açıklama + birim) eşleşmemiş faturalara uygular. */
export async function applyLearnedMatches() {
  const { rows } = await unmatchedInvoices(1000);
  const pairs = rows.filter((r) => r.suggestion).map((r) => ({ expenseId: r.id, resourceId: r.suggestion! }));
  if (pairs.length) await matchInvoices(pairs);
  return pairs.length;
}
