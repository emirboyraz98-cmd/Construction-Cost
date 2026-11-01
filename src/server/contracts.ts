import "server-only";
import Decimal from "decimal.js";
import type { ContractStatus, PaymentMethod, Role } from "@/generated/prisma/enums";
import { projectRole } from "@/lib/auth/access";
import { hasCapability, type Capability } from "@/lib/auth/roles";
import { computeProgressBilling, contractProgress, progressCostRows } from "@/lib/contracts/progress";
import type { BillingData, ContractData } from "@/lib/validation/purchasing";
import { ActionError, getAccess } from "./access";
import { writeAudit } from "./audit";
import { db, type Tx } from "./db";
import { discardFiles, documentRows, removeOrphanFiles, storeFiles } from "./uploads";

// Taşeron sözleşmeleri ve hakedişler (PLAN.md 4.2, 8.2). Sözleşme projeye bağlıdır. Hakediş
// onaylanınca maliyet kalemi başına PROGRESS satırları oluşur; net ödeme hakediş kaydında izlenir.

const zero = () => new Decimal(0);
const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);

async function contractAccess(projectId: string, capability: Capability = "contract.view") {
  const access = await getAccess();
  const role = projectRole(access.scope, projectId);
  if (!role) throw new ActionError("Proje bulunamadı veya bu projeye erişiminiz yok.");
  if (!hasCapability(role, capability)) throw new ActionError("Bu işlem için yetkiniz yok.");
  return { ...access, role };
}

function permissions(role: Role) {
  return {
    amounts: hasCapability(role, "contract.viewAmounts"),
    manage: hasCapability(role, "contract.manage"),
    prepare: hasCapability(role, "progress.prepare"),
    approve: hasCapability(role, "progress.approve"),
    pay: hasCapability(role, "expense.manage"),
  };
}

/** Sözleşmeye bağlı ödenmiş avanslar ve onaylı hakedişlerde mahsup edilen avans. */
async function advanceState(contractId: string, exceptBillingId?: string) {
  const [advances, offsets] = await Promise.all([
    db.expense.findMany({
      where: { contractId, kind: "ADVANCE", deletedAt: null, approvalStatus: { not: "REJECTED" } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, totalAmountTry: true, paymentStatus: true, documentNo: true, description: true },
    }),
    db.progressBilling.aggregate({
      where: { contractId, status: "APPROVED", id: exceptBillingId ? { not: exceptBillingId } : undefined },
      _sum: { advanceOffset: true, retention: true },
    }),
  ]);
  const paid = advances.filter((a) => a.paymentStatus === "PAID").reduce((s, a) => s.plus(dec(a.totalAmountTry)), zero());
  const offset = dec(offsets._sum.advanceOffset);
  return { advances, paid, offset, open: paid.minus(offset), retention: dec(offsets._sum.retention) };
}

// ---------------------------------------------------------------------------
// Listeleme ve ayrıntı
// ---------------------------------------------------------------------------

export async function listContracts(projectId: string) {
  const { role } = await contractAccess(projectId);
  const perms = permissions(role);
  const contracts = await db.subcontractContract.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { date: "desc" }],
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { lines: { where: { billing: { status: "APPROVED" } }, select: { cumulativeQuantity: true, billing: { select: { seq: true } } } } } },
      billings: { orderBy: { seq: "desc" }, select: { id: true, seq: true, status: true, payableAmount: true, paymentStatus: true, date: true } },
    },
  });
  return {
    perms,
    rows: contracts.map((c) => {
      const progress = contractProgress(
        c.items.map((item) => {
          const last = item.lines.sort((a, b) => b.billing.seq - a.billing.seq)[0];
          return { quantity: dec(item.quantity), unitPrice: dec(item.unitPrice), doneQuantity: dec(last?.cumulativeQuantity) };
        }),
      );
      const open = c.billings.find((b) => b.status !== "APPROVED");
      const unpaid = c.billings
        .filter((b) => b.status === "APPROVED" && b.paymentStatus === "UNPAID")
        .reduce((s, b) => s.plus(dec(b.payableAmount)), zero());
      return {
        id: c.id,
        no: c.no,
        title: c.title,
        date: c.date,
        status: c.status,
        supplyMethod: c.supplyMethod,
        supplier: c.supplier,
        billingCount: c.billings.filter((b) => b.status === "APPROVED").length,
        openBilling: open ? { id: open.id, seq: open.seq, status: open.status } : null,
        percent: progress.percent,
        ...(perms.amounts ? { contractAmount: progress.contractAmount, doneAmount: progress.doneAmount, unpaid } : {}),
      };
    }),
  };
}

