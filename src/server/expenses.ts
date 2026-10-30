import "server-only";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import type { ApprovalStatus, PaymentMethod, Role } from "@/generated/prisma/enums";
import { projectIdsWithCapability, projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { descendantIds } from "@/lib/cost-tree/tree";
import { canModifyExpense, expenseVisibility, initialApprovalStatus } from "@/lib/expenses/access";
import { COST_KINDS, isManualKind, PAYABLE_KINDS } from "@/lib/expenses/kinds";
import type { ExpenseFilters } from "@/lib/expenses/filters";
import type { ResolvedImportRow } from "@/lib/expenses/import-rows";
import { ratiosFromWeights, splitExpenseAmounts } from "@/lib/expenses/split";
import type { ExpenseData } from "@/lib/validation/expense";
import { ActionError, getAccess } from "./access";
import { diffFields, writeAudit } from "./audit";
import { db, type Tx } from "./db";
import { deleteStoredFile } from "./storage";
import { removeOrphanFiles, storeFiles } from "./uploads";

const PAGE_SIZE = 50;

/** Kullanıcının bu projedeki rolü ve harcama görünürlüğü; erişim yoksa hata. */
export async function expenseAccess(projectId: string) {
  const access = await getAccess();
  const role = projectRole(access.scope, projectId);
  if (!role) throw new ActionError("Proje bulunamadı veya bu projeye erişiminiz yok.");
  return { ...access, role, visibility: expenseVisibility(role, access.user.id) };
}

function requireCapability(role: Role, capability: Parameters<typeof hasCapability>[1]) {
  if (!hasCapability(role, capability)) throw new ActionError("Bu işlem için yetkiniz yok.");
}

// ---------------------------------------------------------------------------
// Listeleme
// ---------------------------------------------------------------------------

async function filterWhere(
  projectId: string,
  visibility: { createdById?: string },
  filters: ExpenseFilters,
): Promise<Prisma.ExpenseWhereInput> {
  let costItemIds: string[] | undefined;
  if (filters.costItemId) {
    const rows = await db.costItem.findMany({ where: { projectId }, select: { id: true, parentId: true, code: true } });
    costItemIds = [filters.costItemId, ...descendantIds(rows, filters.costItemId)];
  }
  const query = filters.query;
  return {
    projectId,
    deletedAt: null,
    ...visibility,
    date: filters.from || filters.to ? { gte: filters.from ?? undefined, lte: filters.to ?? undefined } : undefined,
    costItemId: costItemIds ? { in: costItemIds } : undefined,
    supplierId: filters.supplierId ?? undefined,
    blockId: filters.blockId ?? undefined,
    approvalStatus: filters.status ?? undefined,
    paymentStatus: filters.payment ?? undefined,
    kind: filters.kind ?? undefined,
    documents: filters.missingDocument ? { none: {} } : undefined,
    OR: query
      ? [
          { description: { contains: query, mode: "insensitive" } },
          { documentNo: { contains: query, mode: "insensitive" } },
          { supplier: { name: { contains: query, mode: "insensitive" } } },
        ]
      : undefined,
  };
}

export const expenseListSelect = {
  id: true,
  date: true,
  kind: true,
  description: true,
  currency: true,
  totalAmount: true,
  netAmountTry: true,
  vatAmountTry: true,
  totalAmountTry: true,
  documentType: true,
  documentNo: true,
  paymentStatus: true,
  dueDate: true,
  approvalStatus: true,
  createdById: true,
  splitGroupId: true,
  costItem: { select: { code: true, name: true } },
  supplier: { select: { id: true, name: true } },
  block: { select: { name: true } },
  createdBy: { select: { name: true } },
  _count: { select: { documents: true } },
} satisfies Prisma.ExpenseSelect;

export async function listExpenses(projectId: string, filters: ExpenseFilters) {
  const { role, visibility, user } = await expenseAccess(projectId);
  if (!visibility) return null;
  const where = await filterWhere(projectId, visibility, filters);
  const [rows, count, sums, pending] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: expenseListSelect,
    }),
    db.expense.count({ where }),
    db.expense.aggregate({ where, _sum: { netAmountTry: true, vatAmountTry: true, totalAmountTry: true } }),
    db.expense.count({ where: { projectId, deletedAt: null, ...visibility, approvalStatus: "PENDING" } }),
  ]);
  return {
    rows: rows.map((row) => ({ ...row, canModify: canModifyExpense(role, user.id, row) })),
    count,
    pageSize: PAGE_SIZE,
    pending,
    sums,
    role,
  };
}

