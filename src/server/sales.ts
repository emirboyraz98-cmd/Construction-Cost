import "server-only";
import Decimal from "decimal.js";
import type { ChequeStatus, Currency, InstallmentKind, PaymentMethod } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { allocateCollections, contractAmounts, isCounted, planTotal, reservationActive, unitSaleStatus, type UnitSaleStatus } from "@/lib/sales/sales";
import { ActionError, getAccess, requireProjectAccess, requireProjectCapability } from "./access";
import { diffFields, writeAudit } from "./audit";
import { db, type Tx } from "./db";

// Satış ve tahsilat (PLAN.md Bölüm 10, Faz 6): müşteri, rezervasyon, satış sözleşmesi, ödeme planı,
// tahsilat, çek / senet, gecikme uyarıları ve teslim takibi.

const zero = () => new Decimal(0);
const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
};

async function requireView(projectId: string) {
  const access = await requireProjectAccess(projectId);
  if (!hasCapability(access.role, "sales.view")) throw new ActionError("Satışları görme yetkiniz yok.");
  return access;
}

const unitInclude = { block: { select: { id: true, name: true, sortOrder: true } }, landowner: { select: { name: true } } } as const;

type CollectionLike = { amount: { toString(): string }; amountTry: { toString(): string }; method: PaymentMethod; chequeStatus: ChequeStatus | null };

/** Sözleşmenin tahsilat durumu (sözleşme para biriminde dağıtım; TL özetler). */
function contractStatus(
  contract: { currency: Currency; exchangeRate: { toString(): string }; totalAmount: { toString(): string } },
  installments: { id: string; dueDate: Date; amount: { toString(): string }; kind: InstallmentKind; note: string | null }[],
  collections: CollectionLike[],
  today: Date,
) {
  const counted = collections.filter(isCounted);
  const collected = counted.reduce((s, c) => s.plus(dec(c.amount)), zero());
  const pending = collections.filter((c) => c.chequeStatus === "PENDING");
  const alloc = allocateCollections(
    installments.map((i) => ({ ...i, amount: dec(i.amount) })),
    collected,
    today,
    pending.reduce((s, c) => s.plus(dec(c.amount)), zero()),
  );
  const rate = dec(contract.exchangeRate);
  return {
    ...alloc,
    collectedTry: counted.reduce((s, c) => s.plus(dec(c.amountTry)), zero()),
    /** Dövizli sözleşmede kalan / geciken TL tahmini sözleşme kuruyla */
    remainingTry: alloc.remaining.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    overdueTry: alloc.overdue.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    pendingCheques: pending.reduce((s, c) => s.plus(dec(c.amount)), zero()),
    planMismatch: !planTotal(installments.map((i) => ({ amount: dec(i.amount) }))).eq(dec(contract.totalAmount)),
  };
}

// ---------------------------------------------------------------------------
// Genel bakış
// ---------------------------------------------------------------------------

