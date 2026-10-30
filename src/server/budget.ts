import "server-only";
import Decimal from "decimal.js";
import type { BudgetPriceSource, CoefficientBasis, Currency, QuantitySource, SupplyMethod } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { lineAmount, squareMeterCosts, summarizeBudget } from "@/lib/budget/budget";
import { evaluateFormula } from "@/lib/budget/formula";
import { actualCoefficient, basisValue, formulaVariables, parametricQuantity, projectMetrics, type ProjectMetrics } from "@/lib/budget/metrics";
import { toTry } from "@/lib/budget/pricing";
import { compareCodes } from "@/lib/cost-tree/tree";
import { COST_KINDS } from "@/lib/expenses/kinds";
import { ActionError, requireProjectAccess, requireProjectCapability } from "./access";
import { writeAudit } from "./audit";
import { db, type Tx } from "./db";
import { latestRates, priceBook, recipePrices } from "./library";

// Metraj ve bütçe (PLAN.md 6, 7.1–7.3). Parametrik ve formül miktarları ile reçete / kütüphane
// fiyatları okunurken canlı hesaplanır; böylece alan veya fiyat değişince bütçe kendiliğinden güncellenir.

const zero = () => new Decimal(0);
const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);

async function loadMetrics(projectId: string): Promise<ProjectMetrics> {
  const [project, blocks, units] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { landArea: true } }),
    db.block.findMany({ where: { projectId }, select: { constructionArea: true, floorCount: true, basementCount: true } }),
    db.unit.findMany({ where: { projectId }, select: { netArea: true, grossArea: true, owner: true } }),
  ]);
  return projectMetrics({
    landArea: project?.landArea ? dec(project.landArea) : null,
    blocks: blocks.map((b) => ({ constructionArea: b.constructionArea ? dec(b.constructionArea) : null, floorCount: b.floorCount, basementCount: b.basementCount })),
    units: units.map((u) => ({ netArea: dec(u.netArea), grossArea: dec(u.grossArea), owner: u.owner })),
  });
}

/** Projenin katsayıları; hiç yoksa şablondan kopyalanır (PLAN 12: şablon proje). */
async function ensureCoefficients(projectId: string) {
  const count = await db.parametricCoefficient.count({ where: { projectId } });
  if (count === 0) {
    const template = await db.parametricCoefficient.findMany({ where: { projectId: null }, orderBy: { sortOrder: "asc" } });
    if (template.length) {
      await db.parametricCoefficient.createMany({
        data: template.map(({ id: _id, projectId: _p, ...rest }) => ({ ...rest, projectId })),
      });
    }
  }
  return db.parametricCoefficient.findMany({ where: { projectId }, orderBy: [{ sortOrder: "asc" }, { costItemCode: "asc" }] });
}

type LineRow = Awaited<ReturnType<typeof loadLines>>[number];

function loadLines(projectId: string) {
  return db.budgetLine.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      costItem: { select: { id: true, code: true, name: true } },
      block: { select: { id: true, name: true } },
      coefficient: true,
      recipe: { select: { id: true, code: true, name: true, unit: true } },
      resource: { select: { id: true, code: true, name: true, unit: true, wastePercent: true } },
    },
  });
}

