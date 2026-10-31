import "server-only";
import Decimal from "decimal.js";
import type { PricingCostBasis, PricingFactorKind, ProfitMethod, UsageType } from "@/generated/prisma/enums";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { topCode } from "@/lib/budget/budget";
import { basePrice, factorKey, priceUnits, profitSummary, requiredChangePercent, unitVatRate, withVat, type FactorKind, type FactorTable, type VatRule } from "@/lib/pricing/pricing";
import { ActionError, getAccess, requireProjectAccess, requireProjectCapability } from "./access";
import { diffFields, writeAudit } from "./audit";
import { computeLines, loadLines, loadMetrics } from "./budget";
import { getBudgetControl } from "./control";
import { db } from "./db";

// Fiyatlandırma (PLAN.md 7.4–7.6, Faz 5): maliyet tabanı, reklam ve komisyon, kâr yöntemi, katsayılar,
// normalizasyon, KDV, kilitli bölümler ve onaylı fiyat listesi sürümleri.

const zero = () => new Decimal(0);
const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);
const decOrNull = (value: { toString(): string } | null | undefined) => (value == null ? null : new Decimal(value.toString()));

/** Reklam ve satış giderleri grubu; komisyon yüzde olarak ayrıca girilir (PLAN 3/14, 7.4). */
const MARKETING_GROUP = "14";
const COMMISSION_CODE = "14.06";
const SALES_VAT_CODE = "15.01";

const DEFAULT_SETTINGS = {
  profitMethod: "MARGIN" as ProfitMethod,
  profitPercent: zero(),
  commissionPercent: zero(),
  advertisingBudget: null as Decimal | null,
  costBasis: "BUDGET" as PricingCostBasis,
  manualCost: null as Decimal | null,
  roundingStep: new Decimal(10000),
  extraAreaFactor: zero(),
  reducedVatEligible: true,
};

export type PricingSettings = typeof DEFAULT_SETTINGS;

async function loadSettings(projectId: string): Promise<PricingSettings & { updatedAt: Date | null }> {
  const s = await db.pricingSetting.findUnique({ where: { projectId } });
  if (!s) return { ...DEFAULT_SETTINGS, updatedAt: null };
  return {
    profitMethod: s.profitMethod,
    profitPercent: dec(s.profitPercent),
    commissionPercent: dec(s.commissionPercent),
    advertisingBudget: decOrNull(s.advertisingBudget),
    costBasis: s.costBasis,
    manualCost: decOrNull(s.manualCost),
    roundingStep: dec(s.roundingStep),
    extraAreaFactor: dec(s.extraAreaFactor),
    reducedVatEligible: s.reducedVatEligible,
    updatedAt: s.updatedAt,
  };
}