export async function getSalesOverview(projectId: string) {
  const { role } = await requireView(projectId);
  const today = todayUtc();
  const [units, contracts, reservations, latestList] = await Promise.all([
    db.unit.findMany({ where: { projectId }, include: unitInclude }),
    db.saleContract.findMany({
      where: { projectId, status: "ACTIVE" },
      include: { customer: { select: { id: true, name: true, phone: true } }, installments: true, collections: true },
    }),
    db.reservation.findMany({ where: { projectId, status: "ACTIVE" }, include: { customer: { select: { id: true, name: true, phone: true } } }, orderBy: { expiresAt: "asc" } }),
    db.priceList.findFirst({ where: { projectId }, orderBy: { approvedAt: "desc" }, select: { targetRevenue: true, name: true } }),
  ]);
  units.sort(
    (a, b) =>
      a.block.sortOrder - b.block.sortOrder || a.block.name.localeCompare(b.block.name, "tr") || a.floor - b.floor || a.doorNo.localeCompare(b.doorNo, "tr", { numeric: true }),
  );
  const contractByUnit = new Map(contracts.map((c) => [c.unitId, c]));
  const activeReservations = reservations.filter((r) => reservationActive(r, today));
  const expiredReservations = reservations.filter((r) => !reservationActive(r, today));
  const reservationByUnit = new Map(activeReservations.map((r) => [r.unitId, r]));

  const rows = units.map((u) => {
    const contract = contractByUnit.get(u.id) ?? null;
    const reservation = reservationByUnit.get(u.id) ?? null;
    const status = unitSaleStatus({ owner: u.owner, hasActiveContract: Boolean(contract), hasActiveReservation: Boolean(reservation) });
    return {
      unit: u,
      status,
      contract: contract ? { ...contract, state: contractStatus(contract, contract.installments, contract.collections, today) } : null,
      reservation,
    };
  });

  const count = (s: UnitSaleStatus) => rows.filter((r) => r.status === s).length;
  const sold = rows.filter((r) => r.contract);
  const sum = (values: Decimal[]) => values.reduce((s, v) => s.plus(v), zero());
  const soldNetTry = sum(sold.map((r) => dec(r.contract!.salePriceTry)));
  const unsoldList = sum(rows.filter((r) => r.unit.owner === "CONTRACTOR" && !r.contract).map((r) => dec(r.unit.listPrice)));
  return {
    canManage: hasCapability(role, "sales.manage"),
    canCollect: hasCapability(role, "collection.manage"),
    rows,
    activeReservations,
    expiredReservations,
    summary: {
      available: count("AVAILABLE"),
      reserved: count("RESERVED"),
      sold: count("SOLD"),
      landowner: count("LANDOWNER"),
      soldNetTry,
      soldTotalTry: sum(sold.map((r) => dec(r.contract!.totalAmount).times(dec(r.contract!.exchangeRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP))),
      collectedTry: sum(sold.map((r) => r.contract!.state.collectedTry)),
      remainingTry: sum(sold.map((r) => r.contract!.state.remainingTry)),
      overdueTry: sum(sold.map((r) => r.contract!.state.overdueTry)),
      unsoldList,
      /** Satılan (gerçek fiyat) + satılmayan (liste fiyatı) ↔ onaylı listenin hedef geliri */
      expectedRevenue: soldNetTry.plus(unsoldList),
      targetRevenue: latestList ? dec(latestList.targetRevenue) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Müşteriler
// ---------------------------------------------------------------------------

export async function listCustomers(projectId: string) {
  const { role } = await requireView(projectId);
  const customers = await db.customer.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: { contracts: { where: { status: "ACTIVE" }, select: { id: true, unit: { select: { doorNo: true, block: { select: { name: true } } } } } }, _count: { select: { reservations: true, contracts: true } } },
  });
  return { customers, canManage: hasCapability(role, "sales.manage") };
}

export type CustomerData = { name: string; identityNo: string | null; taxOffice: string | null; phone: string | null; email: string | null; address: string | null; notes: string | null };

export async function saveCustomer(projectId: string, customerId: string | null, data: CustomerData) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  return db.$transaction(async (tx) => {
    if (customerId) {
      const before = await tx.customer.findFirstOrThrow({ where: { id: customerId, projectId } });
      await tx.customer.update({ where: { id: customerId }, data });
      await writeAudit(tx, { userId: user.id, projectId, action: "update", entity: "Customer", entityId: customerId, changes: diffFields(before, data) });
      return customerId;
    }
    const created = await tx.customer.create({ data: { projectId, ...data } });
    await writeAudit(tx, { userId: user.id, projectId, action: "create", entity: "Customer", entityId: created.id, changes: { name: data.name } });
    return created.id;
  });
}

export async function deleteCustomer(projectId: string, customerId: string) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  const c = await db.customer.findFirstOrThrow({ where: { id: customerId, projectId }, include: { _count: { select: { reservations: true, contracts: true } } } });
  if (c._count.contracts || c._count.reservations) throw new ActionError("Sözleşmesi veya rezervasyonu olan müşteri silinemez.");
  await db.$transaction(async (tx) => {
    await tx.customer.delete({ where: { id: customerId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "Customer", entityId: customerId, changes: { name: c.name } });
  });
}

// ---------------------------------------------------------------------------
// Rezervasyon
// ---------------------------------------------------------------------------

async function assertSellable(tx: Tx, projectId: string, unitId: string, ignoreReservationOf?: string) {
  const unit = await tx.unit.findFirst({ where: { id: unitId, projectId } });
  if (!unit) throw new ActionError("Bölüm bu projede yok.");
  if (unit.owner !== "CONTRACTOR") throw new ActionError("Arsa sahibi bölümü satılamaz.");
  if (await tx.saleContract.count({ where: { unitId, status: "ACTIVE" } })) throw new ActionError("Bu bölüm satılmış.");
  const reservations = await tx.reservation.findMany({ where: { unitId, status: "ACTIVE" } });
  const active = reservations.find((r) => reservationActive(r, todayUtc()));
  if (active && active.customerId !== ignoreReservationOf) throw new ActionError("Bu bölümde başka bir müşterinin geçerli rezervasyonu var.");
  return unit;
}

export type ReservationData = { unitId: string; customerId: string; startDate: Date; expiresAt: Date; deposit: Decimal | null; quotedPrice: Decimal | null; note: string | null };

export async function createReservation(projectId: string, data: ReservationData) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  if (data.expiresAt < data.startDate) throw new ActionError("Bitiş tarihi başlangıçtan önce olamaz.");
  return db.$transaction(async (tx) => {
    const unit = await assertSellable(tx, projectId, data.unitId);
    if (!(await tx.customer.count({ where: { id: data.customerId, projectId } }))) throw new ActionError("Müşteri bu projede yok.");
    // Süresi dolmuş eski rezervasyonlar kapatılır.
    await tx.reservation.updateMany({ where: { unitId: data.unitId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
    const r = await tx.reservation.create({ data: { projectId, ...data, createdById: user.id } });
    await writeAudit(tx, { userId: user.id, projectId, action: "create", entity: "Reservation", entityId: r.id, changes: { doorNo: unit.doorNo, expiresAt: data.expiresAt.toISOString().slice(0, 10) } });
    return r.id;
  });
}

export async function cancelReservation(projectId: string, reservationId: string) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  await db.$transaction(async (tx) => {
    const r = await tx.reservation.update({ where: { id: reservationId, projectId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
    await writeAudit(tx, { userId: user.id, projectId, action: "cancel", entity: "Reservation", entityId: r.id });
  });
}

// ---------------------------------------------------------------------------
// Satış sözleşmesi
// ---------------------------------------------------------------------------

/** Satış formu: satılabilir bölümler, müşteriler ve öneriler. */
export async function getSaleForm(projectId: string) {
  await requireProjectCapability(projectId, "sales.manage");
  const today = todayUtc();
  const [units, customers, contracts, reservations, setting] = await Promise.all([
    db.unit.findMany({ where: { projectId, owner: "CONTRACTOR" }, include: unitInclude }),
    db.customer.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    db.saleContract.findMany({ where: { projectId, status: "ACTIVE" }, select: { unitId: true } }),
    db.reservation.findMany({ where: { projectId, status: "ACTIVE" } }),
    db.pricingSetting.findUnique({ where: { projectId }, select: { commissionPercent: true } }),
  ]);
  const sold = new Set(contracts.map((c) => c.unitId));
  units.sort((a, b) => a.block.sortOrder - b.block.sortOrder || a.floor - b.floor || a.doorNo.localeCompare(b.doorNo, "tr", { numeric: true }));
  return {
    units: units
      .filter((u) => !sold.has(u.id))
      .map((u) => ({ unit: u, reservation: reservations.find((r) => r.unitId === u.id && reservationActive(r, today)) ?? null })),
    customers,
    commissionPercent: setting ? dec(setting.commissionPercent) : zero(),
  };
}

export type InstallmentInput = { dueDate: Date; amount: Decimal; kind: InstallmentKind; note: string | null };

export type SaleData = {
  unitId: string;
  customerId: string;
  contractNo: string | null;
  date: Date;
  currency: Currency;
  exchangeRate: Decimal;
  listPrice: Decimal;
  discount: Decimal;
  vatRate: Decimal;
  agent: string | null;
  commissionAmount: Decimal | null;
  notes: string | null;
  installments: InstallmentInput[];
};

function checkPlan(total: Decimal, installments: InstallmentInput[]) {
  if (installments.length === 0) throw new ActionError("Ödeme planı boş; en az bir satır girin.");
  const sum = planTotal(installments);
  if (!sum.eq(total)) throw new ActionError(`Ödeme planı toplamı (${sum.toFixed(2)}) satış tutarına (KDV dahil ${total.toFixed(2)}) eşit olmalı.`);
}

export async function createSale(projectId: string, data: SaleData) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  const amounts = contractAmounts({ listPrice: data.listPrice, discount: data.discount, vatRate: data.vatRate });
  if (amounts.salePrice.lte(0)) throw new ActionError("Satış fiyatı sıfırdan büyük olmalı.");
  checkPlan(amounts.totalAmount, data.installments);
  const rate = data.currency === "TRY" ? new Decimal(1) : data.exchangeRate;
  return db.$transaction(async (tx) => {
    const unit = await assertSellable(tx, projectId, data.unitId, data.customerId);
    if (!(await tx.customer.count({ where: { id: data.customerId, projectId } }))) throw new ActionError("Müşteri bu projede yok.");
    const { installments, ...rest } = data;
    const contract = await tx.saleContract.create({
      data: {
        projectId,
        ...rest,
        exchangeRate: rate,
        ...amounts,
        salePriceTry: amounts.salePrice.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        createdById: user.id,
        installments: { create: installments.map((i, index) => ({ ...i, sortOrder: index })) },
      },
    });
    // Satılan bölümün fiyatı kilitlenir (PLAN 7.6); rezervasyon satışa dönüşür.
    await tx.unit.update({ where: { id: unit.id }, data: { priceLocked: true } });
    await tx.reservation.updateMany({ where: { unitId: unit.id, status: "ACTIVE" }, data: { status: "CONVERTED" } });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: "create",
      entity: "SaleContract",
      entityId: contract.id,
      changes: { doorNo: unit.doorNo, salePrice: amounts.salePrice.toString(), currency: data.currency, installments: installments.length },
    });
    return contract.id;
  });
}

export async function getContract(projectId: string, contractId: string) {
  const { role } = await requireView(projectId);
  const contract = await db.saleContract.findFirst({
    where: { id: contractId, projectId },
    include: {
      unit: { include: unitInclude },
      customer: true,
      installments: { orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }] },
      collections: { orderBy: { date: "desc" }, include: { createdBy: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
  });
  if (!contract) return null;
  return {
    contract,
    state: contractStatus(contract, contract.installments, contract.collections, todayUtc()),
    canManage: hasCapability(role, "sales.manage") && contract.status === "ACTIVE",
    canCollect: hasCapability(role, "collection.manage") && contract.status === "ACTIVE",
  };
}

/** Ödeme planını değiştirir (toplam satış tutarına eşit kalmalı); tahsilatlar yeniden dağıtılır. */
export async function updatePlan(projectId: string, contractId: string, installments: InstallmentInput[]) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  const contract = await db.saleContract.findFirstOrThrow({ where: { id: contractId, projectId, status: "ACTIVE" } });
  checkPlan(dec(contract.totalAmount), installments);
  await db.$transaction(async (tx) => {
    await tx.installment.deleteMany({ where: { contractId } });
    await tx.installment.createMany({ data: installments.map((i, index) => ({ contractId, ...i, sortOrder: index })) });
    await writeAudit(tx, { userId: user.id, projectId, action: "plan", entity: "SaleContract", entityId: contractId, changes: { installments: installments.length } });
  });
}

export async function updateContractInfo(projectId: string, contractId: string, data: { contractNo: string | null; agent: string | null; commissionAmount: Decimal | null; notes: string | null }) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.saleContract.findFirstOrThrow({ where: { id: contractId, projectId } });
    await tx.saleContract.update({ where: { id: contractId }, data });
    await writeAudit(tx, { userId: user.id, projectId, action: "update", entity: "SaleContract", entityId: contractId, changes: diffFields(before, data) });
  });
}