/** Satırın canlı miktarı, birim fiyatı (TL) ve tutarı; sorunlar uyarı olarak. */
async function computeLines(lines: LineRow[], metrics: ProjectMetrics) {
  const variables = formulaVariables(metrics);
  const [resources, recipes, rates] = await Promise.all([
    priceBook([...new Set(lines.map((l) => l.resourceId).filter((id): id is string => Boolean(id)))]),
    recipePrices([...new Set(lines.map((l) => l.recipeId).filter((id): id is string => Boolean(id)))]),
    latestRates(),
  ]);
  return lines.map((line) => {
    const warnings: string[] = [];
    let quantity = dec(line.quantity);
    if (line.quantitySource === "PARAMETRIC" && line.coefficient) {
      quantity = parametricQuantity(line.coefficient.basis, dec(line.coefficient.coefficient), metrics);
    } else if (line.quantitySource === "FORMULA" && line.formula) {
      const result = evaluateFormula(line.formula, variables);
      if (result.ok) quantity = result.value;
      else warnings.push(`Formül: ${result.error}`);
    }
    let unitPriceTry: Decimal | null = null;
    let priceLabel = "";
    if (line.priceSource === "RECIPE" && line.recipeId) {
      const r = recipes.get(line.recipeId);
      unitPriceTry = r?.unitPrice ?? null;
      priceLabel = `Reçete ${line.recipe?.code ?? ""}`;
      if (r?.missing) warnings.push(`Reçetede fiyatı olmayan ${r.missing} kaynak var.`);
    } else if (line.priceSource === "RESOURCE" && line.resourceId) {
      const info = resources.get(line.resourceId);
      unitPriceTry = info?.priceTry ?? null;
      priceLabel = info?.candidate ? `${{ CONNECTION: "Bağlantı", INVOICE: "Son alım", QUOTE: "Teklif", MARKET: "Piyasa" }[info.candidate.kind]}${info.candidate.label ? ` · ${info.candidate.label}` : ""}` : "";
      if (!info?.candidate) warnings.push("Kütüphanede fiyatı yok.");
      else if (!info.priceTry) warnings.push(`${info.candidate.currency} kuru yok.`);
    } else if (line.unitPrice != null) {
      unitPriceTry = toTry(dec(line.unitPrice), line.currency, rates);
      priceLabel = "Elle";
      if (!unitPriceTry) warnings.push(`${line.currency} kuru yok.`);
    } else {
      warnings.push("Birim fiyat yok.");
    }
    const amount = unitPriceTry ? lineAmount(quantity, unitPriceTry, dec(line.wastePercent)) : zero();
    return { ...line, quantityLive: quantity, unitPriceTry, priceLabel, amount, warnings };
  });
}

export async function getBudget(projectId: string) {
  const { role } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "budget.view")) throw new ActionError("Bu projenin bütçesini görme yetkiniz yok.");
  const [metrics, items, blocks, rawLines, actual] = await Promise.all([
    loadMetrics(projectId),
    db.costItem.findMany({ where: { projectId }, orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true, parentId: true, unit: true, active: true } }),
    db.block.findMany({ where: { projectId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, constructionArea: true } }),
    loadLines(projectId),
    db.expense.groupBy({ by: ["costItemId"], where: { projectId, deletedAt: null, approvalStatus: "APPROVED", kind: { in: [...COST_KINDS] } }, _sum: { netAmountTry: true } }),
  ]);
  const lines = await computeLines(rawLines, metrics);
  const summary = summarizeBudget(
    lines.map((l) => ({ costItemCode: l.costItem.code, blockId: l.blockId, amount: l.amount })),
    blocks.map((b) => ({ id: b.id, constructionArea: dec(b.constructionArea) })),
  );
  const m2 = squareMeterCosts(summary, { constructionArea: metrics.constructionArea, contractorGross: metrics.contractorGross });

  // Kalem ağacında bütçe ve gerçekleşen toplamları (üst kalemler alt kalemleri kapsar).
  const byId = new Map(items.map((i) => [i.id, i]));
  const budgetByItem = new Map<string, Decimal>();
  const actualByItem = new Map<string, Decimal>();
  const addUp = (map: Map<string, Decimal>, id: string | null, amount: Decimal) => {
    for (let cur = id ? byId.get(id) : undefined; cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      map.set(cur.id, (map.get(cur.id) ?? zero()).plus(amount));
    }
  };
  for (const l of lines) addUp(budgetByItem, l.costItemId, l.amount);
  for (const a of actual) addUp(actualByItem, a.costItemId, dec(a._sum.netAmountTry));
  const actualTotal = actual.reduce((s, a) => s.plus(dec(a._sum.netAmountTry)), zero());

  return {
    canEdit: hasCapability(role, "budget.edit"),
    metrics,
    summary,
    m2,
    actualTotal,
    blocks,
    items: items
      .map((i) => ({ ...i, budget: budgetByItem.get(i.id) ?? zero(), actual: actualByItem.get(i.id) ?? zero() }))
      .sort((a, b) => compareCodes(a.code, b.code)),
    lines,
  };
}

/** Portföy ve proje kartı için bütçe toplamı (yetkisi yoksa null). */
export async function budgetTotals(projectIds: string[]) {
  const result = new Map<string, Decimal>();
  for (const projectId of projectIds) {
    const metrics = await loadMetrics(projectId);
    const lines = await computeLines(await loadLines(projectId), metrics);
    result.set(projectId, lines.reduce((s, l) => s.plus(l.amount), zero()));
  }
  return result;
}

export type BudgetLineData = {
  costItemId: string;
  blockId: string | null;
  description: string | null;
  supplyMethod: SupplyMethod | null;
  quantitySource: QuantitySource;
  quantity: Decimal | null;
  formula: string | null;
  coefficientId: string | null;
  unit: string | null;
  priceSource: BudgetPriceSource;
  recipeId: string | null;
  resourceId: string | null;
  unitPrice: Decimal | null;
  currency: Currency;
  wastePercent: Decimal;
  priceNote: string | null;
};

