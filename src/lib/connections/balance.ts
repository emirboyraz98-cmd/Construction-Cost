// Bağlantı bakiyesi, proje tahsisi ve çekiş kontrolleri (PLAN.md 9.3–9.5; saf modül).
// Değişmezler: toplam = çekilen + kalan; tahsislerin toplamı kalem miktarını aşmaz;
// bir projenin çekişi o projenin tahsisini aşmaz (gerekirse havuzdan otomatik tahsis edilir).
import Decimal from "decimal.js";
import type { ApprovalStatus } from "@/generated/prisma/enums";
import { formatNumber } from "../format";

const zero = () => new Decimal(0);

export type AllocationRow = { projectId: string; quantity: Decimal };
/** Reddedilen ve silinen çekişler çağıran tarafından dışarıda bırakılır. */
export type DrawRow = { projectId: string; quantity: Decimal; approvalStatus: ApprovalStatus };

export type ProjectBalance = {
  projectId: string;
  allocated: Decimal;
  drawn: Decimal;
  /** Bu projeye ayrılıp henüz çekilmemiş miktar */
  remaining: Decimal;
};

export type ItemBalance = {
  total: Decimal;
  allocated: Decimal;
  /** Atanmamış – şirket geneli havuz */
  pool: Decimal;
  /** Onaylı + onay bekleyen çekişler (bakiye hesabında ikisi de düşülür) */
  drawn: Decimal;
  drawnApproved: Decimal;
  /** Bağlantıda kalan (çekilmemiş) miktar */
  remaining: Decimal;
  byProject: ProjectBalance[];
};

export function itemBalance(total: Decimal, allocations: readonly AllocationRow[], draws: readonly DrawRow[]): ItemBalance {
  const projects = new Map<string, ProjectBalance>();
  const get = (projectId: string) =>
    projects.get(projectId) ??
    projects.set(projectId, { projectId, allocated: zero(), drawn: zero(), remaining: zero() }).get(projectId)!;
  for (const a of allocations) get(a.projectId).allocated = get(a.projectId).allocated.plus(a.quantity);
  let drawn = zero();
  let drawnApproved = zero();
  for (const d of draws) {
    get(d.projectId).drawn = get(d.projectId).drawn.plus(d.quantity);
    drawn = drawn.plus(d.quantity);
    if (d.approvalStatus === "APPROVED") drawnApproved = drawnApproved.plus(d.quantity);
  }
  const byProject = [...projects.values()].map((p) => ({ ...p, remaining: p.allocated.minus(p.drawn) }));
  const allocated = byProject.reduce((sum, p) => sum.plus(p.allocated), zero());
  return {
    total,
    allocated,
    pool: total.minus(allocated),
    drawn,
    drawnApproved,
    remaining: total.minus(drawn),
    byProject,
  };
}

const qty = (value: Decimal, unit: string) => `${formatNumber(value, 4)} ${unit}`;

/**
 * Yeni tahsis listesini denetler: negatif olamaz, toplam kalem miktarını aşamaz, bir projenin
 * tahsisi o projeye yapılmış çekişin altına inemez. Hata yoksa boş dizi döner.
 */
export function validateAllocations(
  total: Decimal,
  unit: string,
  next: readonly AllocationRow[],
  drawnByProject: ReadonlyMap<string, Decimal>,
  projectName: (id: string) => string = (id) => id,
): string[] {
  const errors: string[] = [];
  let sum = zero();
  const seen = new Set<string>();
  for (const row of next) {
    if (seen.has(row.projectId)) errors.push(`${projectName(row.projectId)} iki kez yazılmış.`);
    seen.add(row.projectId);
    if (row.quantity.isNegative()) errors.push(`${projectName(row.projectId)}: miktar negatif olamaz.`);
    const drawn = drawnByProject.get(row.projectId) ?? zero();
    if (row.quantity.lt(drawn)) {
      errors.push(`${projectName(row.projectId)}: tahsis, bu projeye çekilmiş ${qty(drawn, unit)} altına inemez.`);
    }
    sum = sum.plus(row.quantity);
  }
  for (const [projectId, drawn] of drawnByProject) {
    if (drawn.gt(0) && !seen.has(projectId)) {
      errors.push(`${projectName(projectId)}: bu projeye ${qty(drawn, unit)} çekilmiş; tahsisi kaldırılamaz.`);
    }
  }
  if (sum.gt(total)) errors.push(`Tahsislerin toplamı (${qty(sum, unit)}) bağlantı miktarını (${qty(total, unit)}) aşıyor.`);
  return errors;
}

export type DrawPlan = { ok: true; fromPool: Decimal } | { ok: false; error: string };

/**
 * Projeye çekiş yapılabilir mi? Önce projenin tahsisinden, yetmezse havuzdan düşülür
 * (`fromPool` kadar otomatik tahsis yapılır). Havuz da yetmezse hata.
 */
export function planDraw(balance: ItemBalance, projectId: string, quantity: Decimal, unit: string): DrawPlan {
  if (quantity.lte(0)) return { ok: false, error: "Miktar sıfırdan büyük olmalı." };
  const project = balance.byProject.find((p) => p.projectId === projectId);
  const projectRemaining = Decimal.max(project?.remaining ?? zero(), zero());
  if (quantity.lte(projectRemaining)) return { ok: true, fromPool: zero() };
  const need = quantity.minus(projectRemaining);
  if (need.lte(balance.pool)) return { ok: true, fromPool: need };
  const available = projectRemaining.plus(Decimal.max(balance.pool, zero()));
  return {
    ok: false,
    error: `Bağlantıda bu proje için çekilebilecek miktar ${qty(available, unit)}; ${qty(quantity, unit)} girilemez.`,
  };
}

/**
 * Avans bakiyesi = ödenen − teslim alınan malzeme değeri (KDV dahil, bağlantı para biriminde).
 * Pozitif: tedarikçide malzemesi alınmamış para var; negatif: teslim alınanın ödemesi bekliyor.
 */
export function advanceBalance(paid: Decimal, delivered: Decimal): Decimal {
  return paid.minus(delivered);
}
