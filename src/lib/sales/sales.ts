// Satış ve tahsilat (PLAN.md Bölüm 10; saf modül): sözleşme tutarları, ödeme planı, tahsilatların
// taksitlere dağıtımı, gecikme durumu, rezervasyon süresi ve bölüm satış durumu.
import Decimal from "decimal.js";
import type { ChequeStatus, InstallmentKind, PaymentMethod } from "@/generated/prisma/enums";
import { roundMoney } from "../expenses/amounts";

const zero = () => new Decimal(0);
const DAY = 86_400_000;

/** Satış fiyatı = liste − indirim; KDV ve toplam kuruşa yuvarlanır. */
export function contractAmounts(input: { listPrice: Decimal; discount: Decimal; vatRate: Decimal }) {
  const salePrice = roundMoney(input.listPrice.minus(input.discount));
  const vatAmount = roundMoney(salePrice.times(input.vatRate).div(100));
  return { salePrice, vatAmount, totalAmount: salePrice.plus(vatAmount) };
}

/** Ay ekler; ayın son günlerinde ay sonuna sabitler (31 Ocak + 1 ay = 28/29 Şubat). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), last)));
}

export type PlanRow = { dueDate: Date; amount: Decimal; kind: InstallmentKind; note: string | null };

export type PlanSpec = {
  /** KDV dahil toplam */
  total: Decimal;
  downPayment: { amount: Decimal; date: Date } | null;
  /** Ara ödemeler, anahtar teslim ve banka kredisi gibi sabit tutarlı satırlar */
  fixed: PlanRow[];
  /** Kalan tutar eşit taksitlere bölünür (son taksit kuruş farkını alır) */
  installments: { count: number; firstDate: Date; intervalMonths: number } | null;
};

/** Ödeme planı üretir; peşinat ve sabit satırlardan kalanı eşit taksitlere böler. */
export function buildPlan(spec: PlanSpec): { rows: PlanRow[]; error: string | null } {
  const rows: PlanRow[] = [];
  if (spec.downPayment && spec.downPayment.amount.gt(0)) rows.push({ dueDate: spec.downPayment.date, amount: roundMoney(spec.downPayment.amount), kind: "DOWN_PAYMENT", note: null });
  for (const f of spec.fixed) if (f.amount.gt(0)) rows.push({ ...f, amount: roundMoney(f.amount) });
  const assigned = rows.reduce((s, r) => s.plus(r.amount), zero());
  const rest = spec.total.minus(assigned);
  if (rest.isNegative()) return { rows, error: "Peşinat ve sabit ödemeler toplamı satış tutarını aşıyor." };
  const inst = spec.installments;
  if (rest.gt(0)) {
    if (!inst || inst.count < 1) return { rows, error: "Kalan tutar için taksit sayısı girin." };
    const each = rest.div(inst.count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    for (let i = 0; i < inst.count; i++) {
      const amount = i === inst.count - 1 ? rest.minus(each.times(inst.count - 1)) : each;
      rows.push({ dueDate: addMonths(inst.firstDate, i * inst.intervalMonths), amount, kind: "INSTALLMENT", note: `${i + 1}/${inst.count}. taksit` });
    }
  }
  rows.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return { rows, error: null };
}

export const planTotal = (rows: readonly { amount: Decimal }[]) => rows.reduce((s, r) => s.plus(r.amount), zero());

/** Tahsilat sayılır mı: çek / senet yalnızca tahsil edilince; karşılıksız hiç sayılmaz. */
export function isCounted(c: { method: PaymentMethod; chequeStatus: ChequeStatus | null }): boolean {
  if (c.chequeStatus === "BOUNCED") return false;
  if (c.method === "CHEQUE" || c.method === "PROMISSORY_NOTE") return c.chequeStatus === "CLEARED";
  return true;
}

export type InstallmentState = "PAID" | "PAPER" | "PARTIAL" | "OVERDUE" | "DUE_SOON" | "UPCOMING";

export const DUE_SOON_DAYS = 7;

export type AllocatedInstallment<T> = T & {
  paid: Decimal;
  remaining: Decimal;
  /** Kalanın portföydeki (tahsil edilmemiş) çek / senetle karşılanan kısmı */
  paper: Decimal;
  state: InstallmentState;
  daysOverdue: number;
};

/**
 * Tahsilatlar vade sırasına göre taksitlere dağıtılır (kısmi ödeme desteklenir). Ardından portföydeki
 * çek / senetler kalan kısma dağıtılır: tamamı çekle karşılanan taksit gecikmiş sayılmaz ama kalan
 * alacak çek tahsil edilene kadar düşmez. Gecikme: vadesi geçmiş ve karşılanmamış kısım;
 * yaklaşan: 7 gün içinde vadesi gelen.
 */
export function allocateCollections<T extends { dueDate: Date; amount: Decimal }>(
  installments: readonly T[],
  collectedTotal: Decimal,
  today: Date,
  paperTotal: Decimal = new Decimal(0),
): { rows: AllocatedInstallment<T>[]; total: Decimal; collected: Decimal; remaining: Decimal; overdue: Decimal; overpaid: Decimal; nextDue: AllocatedInstallment<T> | null } {
  const sorted = [...installments].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  let pool = collectedTotal;
  let paperPool = paperTotal;
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const rows = sorted.map((inst) => {
    const paid = Decimal.min(pool, inst.amount);
    pool = pool.minus(paid);
    const remaining = inst.amount.minus(paid);
    const paper = Decimal.min(paperPool, remaining);
    paperPool = paperPool.minus(paper);
    const open = remaining.minus(paper);
    const diff = Math.round((todayMs - inst.dueDate.getTime()) / DAY);
    let state: InstallmentState;
    if (remaining.lte(0)) state = "PAID";
    else if (open.lte(0)) state = "PAPER";
    else if (diff > 0) state = "OVERDUE";
    else if (-diff <= DUE_SOON_DAYS) state = "DUE_SOON";
    else state = paid.gt(0) ? "PARTIAL" : "UPCOMING";
    return { ...inst, paid, remaining, paper, state, daysOverdue: state === "OVERDUE" ? diff : 0 };
  });
  const total = planTotal(sorted);
  return {
    rows,
    total,
    collected: collectedTotal,
    remaining: Decimal.max(total.minus(collectedTotal), 0),
    overdue: rows.filter((r) => r.state === "OVERDUE").reduce((s, r) => s.plus(r.remaining.minus(r.paper)), zero()),
    overpaid: Decimal.max(collectedTotal.minus(total), 0),
    nextDue: rows.find((r) => r.remaining.gt(0)) ?? null,
  };
}

/** Rezervasyon bugün geçerli mi (bitiş günü dahil). */
export function reservationActive(r: { status: string; expiresAt: Date }, today: Date): boolean {
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return r.status === "ACTIVE" && r.expiresAt.getTime() >= todayMs;
}

export type UnitSaleStatus = "LANDOWNER" | "SOLD" | "RESERVED" | "AVAILABLE";

export function unitSaleStatus(input: { owner: "CONTRACTOR" | "LANDOWNER"; hasActiveContract: boolean; hasActiveReservation: boolean }): UnitSaleStatus {
  if (input.owner === "LANDOWNER") return "LANDOWNER";
  if (input.hasActiveContract) return "SOLD";
  if (input.hasActiveReservation) return "RESERVED";
  return "AVAILABLE";
}