/** Excel'e aktarma için filtreye uyan tüm kayıtlar. */
export async function listExpensesForExport(projectId: string, filters: ExpenseFilters) {
  const { visibility } = await expenseAccess(projectId);
  if (!visibility) throw new ActionError("Harcamaları görme yetkiniz yok.");
  const where = await filterWhere(projectId, visibility, filters);
  return db.expense.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      costItem: { select: { code: true, name: true } },
      supplier: { select: { name: true, taxNumber: true } },
      block: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { documents: true } },
    },
  });
}

export async function getExpense(projectId: string, expenseId: string) {
  const { role, visibility, user, scope } = await expenseAccess(projectId);
  if (!visibility) return null;
  const expense = await db.expense.findFirst({
    where: { id: expenseId, projectId, deletedAt: null, ...visibility },
    include: {
      costItem: { select: { id: true, code: true, name: true } },
      supplier: { select: { id: true, name: true, taxNumber: true } },
      block: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      documents: { orderBy: { createdAt: "asc" } },
      import: { select: { fileName: true, createdAt: true } },
    },
  });
  if (!expense) return null;
  const siblings = expense.splitGroupId
    ? await db.expense.findMany({
        where: { splitGroupId: expense.splitGroupId, deletedAt: null, NOT: { id: expense.id } },
        select: { id: true, projectId: true, totalAmountTry: true, splitRatio: true, project: { select: { name: true } } },
      })
    : [];
  return {
    expense,
    role,
    canModify: canModifyExpense(role, user.id, expense),
    canApprove: hasCapability(role, "expense.approve"),
    canManage: hasCapability(role, "expense.manage"),
    // Diğer projelerin adları yalnızca o projeleri görebilen kullanıcıya gösterilir.
    siblings: siblings.map((s) => ({ ...s, visible: projectRole(scope, s.projectId) !== null })),
  };
}

// ---------------------------------------------------------------------------
// Giriş formu için seçenekler ve öneriler
// ---------------------------------------------------------------------------