async function validateLine(tx: Tx, projectId: string, data: BudgetLineData, metrics: ProjectMetrics): Promise<Decimal> {
  const item = await tx.costItem.findFirst({ where: { id: data.costItemId, projectId }, select: { active: true } });
  if (!item) throw new ActionError("Maliyet kalemi bu projede yok.");
  if (data.blockId && !(await tx.block.count({ where: { id: data.blockId, projectId } }))) throw new ActionError("Blok bu projede yok.");
  if (data.priceSource === "RECIPE" && !data.recipeId) throw new ActionError("Reçete seçin.");
  if (data.priceSource === "RESOURCE" && !data.resourceId) throw new ActionError("Kütüphane kaynağı seçin.");
  if (data.priceSource === "MANUAL" && data.unitPrice == null) throw new ActionError("Birim fiyatı girin.");
  if (data.quantitySource === "PARAMETRIC") {
    const coef = data.coefficientId ? await tx.parametricCoefficient.findFirst({ where: { id: data.coefficientId, projectId } }) : null;
    if (!coef) throw new ActionError("Parametrik katsayı seçin.");
    return parametricQuantity(coef.basis, dec(coef.coefficient), metrics);
  }
  if (data.quantitySource === "FORMULA") {
    const result = evaluateFormula(data.formula ?? "", formulaVariables(metrics));
    if (!result.ok) throw new ActionError(`Formül: ${result.error}`);
    return result.value;
  }
  if (data.quantity == null) throw new ActionError("Miktarı girin.");
  return data.quantity;
}

function lineColumns(data: BudgetLineData, quantity: Decimal) {
  return {
    costItemId: data.costItemId,
    blockId: data.blockId,
    description: data.description,
    supplyMethod: data.supplyMethod,
    quantitySource: data.quantitySource,
    quantity,
    formula: data.quantitySource === "FORMULA" ? data.formula : null,
    coefficientId: data.quantitySource === "PARAMETRIC" ? data.coefficientId : null,
    unit: data.unit,
    priceSource: data.priceSource,
    recipeId: data.priceSource === "RECIPE" ? data.recipeId : null,
    resourceId: data.priceSource === "RESOURCE" ? data.resourceId : null,
    unitPrice: data.priceSource === "MANUAL" ? data.unitPrice : null,
    currency: data.priceSource === "MANUAL" ? data.currency : "TRY",
    wastePercent: data.wastePercent,
    priceNote: data.priceNote,
  } as const;
}

export async function saveBudgetLine(projectId: string, lineId: string | null, data: BudgetLineData) {
  const { user } = await requireProjectCapability(projectId, "budget.edit");
  const metrics = await loadMetrics(projectId);
  await db.$transaction(async (tx) => {
    const quantity = await validateLine(tx, projectId, data, metrics);
    const saved = lineId
      ? await tx.budgetLine.update({ where: { id: lineId, projectId }, data: lineColumns(data, quantity) })
      : await tx.budgetLine.create({ data: { projectId, ...lineColumns(data, quantity) } });
    await writeAudit(tx, { userId: user.id, projectId, action: lineId ? "update" : "create", entity: "BudgetLine", entityId: saved.id, changes: { costItemId: data.costItemId, quantity: quantity.toString() } });
  });
}