export async function getContract(projectId: string, contractId: string) {
  const { role } = await contractAccess(projectId);
  const perms = permissions(role);
  const contract = await db.subcontractContract.findFirst({
    where: { id: contractId, projectId },
    include: {
      supplier: { select: { id: true, name: true, taxNumber: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { costItem: { select: { code: true, name: true } } } },
      billings: { orderBy: { seq: "asc" }, include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
  if (!contract) return null;
  const lastApproved = [...contract.billings].reverse().find((b) => b.status === "APPROVED");
  const done = lastApproved
    ? new Map(
        (await db.progressBillingLine.findMany({ where: { billingId: lastApproved.id } })).map((l) => [l.contractItemId, dec(l.cumulativeQuantity)]),
      )
    : new Map<string, Decimal>();
  const items = contract.items.map((item) => ({ ...item, done: done.get(item.id) ?? zero() }));
  const progress = contractProgress(items.map((i) => ({ quantity: dec(i.quantity), unitPrice: dec(i.unitPrice), doneQuantity: i.done })));
  const advance = await advanceState(contractId);
  const approved = contract.billings.filter((b) => b.status === "APPROVED");
  const totals = {
    gross: approved.reduce((s, b) => s.plus(dec(b.grossAmount)), zero()),
    payable: approved.reduce((s, b) => s.plus(dec(b.payableAmount)), zero()),
    unpaid: approved.filter((b) => b.paymentStatus === "UNPAID").reduce((s, b) => s.plus(dec(b.payableAmount)), zero()),
  };
  // Şantiye şefi miktarları görür, fiyat ve tutarları görmez (PLAN.md Bölüm 2).
  const hide = !perms.amounts;
  return {
    perms,
    contract: {
      ...contract,
      items: items.map((i) => (hide ? { ...i, unitPrice: null } : i)),
      billings: contract.billings.map((b) => (hide ? { id: b.id, seq: b.seq, date: b.date, status: b.status, periodStart: b.periodStart, periodEnd: b.periodEnd, createdBy: b.createdBy, rejectionNote: b.rejectionNote } : b)),
    },
    progress: hide ? { percent: progress.percent } : progress,
    advance: hide ? null : advance,
    totals: hide ? null : totals,
  };
}

/** Sözleşme formu için seçenekler: taşeronlar ve projenin maliyet kalemleri. */
export async function contractFormOptions(projectId: string) {
  await contractAccess(projectId, "contract.manage");
  const [suppliers, costItems] = await Promise.all([
    db.supplier.findMany({
      where: { active: true },
      orderBy: [{ kind: "desc" }, { name: "asc" }],
      select: { id: true, name: true, taxNumber: true, kind: true },
    }),
    db.costItem.findMany({ where: { projectId, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true, unit: true, parentId: true } }),
  ]);
  const parents = new Set(costItems.map((c) => c.parentId).filter(Boolean));
  return { suppliers, costItems: costItems.map((c) => ({ ...c, isGroup: parents.has(c.id) })) };
}

// ---------------------------------------------------------------------------
// Sözleşme kaydı
// ---------------------------------------------------------------------------

function contractColumns(data: ContractData) {
  return {
    no: data.no,
    date: data.date,
    supplierId: data.supplierId,
    title: data.title,
    scope: data.scope,
    supplyMethod: data.supplyMethod,
    vatRate: data.vatRate,
    vatWithholdingRate: data.vatWithholdingRate,
    retentionRate: data.retentionRate,
    advanceOffsetRate: data.advanceOffsetRate,
    status: data.status,
    startDate: data.startDate,
    endDate: data.endDate,
    notes: data.notes,
  };
}

async function validateContractRefs(tx: Tx, projectId: string, data: ContractData, contractId?: string) {
  if (!(await tx.supplier.count({ where: { id: data.supplierId } }))) throw new ActionError("Taşeron bulunamadı.");
  const ids = [...new Set(data.items.map((i) => i.costItemId))];
  const found = await tx.costItem.count({ where: { id: { in: ids }, projectId, active: true } });
  if (found !== ids.length) throw new ActionError("Maliyet kalemlerinden biri bu projede yok veya pasif.");
  const dup = await tx.subcontractContract.findFirst({ where: { projectId, no: data.no, id: contractId ? { not: contractId } : undefined } });
  if (dup) throw new ActionError(`“${data.no}” numaralı sözleşme bu projede zaten var.`);
}

export async function createContract(projectId: string, data: ContractData, files: File[]) {
  const { user } = await contractAccess(projectId, "contract.manage");
  const saved = await storeFiles(files);
  try {
    return await db.$transaction(async (tx) => {
      await validateContractRefs(tx, projectId, data);
      const created = await tx.subcontractContract.create({
        data: {
          projectId,
          ...contractColumns(data),
          createdById: user.id,
          items: {
            create: data.items.map((item, index) => ({
              sortOrder: index,
              costItemId: item.costItemId,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
          documents: { create: documentRows(saved, user.id) },
        },
      });
      await writeAudit(tx, { userId: user.id, projectId, action: "create", entity: "SubcontractContract", entityId: created.id, changes: { no: data.no, items: data.items.length } });
      return created.id;
    });
  } catch (error) {
    await discardFiles(saved);
    throw error;
  }
}

/** Hakedişe girmiş satır silinemez; fiyat değişikliği sonraki hakedişlerden itibaren geçerlidir. */
export async function updateContract(projectId: string, contractId: string, data: ContractData, files: File[], removeDocumentIds: string[]) {
  const { user } = await contractAccess(projectId, "contract.manage");
  const before = await db.subcontractContract.findFirst({ where: { id: contractId, projectId }, include: { items: { include: { _count: { select: { lines: true } } } } } });
  if (!before) throw new ActionError("Sözleşme bulunamadı.");
  const saved = await storeFiles(files);
  let removedKeys: string[] = [];
  try {
    await db.$transaction(async (tx) => {
      await validateContractRefs(tx, projectId, data, contractId);
      const keep = new Set(data.items.map((i) => i.id).filter(Boolean));
      for (const item of before.items) {
        if (keep.has(item.id)) continue;
        if (item._count.lines > 0) throw new ActionError(`“${item.description}” hakedişlerde kullanıldı; silinemez.`);
        await tx.contractItem.delete({ where: { id: item.id } });
      }
      for (const [index, item] of data.items.entries()) {
        const columns = { sortOrder: index, costItemId: item.costItemId, description: item.description, unit: item.unit, quantity: item.quantity, unitPrice: item.unitPrice };
        const existing = item.id ? before.items.find((i) => i.id === item.id) : undefined;
        if (existing) await tx.contractItem.update({ where: { id: existing.id }, data: columns });
        else await tx.contractItem.create({ data: { contractId, ...columns } });
      }
      const removed = await tx.document.findMany({ where: { id: { in: removeDocumentIds }, contractId }, select: { id: true, storageKey: true } });
      removedKeys = removed.map((d) => d.storageKey);
      await tx.document.deleteMany({ where: { id: { in: removed.map((d) => d.id) } } });
      await tx.subcontractContract.update({ where: { id: contractId }, data: { ...contractColumns(data), documents: { create: documentRows(saved, user.id) } } });
      await writeAudit(tx, { userId: user.id, projectId, action: "update", entity: "SubcontractContract", entityId: contractId, changes: { no: data.no, items: data.items.length } });
    });
  } catch (error) {
    await discardFiles(saved);
    throw error;
  }
  await removeOrphanFiles(removedKeys);
}

export async function setContractStatus(projectId: string, contractId: string, status: ContractStatus) {
  const { user } = await contractAccess(projectId, "contract.manage");
  await db.$transaction(async (tx) => {
    const result = await tx.subcontractContract.updateMany({ where: { id: contractId, projectId }, data: { status } });
    if (!result.count) throw new ActionError("Sözleşme bulunamadı.");
    await writeAudit(tx, { userId: user.id, projectId, action: "status", entity: "SubcontractContract", entityId: contractId, changes: { status } });
  });
}

// ---------------------------------------------------------------------------
// Avans bağlama
// ---------------------------------------------------------------------------

export async function linkableContractAdvances(projectId: string, contractId: string) {
  await contractAccess(projectId, "contract.manage");
  const contract = await db.subcontractContract.findFirst({ where: { id: contractId, projectId }, select: { supplierId: true } });
  if (!contract) return [];
  return db.expense.findMany({
    where: {
      projectId,
      kind: "ADVANCE",
      supplierId: contract.supplierId,
      currency: "TRY",
      contractId: null,
      connectionId: null,
      deletedAt: null,
      approvalStatus: { not: "REJECTED" },
    },
    orderBy: { date: "asc" },
    select: { id: true, date: true, totalAmountTry: true, documentNo: true, description: true, paymentStatus: true },
  });
}

export async function setAdvanceContract(projectId: string, expenseId: string, contractId: string | null) {
  const { user } = await contractAccess(projectId, "contract.manage");
  const expense = await db.expense.findFirst({ where: { id: expenseId, projectId, kind: "ADVANCE", deletedAt: null } });
  if (!expense) throw new ActionError("Avans kaydı bulunamadı.");
  if (contractId) {
    const contract = await db.subcontractContract.findFirst({ where: { id: contractId, projectId }, select: { supplierId: true } });
    if (!contract) throw new ActionError("Sözleşme bulunamadı.");
    if (contract.supplierId !== expense.supplierId) throw new ActionError("Avansın tedarikçisi sözleşmedeki taşeron değil.");
    if (expense.currency !== "TRY") throw new ActionError("Taşeron avansı TL olmalı.");
    if (expense.connectionId) throw new ActionError("Bu avans bir malzeme bağlantısına bağlı.");
  } else if (expense.contractId) {
    const state = await advanceState(expense.contractId);
    if (state.open.minus(dec(expense.totalAmountTry)).isNegative() && expense.paymentStatus === "PAID") {
      throw new ActionError("Bu avans hakedişlerde mahsup edildi; bağlantısı kaldırılamaz.");
    }
  }
  await db.$transaction(async (tx) => {
    await tx.expense.update({ where: { id: expenseId }, data: { contractId } });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: contractId ? "link_contract" : "unlink_contract",
      entity: "Expense",
      entityId: expenseId,
      changes: { contractId: { old: expense.contractId, new: contractId } },
    });
  });
}

// ---------------------------------------------------------------------------
// Hakediş
// ---------------------------------------------------------------------------

/** Yeni / taslak hakediş formu: satırlar, önceki kümülatif miktarlar, açık avans. */
export async function billingFormData(projectId: string, contractId: string, billingId: string | null) {
  const { role } = await contractAccess(projectId, "progress.prepare");
  const perms = permissions(role);
  const contract = await db.subcontractContract.findFirst({
    where: { id: contractId, projectId },
    include: { items: { orderBy: { sortOrder: "asc" } }, supplier: { select: { name: true } }, billings: { orderBy: { seq: "desc" } } },
  });
  if (!contract) return null;
  const billing = billingId ? contract.billings.find((b) => b.id === billingId) : null;
  if (billingId && !billing) return null;
  if (billing && billing.status === "APPROVED") throw new ActionError("Onaylanmış hakediş düzenlenemez; önce onayı geri alın.");
  if (!billing && contract.billings.some((b) => b.status !== "APPROVED")) {
    throw new ActionError("Bu sözleşmede tamamlanmamış bir hakediş var; önce onu tamamlayın.");
  }
  const previous = contract.billings.find((b) => b.status === "APPROVED" && (!billing || b.seq < billing.seq));
  const previousLines = previous ? await db.progressBillingLine.findMany({ where: { billingId: previous.id } }) : [];
  const currentLines = billing ? await db.progressBillingLine.findMany({ where: { billingId: billing.id } }) : [];
  const prev = new Map(previousLines.map((l) => [l.contractItemId, dec(l.cumulativeQuantity)]));
  const cur = new Map(currentLines.map((l) => [l.contractItemId, dec(l.cumulativeQuantity)]));
  const advance = await advanceState(contractId, billing?.id);
  return {
    perms,
    contract: {
      id: contract.id,
      no: contract.no,
      title: contract.title,
      supplier: contract.supplier.name,
      ...(perms.amounts
        ? {
            terms: {
              vatRate: contract.vatRate.toString(),
              vatWithholdingRate: contract.vatWithholdingRate.toString(),
              retentionRate: contract.retentionRate.toString(),
              advanceOffsetRate: contract.advanceOffsetRate.toString(),
            },
          }
        : {}),
    },
    seq: billing?.seq ?? (contract.billings[0]?.seq ?? 0) + 1,
    billing: billing
      ? {
          id: billing.id,
          date: billing.date,
          periodStart: billing.periodStart,
          periodEnd: billing.periodEnd,
          dueDate: billing.dueDate,
          notes: billing.notes,
          rejectionNote: billing.rejectionNote,
          ...(perms.amounts
            ? {
                advanceOffset: billing.advanceOffset.toString(),
                materialOffset: billing.materialOffset.toString(),
                otherDeductions: billing.otherDeductions.toString(),
                otherDeductionNote: billing.otherDeductionNote,
              }
            : {}),
        }
      : null,
    lines: contract.items.map((item) => ({
      contractItemId: item.id,
      description: item.description,
      unit: item.unit,
      contractQuantity: item.quantity.toString(),
      unitPrice: perms.amounts ? item.unitPrice.toString() : null,
      previousQuantity: (prev.get(item.id) ?? zero()).toString(),
      cumulativeQuantity: (cur.get(item.id) ?? prev.get(item.id) ?? zero()).toString(),
    })),
    openAdvance: perms.amounts ? advance.open.toString() : null,
  };
}

/** Taslağı kaydeder (yeni veya mevcut). Şantiye şefinin girdiği taslakta kesintiler korunur. */
export async function saveBilling(projectId: string, contractId: string, billingId: string | null, data: BillingData, files: File[]) {
  const { user, role } = await contractAccess(projectId, "progress.prepare");
  const perms = permissions(role);
  const contract = await db.subcontractContract.findFirst({
    where: { id: contractId, projectId },
    include: { items: true, billings: { orderBy: { seq: "desc" } } },
  });
  if (!contract) throw new ActionError("Sözleşme bulunamadı.");
  if (contract.status !== "ACTIVE") throw new ActionError("Sözleşme aktif değil; hakediş girilemez.");
  const billing = billingId ? contract.billings.find((b) => b.id === billingId) : null;
  if (billingId && !billing) throw new ActionError("Hakediş bulunamadı.");
  if (billing?.status === "APPROVED") throw new ActionError("Onaylanmış hakediş düzenlenemez.");
  if (!billing && contract.billings.some((b) => b.status !== "APPROVED")) throw new ActionError("Bu sözleşmede tamamlanmamış bir hakediş var.");

  const previous = contract.billings.find((b) => b.status === "APPROVED" && (!billing || b.seq < billing.seq));
  const prev = new Map(
    (previous ? await db.progressBillingLine.findMany({ where: { billingId: previous.id } }) : []).map((l) => [l.contractItemId, dec(l.cumulativeQuantity)]),
  );
  const cumulative = new Map(data.lines.map((l) => [l.contractItemId, l.cumulativeQuantity]));
  if ([...cumulative.keys()].some((id) => !contract.items.some((i) => i.id === id))) throw new ActionError("Satır bu sözleşmenin kalemi değil.");
  const advance = await advanceState(contractId, billing?.id);
  const keepDeductions = !perms.amounts && billing;
  const result = computeProgressBilling({
    lines: contract.items.map((item) => ({
      contractItemId: item.id,
      description: item.description,
      unit: item.unit,
      unitPrice: dec(item.unitPrice),
      contractQuantity: dec(item.quantity),
      previousQuantity: prev.get(item.id) ?? zero(),
      cumulativeQuantity: cumulative.get(item.id) ?? prev.get(item.id) ?? zero(),
    })),
    terms: { vatRate: dec(contract.vatRate), vatWithholdingRate: dec(contract.vatWithholdingRate), retentionRate: dec(contract.retentionRate), advanceOffsetRate: dec(contract.advanceOffsetRate) },
    openAdvance: advance.open,
    advanceOffset: perms.amounts ? data.advanceOffset : keepDeductions ? dec(billing.advanceOffset) : null,
    materialOffset: perms.amounts ? (data.materialOffset ?? zero()) : keepDeductions ? dec(billing.materialOffset) : zero(),
    otherDeductions: perms.amounts ? (data.otherDeductions ?? zero()) : keepDeductions ? dec(billing.otherDeductions) : zero(),
  });
  if (result.errors.length) throw new ActionError(result.errors.join(" "));

  const columns = {
    date: data.date,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    dueDate: data.dueDate,
    notes: data.notes,
    grossAmount: result.grossAmount,
    vatRate: contract.vatRate,
    vatAmount: result.vatAmount,
    vatWithheld: result.vatWithheld,
    retention: result.retention,
    advanceOffset: result.advanceOffset,
    materialOffset: result.materialOffset,
    otherDeductions: result.otherDeductions,
    otherDeductionNote: perms.amounts ? data.otherDeductionNote : (billing?.otherDeductionNote ?? null),
    payableAmount: result.payableAmount,
  };
  const saved = await storeFiles(files);
  try {
    const id = await db.$transaction(async (tx) => {
      const lines = result.lines.map((l) => ({
        contractItemId: l.contractItemId,
        cumulativeQuantity: l.cumulativeQuantity,
        previousQuantity: l.previousQuantity,
        amount: l.amount,
      }));
      if (billing) {
        await tx.progressBillingLine.deleteMany({ where: { billingId: billing.id } });
        await tx.progressBilling.update({
          where: { id: billing.id },
          data: { ...columns, lines: { create: lines }, documents: { create: documentRows(saved, user.id) } },
        });
        await writeAudit(tx, { userId: user.id, projectId, action: "update", entity: "ProgressBilling", entityId: billing.id, changes: { gross: result.grossAmount.toString(), payable: result.payableAmount.toString() } });
        return billing.id;
      }
      const created = await tx.progressBilling.create({
        data: {
          contractId,
          projectId,
          seq: (contract.billings[0]?.seq ?? 0) + 1,
          ...columns,
          createdById: user.id,
          lines: { create: lines },
          documents: { create: documentRows(saved, user.id) },
        },
      });
      await writeAudit(tx, { userId: user.id, projectId, action: "create", entity: "ProgressBilling", entityId: created.id, changes: { seq: created.seq, gross: result.grossAmount.toString() } });
      return created.id;
    });
    return { id, warnings: result.warnings };
  } catch (error) {
    await discardFiles(saved);
    throw error;
  }
}

async function findBilling(projectId: string, billingId: string) {
  const billing = await db.progressBilling.findFirst({ where: { id: billingId, projectId }, include: { lines: { include: { contractItem: true } }, contract: true } });
  if (!billing) throw new ActionError("Hakediş bulunamadı.");
  return billing;
}

export async function getBilling(projectId: string, billingId: string) {
  const { role, user } = await contractAccess(projectId);
  const perms = permissions(role);
  const billing = await db.progressBilling.findFirst({
    where: { id: billingId, projectId },
    include: {
      contract: { include: { supplier: { select: { id: true, name: true, taxNumber: true } } } },
      lines: { include: { contractItem: { include: { costItem: { select: { code: true, name: true } } } } }, orderBy: { contractItem: { sortOrder: "asc" } } },
      documents: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      expenses: { where: { deletedAt: null }, select: { id: true, netAmountTry: true, costItem: { select: { code: true, name: true } } } },
    },
  });
  if (!billing) return null;
  const isLatest = !(await db.progressBilling.count({ where: { contractId: billing.contractId, seq: { gt: billing.seq } } }));
  const hide = !perms.amounts;
  return {
    perms,
    isLatest,
    canEdit: billing.status !== "APPROVED" && perms.prepare && (billing.status === "DRAFT" || perms.approve),
    isOwn: billing.createdById === user.id,
    billing: hide
      ? {
          ...billing,
          grossAmount: null,
          vatAmount: null,
          vatWithheld: null,
          retention: null,
          advanceOffset: null,
          materialOffset: null,
          otherDeductions: null,
          payableAmount: null,
          contract: { ...billing.contract, vatRate: null, vatWithholdingRate: null, retentionRate: null, advanceOffsetRate: null },
          lines: billing.lines.map((l) => ({ ...l, amount: null, contractItem: { ...l.contractItem, unitPrice: null } })),
          expenses: [],
        }
      : billing,
  };
}

/** Taslak → onay bekliyor. */
export async function submitBilling(projectId: string, billingId: string) {
  const { user } = await contractAccess(projectId, "progress.prepare");
  const billing = await findBilling(projectId, billingId);
  if (billing.status !== "DRAFT") throw new ActionError("Yalnızca taslak hakediş onaya gönderilir.");
  await db.$transaction(async (tx) => {
    await tx.progressBilling.update({ where: { id: billingId }, data: { status: "PENDING", rejectionNote: null } });
    await writeAudit(tx, { userId: user.id, projectId, action: "submit", entity: "ProgressBilling", entityId: billingId });
  });
}

/** Onay: maliyet kalemi başına PROGRESS harcama satırları oluşturulur (brüt − malzeme mahsubu). */
export async function approveBilling(projectId: string, billingId: string) {
  const { user } = await contractAccess(projectId, "progress.approve");
  const billing = await findBilling(projectId, billingId);
  if (billing.status === "APPROVED") throw new ActionError("Hakediş zaten onaylı.");
  const advance = await advanceState(billing.contractId, billing.id);
  if (dec(billing.advanceOffset).gt(advance.open)) {
    throw new ActionError("Avans mahsubu, mahsup edilmemiş avansı aşıyor; hakedişi güncelleyin.");
  }
  const rows = progressCostRows(
    billing.lines.map((l) => ({ costItemId: l.contractItem.costItemId, amount: dec(l.amount) })),
    dec(billing.materialOffset),
    dec(billing.vatAmount),
  );
  await db.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.expense.create({
        data: {
          projectId,
          kind: "PROGRESS",
          date: billing.date,
          costItemId: row.costItemId,
          supplierId: billing.contract.supplierId,
          description: `${billing.contract.no} ${billing.contract.title} – ${billing.seq}. hakediş`,
          currency: "TRY",
          exchangeRate: 1,
          vatRate: billing.vatRate,
          netAmount: row.netAmount,
          vatAmount: row.vatAmount,
          totalAmount: row.netAmount.plus(row.vatAmount),
          netAmountTry: row.netAmount,
          vatAmountTry: row.vatAmount,
          totalAmountTry: row.netAmount.plus(row.vatAmount),
          documentType: "PROGRESS_BILLING",
          documentNo: `${billing.contract.no}/${billing.seq}`,
          contractId: billing.contractId,
          progressBillingId: billing.id,
          approvalStatus: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          createdById: user.id,
        },
      });
    }
    await tx.progressBilling.update({
      where: { id: billingId },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), rejectionNote: null },
    });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: "approve",
      entity: "ProgressBilling",
      entityId: billingId,
      changes: { payable: billing.payableAmount.toString(), costRows: rows.length },
    });
  });
}