/** Maliyet tabanı: komisyon ve reklam hariç maliyet, bütçedeki reklam tutarı ve uyarılar. */
async function pricingCosts(projectId: string, settings: PricingSettings) {
  const warnings: string[] = [];
  const metrics = await loadMetrics(projectId);
  const lines = await computeLines(await loadLines(projectId), metrics);
  const sumWhere = (pred: (code: string) => boolean) => lines.filter((l) => pred(l.costItem.code)).reduce((s, l) => s.plus(l.amount), zero());
  const budgetTotal = lines.reduce((s, l) => s.plus(l.amount), zero());
  const budgetMarketing = sumWhere((c) => topCode(c) === MARKETING_GROUP);
  const budgetCommission = sumWhere((c) => c === COMMISSION_CODE || c.startsWith(`${COMMISSION_CODE}.`));
  if (budgetCommission.gt(0)) warnings.push("Bütçede 14.06 komisyon tutarı var; fiyatlandırmada komisyon yüzde olarak eklendiği için bu tutar maliyete katılmadı.");
  if (sumWhere((c) => c === SALES_VAT_CODE || c.startsWith(`${SALES_VAT_CODE}.`)).gt(0)) {
    warnings.push("Bütçede 15.01 satış KDV'si var; KDV fiyata ayrıca eklendiği için çift sayılabilir.");
  }

  let cost: Decimal;
  let advertisingFromBudget = budgetMarketing.minus(budgetCommission);
  if (settings.costBasis === "EAC") {
    const control = await getBudgetControl(projectId, null);
    const eacOf = (code: string) => control.rows.find((r) => r.code === code)?.control.eac ?? zero();
    cost = control.totals.eac.minus(eacOf(MARKETING_GROUP));
    advertisingFromBudget = eacOf(MARKETING_GROUP).minus(eacOf(COMMISSION_CODE));
  } else if (settings.costBasis === "MANUAL") {
    cost = settings.manualCost ?? zero();
    if (!settings.manualCost) warnings.push("Elle maliyet seçili ama tutar girilmemiş.");
  } else {
    cost = budgetTotal.minus(budgetMarketing);
  }
  if (settings.costBasis !== "MANUAL" && lines.length === 0) warnings.push("Bütçe boş; maliyet tabanı sıfır. Bütçe girin veya elle maliyet seçin.");
  return { metrics, cost, advertising: settings.advertisingBudget ?? advertisingFromBudget, advertisingFromBudget, budgetTotal, warnings };
}

/** Satış KDV kuralı: oranlar parametre tablosundan (en güncel yıl). */
async function saleVatRule(reducedEligible: boolean): Promise<VatRule & { missing: string[] }> {
  const rows = await db.parameter.findMany({
    where: { kind: { in: ["satis_kdv_konut_indirimli", "satis_kdv_konut_net_sinir", "satis_kdv_genel"] }, municipality: null },
    orderBy: { year: "desc" },
  });
  const latest = (kind: string) => decOrNull(rows.find((r) => r.kind === kind)?.value);
  const rule = {
    reducedRate: latest("satis_kdv_konut_indirimli"),
    reducedNetAreaLimit: latest("satis_kdv_konut_net_sinir"),
    generalRate: latest("satis_kdv_genel"),
    reducedEligible,
  };
  const missing = [
    !rule.generalRate && "Satış KDV – genel oran",
    reducedEligible && !rule.reducedRate && "Satış KDV – konut indirimli oran",
    reducedEligible && !rule.reducedNetAreaLimit && "Satış KDV – net alan sınırı",
  ].filter((x): x is string => Boolean(x));
  return { ...rule, missing };
}

function factorTable(rows: { kind: PricingFactorKind; key: string; value: { toString(): string } }[]): FactorTable {
  const table = new Map<FactorKind, Map<string, Decimal>>();
  for (const r of rows) (table.get(r.kind) ?? table.set(r.kind, new Map()).get(r.kind)!).set(r.key, dec(r.value));
  return table;
}

function loadUnits(projectId: string) {
  return db.unit.findMany({
    where: { projectId },
    include: { block: { select: { id: true, name: true, sortOrder: true } }, landowner: { select: { name: true } } },
  });
}

type UnitRow = Awaited<ReturnType<typeof loadUnits>>[number];

const sortUnits = (units: UnitRow[]) =>
  units.sort(
    (a, b) =>
      a.block.sortOrder - b.block.sortOrder ||
      a.block.name.localeCompare(b.block.name, "tr") ||
      a.floor - b.floor ||
      a.doorNo.localeCompare(b.doorNo, "tr", { numeric: true }),
  );