export async function deleteBudgetLine(projectId: string, lineId: string) {
  const { user } = await requireProjectCapability(projectId, "budget.edit");
  await db.$transaction(async (tx) => {
    await tx.budgetLine.delete({ where: { id: lineId, projectId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "BudgetLine", entityId: lineId });
  });
}

// ---------------------------------------------------------------------------
// Metraj ekranı: katsayılar, gerçekleşen katsayılar, formül değişkenleri
// ---------------------------------------------------------------------------

export async function getQuantities(projectId: string) {
  const { role } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "budget.view")) throw new ActionError("Bu projenin metrajını görme yetkiniz yok.");
  const [metrics, coefficients, costItems] = await Promise.all([
    loadMetrics(projectId),
    ensureCoefficients(projectId),
    db.costItem.findMany({ where: { projectId }, select: { id: true, code: true, name: true } }),
  ]);
  const itemByCode = new Map(costItems.map((c) => [c.code, c]));
  // Gerçekleşen miktar: aynı kalemde, katsayıyla aynı birimdeki onaylı harcama / çekiş miktarları.
  const actualRows = await db.expense.findMany({
    where: { projectId, deletedAt: null, approvalStatus: "APPROVED", kind: { in: [...COST_KINDS] }, quantity: { not: null }, costItem: { code: { in: coefficients.map((c) => c.costItemCode) } } },
    select: { quantity: true, unit: true, costItem: { select: { code: true } } },
  });
  const linked = await db.budgetLine.findMany({ where: { projectId, coefficientId: { in: coefficients.map((c) => c.id) } }, select: { coefficientId: true } });
  const norm = (u: string | null) => (u ?? "").trim().toLocaleLowerCase("tr-TR");
  return {
    canEdit: hasCapability(role, "budget.edit"),
    metrics,
    variables: formulaVariables(metrics),
    coefficients: coefficients.map((c) => {
      const actualQty = actualRows
        .filter((r) => r.costItem?.code === c.costItemCode && norm(r.unit) === norm(c.unit))
        .reduce((s, r) => s.plus(dec(r.quantity)), zero());
      return {
        ...c,
        costItem: itemByCode.get(c.costItemCode) ?? null,
        base: basisValue(c.basis, metrics),
        quantity: parametricQuantity(c.basis, dec(c.coefficient), metrics),
        actualQuantity: actualQty,
        actualCoefficient: actualQty.gt(0) ? actualCoefficient(actualQty, c.basis, metrics) : null,
        inBudget: linked.some((l) => l.coefficientId === c.id),
      };
    }),
  };
}

export type CoefficientData = { costItemCode: string; name: string; basis: CoefficientBasis; coefficient: Decimal; unit: string; note: string | null };

export async function saveCoefficient(projectId: string, coefficientId: string | null, data: CoefficientData) {
  const { user } = await requireProjectCapability(projectId, "budget.edit");
  if (!(await db.costItem.count({ where: { projectId, code: data.costItemCode } }))) throw new ActionError(`“${data.costItemCode}” kalemi bu projede yok.`);
  await db.$transaction(async (tx) => {
    const saved = coefficientId
      ? await tx.parametricCoefficient.update({ where: { id: coefficientId, projectId }, data })
      : await tx.parametricCoefficient.create({ data: { projectId, ...data, sortOrder: 100 } });
    await writeAudit(tx, { userId: user.id, projectId, action: coefficientId ? "update" : "create", entity: "ParametricCoefficient", entityId: saved.id, changes: { code: data.costItemCode, coefficient: data.coefficient.toString() } });
  });
}

export async function deleteCoefficient(projectId: string, coefficientId: string) {
  const { user } = await requireProjectCapability(projectId, "budget.edit");
  if (await db.budgetLine.count({ where: { coefficientId } })) throw new ActionError("Bu katsayıyı kullanan bütçe satırı var; önce satırın miktar kaynağını değiştirin.");
  await db.$transaction(async (tx) => {
    await tx.parametricCoefficient.delete({ where: { id: coefficientId, projectId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "ParametricCoefficient", entityId: coefficientId });
  });
}

/**
 * Bütçede satırı olmayan katsayılar için parametrik bütçe satırı açar (fiyat: elle, boş → 0).
 * Fiyat sonra bütçe ekranından reçete / kütüphane / elle seçilir.
 */
export async function addCoefficientLines(projectId: string, coefficientIds: string[]) {
  const { user } = await requireProjectCapability(projectId, "budget.edit");
  const metrics = await loadMetrics(projectId);
  const coefficients = await db.parametricCoefficient.findMany({ where: { id: { in: coefficientIds }, projectId } });
  let created = 0;
  await db.$transaction(async (tx) => {
    for (const c of coefficients) {
      if (await tx.budgetLine.count({ where: { projectId, coefficientId: c.id } })) continue;
      const item = await tx.costItem.findFirst({ where: { projectId, code: c.costItemCode }, select: { id: true } });
      if (!item) continue;
      await tx.budgetLine.create({
        data: {
          projectId,
          costItemId: item.id,
          description: c.name,
          quantitySource: "PARAMETRIC",
          coefficientId: c.id,
          quantity: parametricQuantity(c.basis, dec(c.coefficient), metrics),
          unit: c.unit,
          priceSource: "MANUAL",
          unitPrice: 0,
        },
      });
      created++;
    }
    await writeAudit(tx, { userId: user.id, projectId, action: "create", entity: "BudgetLine", changes: { fromCoefficients: created } });
  });
  return created;
}