export async function rejectBilling(projectId: string, billingId: string, note: string) {
  const { user } = await contractAccess(projectId, "progress.approve");
  if (!note) throw new ActionError("Geri gönderme nedenini yazın.");
  const billing = await findBilling(projectId, billingId);
  if (billing.status !== "PENDING") throw new ActionError("Yalnızca onay bekleyen hakediş geri gönderilir.");
  await db.$transaction(async (tx) => {
    await tx.progressBilling.update({ where: { id: billingId }, data: { status: "DRAFT", rejectionNote: note } });
    await writeAudit(tx, { userId: user.id, projectId, action: "reject", entity: "ProgressBilling", entityId: billingId, changes: { note } });
  });
}

/** Onayı geri al: yalnızca son ve ödenmemiş hakedişte; maliyet satırları silinir. */
export async function revertBilling(projectId: string, billingId: string) {
  const { user } = await contractAccess(projectId, "progress.approve");
  const billing = await findBilling(projectId, billingId);
  if (billing.status !== "APPROVED") throw new ActionError("Hakediş onaylı değil.");
  if (billing.paymentStatus === "PAID") throw new ActionError("Ödenmiş hakedişin onayı geri alınamaz; önce “ödenmedi” yapın.");
  if (await db.progressBilling.count({ where: { contractId: billing.contractId, seq: { gt: billing.seq } } })) {
    throw new ActionError("Sonraki hakediş var; yalnızca son hakedişin onayı geri alınabilir.");
  }
  await db.$transaction(async (tx) => {
    await tx.expense.updateMany({ where: { progressBillingId: billingId, deletedAt: null }, data: { deletedAt: new Date() } });
    await tx.progressBilling.update({ where: { id: billingId }, data: { status: "DRAFT", approvedById: null, approvedAt: null } });
    await writeAudit(tx, { userId: user.id, projectId, action: "revert", entity: "ProgressBilling", entityId: billingId });
  });
}