/** Satış iptali: bölüm yeniden satışa açılır ve fiyat kilidi kalkar; tahsilatlar kayıtta kalır (iade ayrıca izlenir). */
export async function cancelContract(projectId: string, contractId: string, reason: string) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  await db.$transaction(async (tx) => {
    const c = await tx.saleContract.update({ where: { id: contractId, projectId, status: "ACTIVE" }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    await tx.unit.update({ where: { id: c.unitId }, data: { priceLocked: false } });
    await writeAudit(tx, { userId: user.id, projectId, action: "cancel", entity: "SaleContract", entityId: contractId, changes: { reason } });
  });
}

export async function setHandover(projectId: string, unitId: string, date: Date | null) {
  const { user } = await requireProjectCapability(projectId, "sales.manage");
  await db.$transaction(async (tx) => {
    const unit = await tx.unit.update({ where: { id: unitId, projectId }, data: { handoverDate: date } });
    await writeAudit(tx, { userId: user.id, projectId, action: "handover", entity: "Unit", entityId: unitId, changes: { doorNo: unit.doorNo, handoverDate: date?.toISOString().slice(0, 10) ?? null } });
  });
}

// ---------------------------------------------------------------------------
// Tahsilat
// ---------------------------------------------------------------------------

export type CollectionData = {
  date: Date;
  amount: Decimal;
  exchangeRate: Decimal;
  method: PaymentMethod;
  documentNo: string | null;
  chequeDueDate: Date | null;
  bank: string | null;
  note: string | null;
};

export async function addCollection(projectId: string, contractId: string, data: CollectionData) {
  const { user } = await requireProjectCapability(projectId, "collection.manage");
  const contract = await db.saleContract.findFirstOrThrow({ where: { id: contractId, projectId, status: "ACTIVE" } });
  const rate = contract.currency === "TRY" ? new Decimal(1) : data.exchangeRate;
  const isPaper = data.method === "CHEQUE" || data.method === "PROMISSORY_NOTE";
  return db.$transaction(async (tx) => {
    const c = await tx.collection.create({
      data: {
        contractId,
        ...data,
        exchangeRate: rate,
        amountTry: data.amount.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        chequeStatus: isPaper ? "PENDING" : null,
        chequeDueDate: isPaper ? data.chequeDueDate : null,
        createdById: user.id,
      },
    });
    await writeAudit(tx, { userId: user.id, projectId, action: "create", entity: "Collection", entityId: c.id, changes: { amount: data.amount.toString(), method: data.method } });
    return c.id;
  });
}

export async function setChequeStatus(projectId: string, collectionId: string, status: ChequeStatus) {
  const { user } = await requireProjectCapability(projectId, "collection.manage");
  await db.$transaction(async (tx) => {
    const c = await tx.collection.findFirstOrThrow({ where: { id: collectionId, contract: { projectId } } });
    if (!c.chequeStatus) throw new ActionError("Bu tahsilat çek / senet değil.");
    await tx.collection.update({ where: { id: collectionId }, data: { chequeStatus: status } });
    await writeAudit(tx, { userId: user.id, projectId, action: "cheque", entity: "Collection", entityId: collectionId, changes: { status } });
  });
}

export async function deleteCollection(projectId: string, collectionId: string) {
  const { user } = await requireProjectCapability(projectId, "collection.manage");
  await db.$transaction(async (tx) => {
    const c = await tx.collection.findFirstOrThrow({ where: { id: collectionId, contract: { projectId } } });
    await tx.collection.delete({ where: { id: collectionId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "Collection", entityId: collectionId, changes: { amount: c.amount.toString(), date: c.date.toISOString().slice(0, 10) } });
  });
}

/** Tahsilatlar ekranı: geciken, yaklaşan (30 gün), portföydeki çek / senet ve son tahsilatlar. */
export async function getCollections(projectId: string) {
  const { role } = await requireView(projectId);
  const today = todayUtc();
  const contracts = await db.saleContract.findMany({
    where: { projectId, status: "ACTIVE" },
    include: { unit: { include: unitInclude }, customer: { select: { id: true, name: true, phone: true } }, installments: true, collections: { orderBy: { date: "desc" } } },
  });
  const horizon = new Date(today.getTime() + 30 * 86_400_000);
  const items = contracts.flatMap((c) => {
    const state = contractStatus(c, c.installments, c.collections, today);
    return state.rows.filter((r) => r.remaining.gt(0) && r.state !== "PAPER").map((r) => ({ contract: c, installment: r }));
  });
  const overdue = items.filter((i) => i.installment.state === "OVERDUE").sort((a, b) => a.installment.dueDate.getTime() - b.installment.dueDate.getTime());
  const upcoming = items
    .filter((i) => i.installment.state !== "OVERDUE" && i.installment.dueDate <= horizon)
    .sort((a, b) => a.installment.dueDate.getTime() - b.installment.dueDate.getTime());
  const cheques = contracts
    .flatMap((c) => c.collections.filter((x) => x.chequeStatus === "PENDING").map((x) => ({ contract: c, collection: x })))
    .sort((a, b) => (a.collection.chequeDueDate?.getTime() ?? 0) - (b.collection.chequeDueDate?.getTime() ?? 0));
  const recent = contracts
    .flatMap((c) => c.collections.map((x) => ({ contract: c, collection: x })))
    .sort((a, b) => b.collection.date.getTime() - a.collection.date.getTime() || b.collection.createdAt.getTime() - a.collection.createdAt.getTime())
    .slice(0, 30);
  const states = contracts.map((c) => contractStatus(c, c.installments, c.collections, today));
  const sum = (values: Decimal[]) => values.reduce((s, v) => s.plus(v), zero());
  return {
    canCollect: hasCapability(role, "collection.manage"),
    overdue,
    upcoming,
    cheques,
    recent,
    summary: {
      contracts: contracts.length,
      collectedTry: sum(states.map((s) => s.collectedTry)),
      remainingTry: sum(states.map((s) => s.remainingTry)),
      overdueTry: sum(states.map((s) => s.overdueTry)),
      upcomingTry: sum(upcoming.map((i) => i.installment.remaining.times(dec(i.contract.exchangeRate)))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      chequesTry: sum(cheques.map((c) => dec(c.collection.amountTry))),
    },
  };
}

/** Portföy ve proje kartları: satış ve tahsilat özeti (yetkisi olan projeler). */
export async function salesSummaries(projectIds: string[]) {
  await getAccess();
  const today = todayUtc();
  const [contracts, unitCounts] = await Promise.all([
    db.saleContract.findMany({ where: { projectId: { in: projectIds }, status: "ACTIVE" }, include: { installments: true, collections: true } }),
    db.unit.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, owner: "CONTRACTOR" }, _count: { _all: true } }),
  ]);
  const result = new Map<string, { sold: number; contractorUnits: number; salesTry: Decimal; collectedTry: Decimal; remainingTry: Decimal; overdueTry: Decimal; overdueCount: number }>();
  for (const id of projectIds) {
    result.set(id, { sold: 0, contractorUnits: unitCounts.find((u) => u.projectId === id)?._count._all ?? 0, salesTry: zero(), collectedTry: zero(), remainingTry: zero(), overdueTry: zero(), overdueCount: 0 });
  }
  for (const c of contracts) {
    const r = result.get(c.projectId)!;
    const s = contractStatus(c, c.installments, c.collections, today);
    r.sold++;
    r.salesTry = r.salesTry.plus(dec(c.totalAmount).times(dec(c.exchangeRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    r.collectedTry = r.collectedTry.plus(s.collectedTry);
    r.remainingTry = r.remainingTry.plus(s.remainingTry);
    r.overdueTry = r.overdueTry.plus(s.overdueTry);
    r.overdueCount += s.rows.filter((x) => x.state === "OVERDUE").length;
  }
  return result;
}

/** Excel: tüm aktif sözleşmelerin taksitleri (dağıtımlı) ve tahsilatları. */
export async function getCollectionsExport(projectId: string) {
  await requireView(projectId);
  const today = todayUtc();
  const contracts = await db.saleContract.findMany({
    where: { projectId, status: "ACTIVE" },
    include: { unit: { include: unitInclude }, customer: { select: { name: true, phone: true } }, installments: true, collections: { orderBy: { date: "asc" } } },
  });
  return {
    installments: contracts
      .flatMap((c) => contractStatus(c, c.installments, c.collections, today).rows.map((installment) => ({ contract: c, installment })))
      .sort((a, b) => a.installment.dueDate.getTime() - b.installment.dueDate.getTime()),
    collections: contracts.flatMap((c) => c.collections.map((collection) => ({ contract: c, collection }))).sort((a, b) => a.collection.date.getTime() - b.collection.date.getTime()),
  };
}