/** Canlı fiyat hesabı (yetki kontrolü çağıranda). */
async function computePricing(projectId: string) {
  const [settings, factorRows, units, lists] = await Promise.all([
    loadSettings(projectId),
    db.pricingFactor.findMany({ where: { projectId } }),
    loadUnits(projectId),
    db.priceList.findMany({ where: { projectId }, orderBy: { approvedAt: "desc" }, include: { approvedBy: { select: { name: true } } } }),
  ]);
  sortUnits(units);
  const costs = await pricingCosts(projectId, settings);
  const vat = await saleVatRule(settings.reducedVatEligible);
  const factors = factorTable(factorRows);
  const contractorUnits = units.filter((u) => u.owner === "CONTRACTOR");
  const base = basePrice({
    cost: costs.cost,
    advertising: costs.advertising,
    contractorGross: costs.metrics.contractorGross,
    commissionPercent: settings.commissionPercent,
    method: settings.profitMethod,
    profitPercent: settings.profitPercent,
  });
  const lockedWithoutPrice = contractorUnits.filter((u) => u.priceLocked && u.listPrice == null).length;
  const priced = base.ok
    ? priceUnits({
        targetRevenue: base.targetRevenue,
        units: contractorUnits.map((u) => ({
          id: u.id,
          usageType: u.usageType,
          grossArea: dec(u.grossArea),
          extraArea: decOrNull(u.extraArea),
          floor: u.floor,
          facade: u.facade,
          view: u.view,
          layout: u.layout,
          lockedPrice: u.priceLocked && u.listPrice != null ? dec(u.listPrice) : null,
        })),
        factors,
        extraAreaFactor: settings.extraAreaFactor,
        roundingStep: settings.roundingStep,
      })
    : null;
  const pricedById = new Map(priced?.units.map((p) => [p.id, p]) ?? []);
  const rows = units.map((u) => {
    const p = pricedById.get(u.id) ?? null;
    const vatRate = u.owner === "CONTRACTOR" ? unitVatRate({ usageType: u.usageType, netArea: dec(u.netArea), override: decOrNull(u.vatRateOverride) }, vat) : null;
    const price = p?.price ?? null;
    const current = decOrNull(u.listPrice);
    return {
      unit: u,
      priced: p,
      price,
      vatRate,
      priceWithVat: price ? withVat(price, vatRate) : null,
      perM2: price && dec(u.grossArea).gt(0) ? price.div(dec(u.grossArea)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null,
      current,
      change: price && current?.gt(0) && !u.priceLocked ? price.div(current).minus(1).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null,
    };
  });
  const profit = priced ? profitSummary({ revenue: priced.total, cost: costs.cost, advertising: costs.advertising, commissionPercent: settings.commissionPercent }) : null;
  const warnings = [...costs.warnings, ...(priced?.warnings ?? [])];
  if (vat.missing.length) warnings.push(`Ayarlar → Parametreler'de eksik: ${vat.missing.join(", ")}.`);
  if (lockedWithoutPrice) warnings.push(`${lockedWithoutPrice} bölüm kilitli ama onaylı fiyatı yok; yeniden fiyatlanıyor.`);
  if (contractorUnits.length === 0) warnings.push("Müteahhide ait bağımsız bölüm yok; önce bölümleri girin.");
  return {
    settings,
    costs,
    vat,
    factors,
    factorRows,
    base,
    priced,
    rows,
    profit,
    warnings,
    lists,
    requiredChange: priced ? requiredChangePercent(rows.filter((r) => r.price).map((r) => ({ current: r.current, next: r.price!, locked: r.unit.priceLocked }))) : null,
  };
}

/** Katsayı tablolarında seçenekler: bölümlerde geçen değerler. */
function factorOptions(units: UnitRow[], rows: { kind: PricingFactorKind; key: string; value: { toString(): string } }[]) {
  const contractor = units.filter((u) => u.owner === "CONTRACTOR");
  const valueOf = (kind: PricingFactorKind, key: string) => rows.find((r) => r.kind === kind && r.key === key)?.value.toString() ?? null;
  const distinct = (values: (string | number | null)[]) => [...new Set(values.map(factorKey))];
  const keys: Record<PricingFactorKind, string[]> = {
    USAGE: distinct(contractor.map((u) => u.usageType)),
    FLOOR: distinct(contractor.map((u) => u.floor)).sort((a, b) => Number(a) - Number(b)),
    FACADE: distinct(contractor.map((u) => u.facade)).sort((a, b) => a.localeCompare(b, "tr")),
    VIEW: distinct(contractor.map((u) => u.view)).sort((a, b) => a.localeCompare(b, "tr")),
    LAYOUT: distinct(contractor.map((u) => u.layout)).sort((a, b) => a.localeCompare(b, "tr")),
  };
  return (Object.keys(keys) as PricingFactorKind[]).map((kind) => ({
    kind,
    entries: keys[kind].map((key) => ({
      key,
      value: valueOf(kind, key),
      count: contractor.filter((u) => factorKey(kind === "USAGE" ? u.usageType : kind === "FLOOR" ? u.floor : kind === "FACADE" ? u.facade : kind === "VIEW" ? u.view : u.layout) === key).length,
    })),
  }));
}

export async function getPricing(projectId: string) {
  const { role, scope } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "priceList.view")) throw new ActionError("Fiyat listesini görme yetkiniz yok.");
  if (!hasCapability(role, "pricing.view")) return { mode: "list" as const, ...(await getApprovedList(projectId)) };
  const data = await computePricing(projectId);
  const units = data.rows.map((r) => r.unit);
  const projectIds = scope.all ? null : [...scope.grants].filter(([id, r]) => id !== projectId && hasCapability(r, "pricing.view")).map(([id]) => id);
  const others = await db.project.findMany({
    where: { id: projectIds ? { in: projectIds } : { not: projectId }, pricingFactors: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return {
    mode: "full" as const,
    ...data,
    factorOptions: factorOptions(units, data.factorRows),
    copySources: others,
    canEdit: hasCapability(role, "pricing.edit"),
    canApprove: hasCapability(role, "pricing.approve"),
  };
}

/** Onaylı liste: bölümlerde kayıtlı liste fiyatları (satış ekibi maliyet görmez). */
export async function getApprovedList(projectId: string) {
  const { role } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "priceList.view")) throw new ActionError("Fiyat listesini görme yetkiniz yok.");
  const [units, list] = await Promise.all([
    loadUnits(projectId),
    db.priceList.findFirst({ where: { projectId }, orderBy: { approvedAt: "desc" }, select: { id: true, name: true, approvedAt: true, note: true } }),
  ]);
  sortUnits(units);
  return {
    list,
    rows: units.map((u) => {
      const price = decOrNull(u.listPrice);
      const vatRate = decOrNull(u.listVatRate);
      return {
        unit: u,
        price,
        vatRate,
        priceWithVat: price ? withVat(price, vatRate) : null,
        perM2: price && dec(u.grossArea).gt(0) ? price.div(dec(u.grossArea)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Kayıt işlemleri
// ---------------------------------------------------------------------------

export async function savePricingSettings(projectId: string, data: PricingSettings) {
  const { user } = await requireProjectCapability(projectId, "pricing.edit");
  await db.$transaction(async (tx) => {
    const before = await tx.pricingSetting.findUnique({ where: { projectId } });
    await tx.pricingSetting.upsert({ where: { projectId }, create: { projectId, ...data, updatedById: user.id }, update: { ...data, updatedById: user.id } });
    await writeAudit(tx, { userId: user.id, projectId, action: before ? "update" : "create", entity: "PricingSetting", entityId: projectId, changes: diffFields(before ?? {}, data) });
  });
}

/** Bir katsayı tablosunu kaydeder; 1,00 olan değerler saklanmaz (varsayılan). */
export async function saveFactors(projectId: string, kind: PricingFactorKind, entries: { key: string; value: Decimal | null }[]) {
  const { user } = await requireProjectCapability(projectId, "pricing.edit");
  await db.$transaction(async (tx) => {
    for (const e of entries) {
      if (!e.value || e.value.eq(1)) await tx.pricingFactor.deleteMany({ where: { projectId, kind, key: e.key } });
      else await tx.pricingFactor.upsert({ where: { projectId_kind_key: { projectId, kind, key: e.key } }, create: { projectId, kind, key: e.key, value: e.value }, update: { value: e.value } });
    }
    await writeAudit(tx, { userId: user.id, projectId, action: "factors", entity: "PricingFactor", entityId: kind, changes: entries.map((e) => ({ key: e.key, value: e.value?.toString() ?? null })) });
  });
}

/** Önceki projenin katsayılarını kopyalar (PLAN 7.6); bu projedekilerin yerini alır. */
export async function copyFactors(projectId: string, sourceProjectId: string) {
  const { user, scope } = await requireProjectCapability(projectId, "pricing.edit");
  if (!hasCapability(projectRole(scope, sourceProjectId), "pricing.view")) throw new ActionError("Kaynak projeye erişiminiz yok.");
  const source = await db.pricingFactor.findMany({ where: { projectId: sourceProjectId } });
  if (source.length === 0) throw new ActionError("Seçilen projede katsayı yok.");
  await db.$transaction(async (tx) => {
    await tx.pricingFactor.deleteMany({ where: { projectId } });
    await tx.pricingFactor.createMany({ data: source.map((f) => ({ projectId, kind: f.kind, key: f.key, value: f.value })) });
    await writeAudit(tx, { userId: user.id, projectId, action: "copy", entity: "PricingFactor", entityId: sourceProjectId, changes: { count: source.length } });
  });
  return source.length;
}

export async function setUnitVatOverride(projectId: string, unitId: string, rate: Decimal | null) {
  const { user } = await requireProjectCapability(projectId, "pricing.edit");
  await db.$transaction(async (tx) => {
    const unit = await tx.unit.update({ where: { id: unitId, projectId }, data: { vatRateOverride: rate } });
    await writeAudit(tx, { userId: user.id, projectId, action: "vat", entity: "Unit", entityId: unitId, changes: { doorNo: unit.doorNo, vatRateOverride: rate?.toString() ?? null } });
  });
}

/** Fiyat kilidi: kilitli bölümün onaylı fiyatı yeniden fiyatlamada değişmez. */
export async function setUnitsLocked(projectId: string, unitIds: string[], locked: boolean) {
  const { user } = await requireProjectCapability(projectId, "pricing.approve");
  const units = await db.unit.findMany({ where: { id: { in: unitIds }, projectId }, select: { id: true, doorNo: true, listPrice: true, owner: true } });
  if (locked && units.some((u) => u.listPrice == null)) throw new ActionError("Onaylı fiyatı olmayan bölüm kilitlenemez; önce fiyat listesini onaylayın.");
  if (units.some((u) => u.owner !== "CONTRACTOR")) throw new ActionError("Arsa sahibi bölümleri fiyatlanmaz.");
  await db.$transaction(async (tx) => {
    await tx.unit.updateMany({ where: { id: { in: units.map((u) => u.id) } }, data: { priceLocked: locked } });
    await writeAudit(tx, { userId: user.id, projectId, action: locked ? "lock" : "unlock", entity: "Unit", changes: { units: units.map((u) => u.doorNo) } });
  });
}

/** Güncel hesabı fiyat listesi olarak onaylar: sürüm saklanır, kilitsiz bölümlerin liste fiyatı güncellenir. */
export async function approvePriceList(projectId: string, name: string, note: string | null) {
  const { user } = await requireProjectCapability(projectId, "pricing.approve");
  const data = await computePricing(projectId);
  if (!data.base.ok) throw new ActionError(data.base.error);
  if (!data.priced?.normalization && data.priced?.units.some((u) => !u.locked)) throw new ActionError(data.priced.warnings[0] ?? "Fiyatlar hesaplanamadı.");
  const priced = data.rows.filter((r) => r.price);
  if (priced.length === 0) throw new ActionError("Fiyatlanacak bölüm yok.");
  const base = data.base;
  return db.$transaction(async (tx) => {
    const list = await tx.priceList.create({
      data: {
        projectId,
        name,
        note,
        costBasis: data.settings.costBasis,
        cost: data.costs.cost,
        advertising: data.costs.advertising,
        commissionPercent: data.settings.commissionPercent,
        profitMethod: data.settings.profitMethod,
        profitPercent: data.settings.profitPercent,
        baseM2: base.baseM2,
        targetRevenue: base.targetRevenue,
        total: data.priced!.total,
        approvedById: user.id,
        lines: { create: priced.map((r) => ({ unitId: r.unit.id, price: r.price!, vatRate: r.vatRate, locked: r.unit.priceLocked })) },
      },
    });
    for (const r of priced) {
      if (r.unit.priceLocked) continue;
      await tx.unit.update({ where: { id: r.unit.id }, data: { listPrice: r.price, listVatRate: r.vatRate } });
    }
    await writeAudit(tx, { userId: user.id, projectId, action: "approve", entity: "PriceList", entityId: list.id, changes: { name, total: data.priced!.total.toString(), units: priced.length } });
    return list.id;
  });
}

export async function getPriceListVersion(projectId: string, priceListId: string) {
  const { role } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "pricing.view")) throw new ActionError("Fiyat listesi sürümlerini görme yetkiniz yok.");
  return db.priceList.findFirst({
    where: { id: priceListId, projectId },
    include: { approvedBy: { select: { name: true } }, lines: { include: { unit: { include: { block: { select: { name: true } } } } } } },
  });
}

/** Portföy / panel: onaylı liste toplamı (müteahhit bölümleri) ve kilitli bölüm sayısı. */
export async function listTotals(projectIds: string[]) {
  await getAccess();
  const rows = await db.unit.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, owner: "CONTRACTOR" }, _sum: { listPrice: true }, _count: { listPrice: true } });
  return new Map(rows.map((r) => [r.projectId, { total: dec(r._sum.listPrice), priced: r._count.listPrice }]));
}

export const USAGE_ORDER: readonly UsageType[] = ["RESIDENTIAL", "SHOP", "OFFICE", "STORAGE"];

/** Fiyat listesi çıktısı (Excel / yazdırma): taslak = canlı hesap (maliyet yetkisi gerekir), değilse onaylı liste. */
export async function getPriceListExport(projectId: string, draft: boolean) {
  const { role } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "priceList.view")) throw new ActionError("Fiyat listesini görme yetkiniz yok.");
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });
  type Row = { unit: UnitRow; price: Decimal | null; vatRate: Decimal | null; priceWithVat: Decimal | null; perM2: Decimal | null };
  let rows: Row[];
  let subtitle: string;
  if (draft) {
    if (!hasCapability(role, "pricing.view")) throw new ActionError("Taslak fiyatları görme yetkiniz yok.");
    const data = await computePricing(projectId);
    rows = data.rows;
    subtitle = `Taslak (onaylanmamış) · ${new Date().toLocaleDateString("tr-TR")}`;
  } else {
    const data = await getApprovedList(projectId);
    if (!data.list) throw new ActionError("Onaylı fiyat listesi yok.");
    rows = data.rows;
    subtitle = `${data.list.name} · onay ${data.list.approvedAt.toLocaleDateString("tr-TR")}`;
  }
  const contractor = rows.filter((r) => r.unit.owner === "CONTRACTOR");
  return {
    projectName: project.name,
    subtitle,
    contractor,
    landowner: rows.filter((r) => r.unit.owner === "LANDOWNER"),
    total: contractor.reduce((s, r) => s.plus(r.price ?? 0), zero()),
    totalWithVat: contractor.reduce((s, r) => s.plus(r.priceWithVat ?? 0), zero()),
  };
}