export async function entryOptions(projectId: string) {
  const { role, user } = await expenseAccess(projectId);
  const [costItems, blocks, recent] = await Promise.all([
    db.costItem.findMany({
      where: { projectId, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, name: true, unit: true, parentId: true },
    }),
    db.block.findMany({ where: { projectId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.expense.findMany({
      where: { projectId, createdById: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: expenseListSelect,
    }),
  ]);
  const parents = new Set(costItems.map((item) => item.parentId).filter(Boolean));
  return {
    role,
    costItems: costItems.map((item) => ({ ...item, isGroup: parents.has(item.id) })),
    blocks,
    recent,
  };
}

/** Kalem seçilince: o kalemde en son kullanılan tedarikçi, KDV oranı ve birim fiyat. */
export async function lastUsedFor(projectId: string, costItemId: string) {
  const { visibility } = await expenseAccess(projectId);
  if (!visibility) return null;
  const last = await db.expense.findFirst({
    where: { projectId, costItemId, deletedAt: null, ...visibility },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      vatRate: true,
      unit: true,
      unitPrice: true,
      currency: true,
      supplier: { select: { id: true, name: true, taxNumber: true, active: true } },
    },
  });
  if (!last) return null;
  return {
    vatRate: last.vatRate.toString(),
    unit: last.unit,
    unitPrice: last.unitPrice?.toString() ?? null,
    currency: last.currency,
    supplier: last.supplier?.active ? { id: last.supplier.id, name: last.supplier.name, taxNumber: last.supplier.taxNumber } : null,
  };
}

/** Aynı tedarikçide aynı belge numarası (mükerrer fatura uyarısı). */
async function findDuplicates(supplierId: string | null, documentNo: string | null, exceptIds: string[] = []) {
  if (!supplierId || !documentNo) return [];
  return db.expense.findMany({
    where: { supplierId, documentNo, deletedAt: null, id: { notIn: exceptIds } },
    select: { id: true, date: true, totalAmountTry: true, project: { select: { name: true } } },
    take: 5,
  });
}

// ---------------------------------------------------------------------------
// Kaydetme
// ---------------------------------------------------------------------------

async function validateReferences(tx: Tx, projectId: string, data: Pick<ExpenseData, "kind" | "costItemId" | "blockId" | "supplierId">) {
  if (data.costItemId) {
    const item = await tx.costItem.findFirst({ where: { id: data.costItemId, projectId }, select: { active: true } });
    if (!item) throw new ActionError("Maliyet kalemi bu projede yok.");
    if (!item.active) throw new ActionError("Pasif maliyet kalemine harcama girilemez.");
  } else if (data.kind === "EXPENSE") {
    throw new ActionError("Maliyet kalemini seçin.");
  }
  if (data.blockId && !(await tx.block.count({ where: { id: data.blockId, projectId } }))) {
    throw new ActionError("Blok bu projede yok.");
  }
  if (data.supplierId && !(await tx.supplier.count({ where: { id: data.supplierId } }))) {
    throw new ActionError("Tedarikçi bulunamadı.");
  }
}

function expenseColumns(data: ExpenseData) {
  return {
    kind: data.kind,
    date: data.date,
    costItemId: data.costItemId,
    blockId: data.blockId,
    supplierId: data.supplierId,
    description: data.description,
    quantity: data.quantity,
    unit: data.unit,
    unitPrice: data.unitPrice,
    currency: data.currency,
    exchangeRate: data.exchangeRate,
    vatRate: data.vatRate,
    ...data.amounts,
    documentType: data.documentType,
    documentNo: data.documentNo,
    paymentStatus: data.paymentStatus,
    paymentMethod: data.paymentMethod,
    dueDate: data.dueDate,
    paidAt: data.paidAt,
  };
}

export type SaveResult =
  | { status: "saved"; id: string }
  | { status: "duplicate"; duplicates: { id: string; date: Date; totalAmountTry: Decimal; project: { name: string } }[] };

export async function createExpense(projectId: string, data: ExpenseData, files: File[]): Promise<SaveResult> {
  const { role, user } = await expenseAccess(projectId);
  requireCapability(role, "expense.create");
  if (!data.confirmDuplicate) {
    const duplicates = await findDuplicates(data.supplierId, data.documentNo);
    if (duplicates.length > 0) return { status: "duplicate", duplicates };
  }
  const saved = await storeFiles(files);
  try {
    const approvalStatus = initialApprovalStatus(role);
    const expense = await db.$transaction(async (tx) => {
      await validateReferences(tx, projectId, data);
      const created = await tx.expense.create({
        data: {
          projectId,
          ...expenseColumns(data),
          approvalStatus,
          approvedById: approvalStatus === "APPROVED" ? user.id : null,
          approvedAt: approvalStatus === "APPROVED" ? new Date() : null,
          createdById: user.id,
          documents: {
            create: saved.map((file) => ({
              fileName: file.fileName,
              mimeType: file.mimeType,
              size: file.size,
              storageKey: file.key,
              uploadedById: user.id,
            })),
          },
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        projectId,
        action: "create",
        entity: "Expense",
        entityId: created.id,
        changes: {
          totalAmountTry: created.totalAmountTry.toString(),
          documentNo: created.documentNo,
          documents: saved.length,
        },
      });
      return created;
    });
    return { status: "saved", id: expense.id };
  } catch (error) {
    await Promise.all(saved.map((file) => deleteStoredFile(file.key)));
    throw error;
  }
}

export async function updateExpense(
  projectId: string,
  expenseId: string,
  data: ExpenseData,
  files: File[],
  removeDocumentIds: string[],
): Promise<SaveResult> {
  const { role, user } = await expenseAccess(projectId);
  const before = await db.expense.findFirst({ where: { id: expenseId, projectId, deletedAt: null } });
  if (!before) throw new ActionError("Harcama bulunamadı.");
  if (!canModifyExpense(role, user.id, before)) throw new ActionError("Bu kaydı değiştirme yetkiniz yok.");
  if (!isManualKind(before.kind)) {
    throw new ActionError("Bağlantı çekişi düzenlenemez; yanlışsa silip yeniden girin.");
  }

  // Bölünmüş faturada yalnızca bu projeye ait alanlar (kalem, blok, açıklama) değişebilir.
  const columns = before.splitGroupId
    ? { costItemId: data.costItemId, blockId: data.blockId, description: data.description }
    : expenseColumns(data);

  if (!before.splitGroupId && !data.confirmDuplicate) {
    const duplicates = await findDuplicates(data.supplierId, data.documentNo, [expenseId]);
    if (duplicates.length > 0) return { status: "duplicate", duplicates };
  }

  const saved = await storeFiles(files);
  let removedKeys: string[] = [];
  try {
    await db.$transaction(async (tx) => {
      await validateReferences(tx, projectId, { ...data, kind: before.kind, supplierId: before.splitGroupId ? before.supplierId : data.supplierId });
      const removed = await tx.document.findMany({
        where: { id: { in: removeDocumentIds }, expenseId },
        select: { id: true, storageKey: true },
      });
      removedKeys = removed.map((doc) => doc.storageKey);
      await tx.document.deleteMany({ where: { id: { in: removed.map((doc) => doc.id) } } });
      // Reddedilen kaydı giren kişi düzeltince yeniden onaya düşer.
      const resubmit = before.approvalStatus === "REJECTED" && !hasCapability(role, "expense.approve");
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          ...columns,
          ...(resubmit ? { approvalStatus: "PENDING" as const, approvalNote: null } : {}),
          documents: {
            create: saved.map((file) => ({
              fileName: file.fileName,
              mimeType: file.mimeType,
              size: file.size,
              storageKey: file.key,
              uploadedById: user.id,
            })),
          },
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        projectId,
        action: "update",
        entity: "Expense",
        entityId: expenseId,
        changes: {
          ...diffFields(before, columns),
          ...(saved.length ? { addedDocuments: saved.length } : {}),
          ...(removed.length ? { removedDocuments: removed.length } : {}),
        },
      });
    });
  } catch (error) {
    await Promise.all(saved.map((file) => deleteStoredFile(file.key)));
    throw error;
  }
  await removeOrphanFiles(removedKeys);
  return { status: "saved", id: expenseId };
}

/** Siler (kayıt veritabanında silindi olarak işaretlenir). Bölünmüş faturada tüm satırlar silinir. */
export async function deleteExpense(projectId: string, expenseId: string) {
  const { role, user, scope } = await expenseAccess(projectId);
  const expense = await db.expense.findFirst({ where: { id: expenseId, projectId, deletedAt: null } });
  if (!expense) throw new ActionError("Harcama bulunamadı.");
  if (!canModifyExpense(role, user.id, expense)) throw new ActionError("Bu kaydı silme yetkiniz yok.");

  let ids = [expenseId];
  if (expense.splitGroupId) {
    const group = await db.expense.findMany({
      where: { splitGroupId: expense.splitGroupId, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (group.some((row) => !hasCapability(projectRole(scope, row.projectId), "expense.manage"))) {
      throw new ActionError("Bu fatura başka projelere de bölünmüş; tüm projelerde yetkili bir kullanıcı silebilir.");
    }
    ids = group.map((row) => row.id);
  }
  await db.$transaction(async (tx) => {
    await tx.expense.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: "delete",
      entity: "Expense",
      entityId: expenseId,
      changes: { ids, totalAmountTry: expense.totalAmountTry.toString(), documentNo: expense.documentNo },
    });
  });
}

// ---------------------------------------------------------------------------
// Onay ve ödeme
// ---------------------------------------------------------------------------

export async function setApproval(
  projectId: string,
  expenseIds: string[],
  decision: Exclude<ApprovalStatus, "PENDING">,
  note: string | null,
) {
  const { role, user } = await expenseAccess(projectId);
  requireCapability(role, "expense.approve");
  if (decision === "REJECTED" && !note) throw new ActionError("Reddetme nedenini yazın; giren kişi görecek.");
  return db.$transaction(async (tx) => {
    const result = await tx.expense.updateMany({
      // Hakediş ve transfer satırları kendi ekranlarında onaylanır.
      where: {
        id: { in: expenseIds },
        projectId,
        deletedAt: null,
        approvalStatus: { not: decision },
        kind: { in: ["EXPENSE", "ADVANCE", "DELIVERY"] },
      },
      data: {
        approvalStatus: decision,
        approvalNote: note,
        approvedById: decision === "APPROVED" ? user.id : null,
        approvedAt: decision === "APPROVED" ? new Date() : null,
      },
    });
    await writeAudit(tx, {
      userId: user.id,
      projectId,
      action: decision === "APPROVED" ? "approve" : "reject",
      entity: "Expense",
      changes: { ids: expenseIds, count: result.count, note },
    });
    return result.count;
  });
}

/** Ödendi / ödenmedi işaretleme; birden fazla projedeki kayıtlar (vade listesi) için de çalışır. */
export async function setPaymentStatus(
  expenseIds: string[],
  payment: { paid: true; paidAt: Date; method: PaymentMethod | null } | { paid: false },
) {
  const { user, scope } = await getAccess();
  const rows = await db.expense.findMany({
    where: { id: { in: expenseIds }, deletedAt: null, ...projectIdsWithCapability(scope, "expense.manage") },
    select: { id: true, projectId: true, splitGroupId: true, kind: true },
  });
  if (rows.length !== new Set(expenseIds).size) throw new ActionError("Bazı kayıtlarda ödeme işaretleme yetkiniz yok.");
  if (rows.some((row) => !PAYABLE_KINDS.includes(row.kind))) {
    throw new ActionError("Çekiş, hakediş ve transfer satırlarının ödemesi bağlantı veya hakediş ekranından işaretlenir.");
  }
  // Bölünmüş faturanın tüm satırları birlikte ödenir.
  const groups = rows.map((row) => row.splitGroupId).filter((id): id is string => Boolean(id));
  return db.$transaction(async (tx) => {
    const result = await tx.expense.updateMany({
      where: { deletedAt: null, kind: { in: [...PAYABLE_KINDS] }, OR: [{ id: { in: expenseIds } }, { splitGroupId: { in: groups } }] },
      data: payment.paid
        ? { paymentStatus: "PAID", paidAt: payment.paidAt, ...(payment.method ? { paymentMethod: payment.method } : {}) }
        : { paymentStatus: "UNPAID", paidAt: null },
    });
    await writeAudit(tx, {
      userId: user.id,
      action: payment.paid ? "mark_paid" : "mark_unpaid",
      entity: "Expense",
      changes: { ids: expenseIds, count: result.count },
    });
    return result.count;
  });
}

// ---------------------------------------------------------------------------
// Projelere bölünen (ortak) fatura
// ---------------------------------------------------------------------------

export type SplitAllocation = { projectId: string; costItemCode: string; weight: Decimal };

/** Ortak faturayı projelere böler; her proje için o projedeki aynı kodlu maliyet kalemine yazılır. */
export async function createSplitExpense(base: ExpenseData, allocations: SplitAllocation[], files: File[]): Promise<SaveResult> {
  const { user, scope } = await getAccess();
  if (allocations.length < 2) throw new ActionError("En az iki proje seçin.");
  if (new Set(allocations.map((a) => a.projectId)).size !== allocations.length) {
    throw new ActionError("Aynı proje iki kez seçilmiş.");
  }
  for (const allocation of allocations) {
    if (!hasCapability(projectRole(scope, allocation.projectId), "expense.manage")) {
      throw new ActionError("Seçilen projelerin bazılarında fatura bölme yetkiniz yok.");
    }
  }
  if (!base.confirmDuplicate) {
    const duplicates = await findDuplicates(base.supplierId, base.documentNo);
    if (duplicates.length > 0) return { status: "duplicate", duplicates };
  }

  const weights = allocations.map((a) => a.weight);
  let parts: ReturnType<typeof splitExpenseAmounts>;
  let ratios: Decimal[];
  try {
    parts = splitExpenseAmounts(base.amounts, weights);
    ratios = ratiosFromWeights(weights);
  } catch (error) {
    throw new ActionError(error instanceof Error ? error.message : "Dağıtım oranları geçersiz.");
  }
  const saved = await storeFiles(files);
  const groupId = randomUUID();
  try {
    await db.$transaction(async (tx) => {
      for (const [index, allocation] of allocations.entries()) {
        const item = await tx.costItem.findFirst({
          where: { projectId: allocation.projectId, code: allocation.costItemCode },
          select: { id: true, active: true, project: { select: { name: true } } },
        });
        if (!item) throw new ActionError(`“${allocation.costItemCode}” kalemi seçilen projelerden birinde yok.`);
        if (!item.active) throw new ActionError(`“${allocation.costItemCode}” kalemi ${item.project.name} projesinde pasif.`);
        await validateReferences(tx, allocation.projectId, { ...base, costItemId: item.id, blockId: null });
        const created = await tx.expense.create({
          data: {
            projectId: allocation.projectId,
            ...expenseColumns({ ...base, costItemId: item.id, blockId: null, quantity: null, unitPrice: null, amounts: parts[index] }),
            approvalStatus: "APPROVED",
            approvedById: user.id,
            approvedAt: new Date(),
            createdById: user.id,
            splitGroupId: groupId,
            splitRatio: ratios[index],
            documents: {
              create: saved.map((file) => ({
                fileName: file.fileName,
                mimeType: file.mimeType,
                size: file.size,
                storageKey: file.key,
                uploadedById: user.id,
              })),
            },
          },
        });
        await writeAudit(tx, {
          userId: user.id,
          projectId: allocation.projectId,
          action: "create",
          entity: "Expense",
          entityId: created.id,
          changes: { splitGroupId: groupId, ratio: ratios[index].toString(), totalAmountTry: created.totalAmountTry.toString() },
        });
      }
    });
  } catch (error) {
    await Promise.all(saved.map((file) => deleteStoredFile(file.key)));
    throw error;
  }
  return { status: "saved", id: groupId };
}

// ---------------------------------------------------------------------------
// Toplu giriş (tablo modu, Excel / CSV içe aktarma)
// ---------------------------------------------------------------------------

export async function importLookups(projectId: string) {
  const { role } = await expenseAccess(projectId);
  requireCapability(role, "expense.create");
  const [costItems, suppliers, blocks] = await Promise.all([
    db.costItem.findMany({ where: { projectId }, select: { id: true, code: true, name: true, active: true }, orderBy: { sortOrder: "asc" } }),
    db.supplier.findMany({ where: { active: true }, select: { id: true, name: true, taxNumber: true } }),
    db.block.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);
  return { costItems, suppliers, blocks };
}

export async function importExpenses(
  projectId: string,
  rows: ResolvedImportRow[],
  fileName: string | null,
): Promise<{ importId: string; count: number; newSuppliers: number }> {
  const { role, user } = await expenseAccess(projectId);
  requireCapability(role, "expense.create");
  if (rows.length === 0) throw new ActionError("Aktarılacak satır yok.");
  if (rows.length > 2000) throw new ActionError("Tek seferde en fazla 2000 satır aktarılabilir.");
  const approvalStatus = initialApprovalStatus(role);

  return db.$transaction(
    async (tx) => {
      // Yeni tedarikçiler: aynı ad / vergi no tekrarlanırsa bir kez oluşturulur.
      const created = new Map<string, string>();
      for (const row of rows) {
        if (!row.newSupplier) continue;
        const key = row.newSupplier.taxNumber ?? row.newSupplier.name.toLocaleLowerCase("tr-TR");
        if (created.has(key)) continue;
        const existing = row.newSupplier.taxNumber
          ? await tx.supplier.findFirst({ where: { taxNumber: row.newSupplier.taxNumber }, select: { id: true } })
          : null;
        const supplier =
          existing ??
          (await tx.supplier.create({ data: { name: row.newSupplier.name, taxNumber: row.newSupplier.taxNumber }, select: { id: true } }));
        created.set(key, supplier.id);
      }

      const batch = await tx.expenseImport.create({
        data: { projectId, fileName, rowCount: rows.length, createdById: user.id },
      });
      const costItemIds = new Set(
        (await tx.costItem.findMany({ where: { projectId, active: true }, select: { id: true } })).map((c) => c.id),
      );
      const blockIds = new Set((await tx.block.findMany({ where: { projectId }, select: { id: true } })).map((b) => b.id));

      await tx.expense.createMany({
        data: rows.map((row, index) => {
          if (!costItemIds.has(row.costItemId)) throw new ActionError(`${index + 1}. satır: maliyet kalemi geçersiz.`);
          if (row.blockId && !blockIds.has(row.blockId)) throw new ActionError(`${index + 1}. satır: blok geçersiz.`);
          const supplierId = row.newSupplier
            ? created.get(row.newSupplier.taxNumber ?? row.newSupplier.name.toLocaleLowerCase("tr-TR"))!
            : row.supplierId;
          return {
            projectId,
            kind: "EXPENSE" as const,
            date: row.date,
            costItemId: row.costItemId,
            blockId: row.blockId,
            supplierId,
            description: row.description,
            quantity: row.quantity,
            unit: row.unit,
            unitPrice: row.unitPrice,
            currency: row.currency,
            exchangeRate: row.exchangeRate,
            vatRate: row.vatRate,
            ...row.amounts,
            documentType: row.documentType,
            documentNo: row.documentNo,
            paymentStatus: row.paymentStatus,
            paymentMethod: row.paymentMethod,
            dueDate: row.dueDate,
            paidAt: row.paidAt,
            approvalStatus,
            approvedById: approvalStatus === "APPROVED" ? user.id : null,
            approvedAt: approvalStatus === "APPROVED" ? new Date() : null,
            createdById: user.id,
            importId: batch.id,
          };
        }),
      });
      await writeAudit(tx, {
        userId: user.id,
        projectId,
        action: "import",
        entity: "Expense",
        entityId: batch.id,
        changes: { rows: rows.length, newSuppliers: created.size, fileName },
      });
      return { importId: batch.id, count: rows.length, newSuppliers: created.size };
    },
    { timeout: 60_000 },
  );
}

/** Mükerrer kontrolü toplu girişte: aynı tedarikçi + belge no zaten kayıtlıysa satır numaraları. */
export async function findImportDuplicates(rows: { supplierId: string | null; documentNo: string | null }[]) {
  const pairs = rows.filter((row) => row.supplierId && row.documentNo);
  if (pairs.length === 0) return new Set<number>();
  const existing = await db.expense.findMany({
    where: {
      deletedAt: null,
      OR: pairs.map((row) => ({ supplierId: row.supplierId!, documentNo: row.documentNo! })),
    },
    select: { supplierId: true, documentNo: true },
  });
  const keys = new Set(existing.map((e) => `${e.supplierId}|${e.documentNo}`));
  return new Set(rows.flatMap((row, index) => (keys.has(`${row.supplierId}|${row.documentNo}`) ? [index] : [])));
}

/** Proje paneli: son harcamalar (görünürlüğe göre) ve özet tutarlar. */
export async function projectExpenseOverview(projectId: string) {
  const { role, visibility } = await expenseAccess(projectId);
  if (!visibility) return null;
  const base = { projectId, deletedAt: null, ...visibility };
  const [recent, approved, pending, unpaid] = await Promise.all([
    db.expense.findMany({ where: base, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 5, select: expenseListSelect }),
    db.expense.aggregate({
      where: { ...base, kind: { in: [...COST_KINDS] }, approvalStatus: "APPROVED" },
      _sum: { netAmountTry: true, totalAmountTry: true },
    }),
    db.expense.count({ where: { ...base, approvalStatus: "PENDING" } }),
    db.expense.aggregate({
      where: { ...base, kind: { in: [...PAYABLE_KINDS] }, paymentStatus: "UNPAID", approvalStatus: { not: "REJECTED" } },
      _sum: { totalAmountTry: true },
    }),
  ]);
  return {
    role,
    ownOnly: Boolean(visibility.createdById),
    recent,
    net: approved._sum.netAmountTry ?? new Decimal(0),
    total: approved._sum.totalAmountTry ?? new Decimal(0),
    pending,
    unpaid: unpaid._sum.totalAmountTry ?? new Decimal(0),
  };
}