/** Yalnızca son hakediş ve onaylanmamışsa silinir. */
export async function deleteBilling(projectId: string, billingId: string) {
  const { user } = await contractAccess(projectId, "progress.prepare");
  const billing = await findBilling(projectId, billingId);
  if (billing.status === "APPROVED") throw new ActionError("Onaylı hakediş silinemez; önce onayı geri alın.");
  const keys = (await db.document.findMany({ where: { progressBillingId: billingId }, select: { storageKey: true } })).map((d) => d.storageKey);
  await db.$transaction(async (tx) => {
    await tx.progressBilling.delete({ where: { id: billingId } });
    await writeAudit(tx, { userId: user.id, projectId, action: "delete", entity: "ProgressBilling", entityId: billingId, changes: { seq: billing.seq } });
  });
  await removeOrphanFiles(keys);
}

/** Hakediş ödemesi (vade listesinden toplu da çağrılır). */
export async function setBillingsPaid(
  billingIds: string[],
  payment: { paid: true; paidAt: Date; method: PaymentMethod | null } | { paid: false },
) {
  const { user, scope } = await getAccess();
  const rows = await db.progressBilling.findMany({ where: { id: { in: billingIds } }, select: { id: true, projectId: true, status: true } });
  if (rows.length !== new Set(billingIds).size) throw new ActionError("Hakediş bulunamadı.");
  if (rows.some((r) => !hasCapability(projectRole(scope, r.projectId), "expense.manage"))) throw new ActionError("Bazı hakedişlerde ödeme işaretleme yetkiniz yok.");
  if (rows.some((r) => r.status !== "APPROVED")) throw new ActionError("Onaylanmamış hakediş ödendi işaretlenemez.");
  await db.$transaction(async (tx) => {
    await tx.progressBilling.updateMany({
      where: { id: { in: billingIds } },
      data: payment.paid
        ? { paymentStatus: "PAID", paidAt: payment.paidAt, ...(payment.method ? { paymentMethod: payment.method } : {}) }
        : { paymentStatus: "UNPAID", paidAt: null },
    });
    await writeAudit(tx, { userId: user.id, action: payment.paid ? "mark_paid" : "mark_unpaid", entity: "ProgressBilling", changes: { ids: billingIds } });
  });
  return rows.length;
}
