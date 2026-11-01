import "server-only";
import Decimal from "decimal.js";
import { projectIdsWithCapability } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { PAYABLE_KINDS } from "@/lib/expenses/kinds";
import type { SupplierData } from "@/lib/validation/supplier";
import { normalizeForSearch } from "@/lib/utils";
import { ActionError, getAccess, requireGlobalCapability } from "./access";
import { diffFields, writeAudit } from "./audit";
import { db } from "./db";

/** Cari özet: kullanıcının harcamalarını görebildiği projelerdeki kayıtlardan. */
export type SupplierBalance = {
  invoiced: Decimal;
  paid: Decimal;
  unpaid: Decimal;
  advances: Decimal;
  count: number;
};

async function balances(supplierIds?: string[]): Promise<Map<string, SupplierBalance>> {
  const { scope } = await getAccess();
  const groups = await db.expense.groupBy({
    by: ["supplierId", "kind", "paymentStatus"],
    where: {
      ...projectIdsWithCapability(scope, "expense.viewAll"),
      deletedAt: null,
      approvalStatus: { not: "REJECTED" },
      kind: { in: [...PAYABLE_KINDS] },
      supplierId: supplierIds ? { in: supplierIds } : { not: null },
    },
    _sum: { totalAmountTry: true },
    _count: true,
  });
  const result = new Map<string, SupplierBalance>();
  for (const group of groups) {
    if (!group.supplierId) continue;
    const entry = result.get(group.supplierId) ?? {
      invoiced: new Decimal(0),
      paid: new Decimal(0),
      unpaid: new Decimal(0),
      advances: new Decimal(0),
      count: 0,
    };
    const sum = new Decimal(group._sum.totalAmountTry?.toString() ?? 0);
    entry.count += group._count;
    if (group.kind === "ADVANCE") entry.advances = entry.advances.plus(sum);
    else {
      entry.invoiced = entry.invoiced.plus(sum);
      if (group.paymentStatus === "PAID") entry.paid = entry.paid.plus(sum);
      else entry.unpaid = entry.unpaid.plus(sum);
    }
    result.set(group.supplierId, entry);
  }
  return result;
}

export async function listSuppliers(options: { query?: string; includeInactive?: boolean } = {}) {
  const { user } = await requireGlobalCapability("supplier.view");
  const suppliers = await db.supplier.findMany({
    where: options.includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
  const term = options.query ? normalizeForSearch(options.query.trim()) : "";
  const filtered = term
    ? suppliers.filter((s) => normalizeForSearch(`${s.name} ${s.taxNumber ?? ""}`).includes(term))
    : suppliers;
  const showBalances = hasCapability(user.role, "expense.viewAll");
  const sums = showBalances ? await balances(filtered.map((s) => s.id)) : new Map();
  return { suppliers: filtered.map((s) => ({ ...s, balance: sums.get(s.id) ?? null })), showBalances };
}

/** Harcama formundaki seçim listesi. */
export async function supplierOptions() {
  await getAccess();
  return db.supplier.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, taxNumber: true },
  });
}

export async function getSupplier(supplierId: string) {
  const { user, scope } = await requireGlobalCapability("supplier.view");
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return null;
  const canSeeAccount = hasCapability(user.role, "expense.viewAll");
  if (!canSeeAccount) return { supplier, balance: null, expenses: [], connections: [], contracts: [] };
  const [sums, expenses] = await Promise.all([
    balances([supplierId]),
    db.expense.findMany({
      where: { ...projectIdsWithCapability(scope, "expense.viewAll"), supplierId, deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        projectId: true,
        date: true,
        kind: true,
        documentType: true,
        documentNo: true,
        description: true,
        totalAmountTry: true,
        paymentStatus: true,
        dueDate: true,
        approvalStatus: true,
        project: { select: { name: true } },
        costItem: { select: { code: true, name: true } },
      },
    }),
  ]);
  const [connections, contracts] = await Promise.all([
    hasCapability(user.role, "connection.view")
      ? db.connection.findMany({ where: { supplierId }, orderBy: { date: "desc" }, select: { id: true, no: true, date: true, status: true, currency: true } })
      : [],
    db.subcontractContract.findMany({
      where: { supplierId, ...projectIdsWithCapability(scope, "contract.view") },
      orderBy: { date: "desc" },
      select: { id: true, projectId: true, no: true, title: true, status: true, project: { select: { name: true } } },
    }),
  ]);
  return { supplier, balance: sums.get(supplierId) ?? null, expenses, connections, contracts };
}

async function assertUniqueTaxNumber(taxNumber: string | null, exceptId?: string) {
  if (!taxNumber) return;
  const existing = await db.supplier.findFirst({
    where: { taxNumber, NOT: exceptId ? { id: exceptId } : undefined },
    select: { name: true },
  });
  if (existing) throw new ActionError(`Bu vergi numarası “${existing.name}” adına kayıtlı.`);
}

export async function createSupplier(data: SupplierData) {
  const { user } = await requireGlobalCapability("supplier.manage");
  await assertUniqueTaxNumber(data.taxNumber);
  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({ data });
    await writeAudit(tx, {
      userId: user.id,
      action: "create",
      entity: "Supplier",
      entityId: supplier.id,
      changes: { name: supplier.name, taxNumber: supplier.taxNumber },
    });
    return supplier;
  });
}

/** Harcama girerken listede olmayan tedarikçiyi hızlıca ekleme (şantiye dahil). */
export async function quickCreateSupplier(name: string, taxNumber: string | null) {
  const { user, scope } = await getAccess();
  const entryProjects = projectIdsWithCapability(scope, "expense.create").projectId?.in;
  const canCreate = hasCapability(user.role, "supplier.manage") || entryProjects === undefined || entryProjects.length > 0;
  if (!canCreate) throw new ActionError("Tedarikçi ekleme yetkiniz yok.");
  await assertUniqueTaxNumber(taxNumber);
  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({ data: { name, taxNumber, kind: "SUPPLIER" } });
    await writeAudit(tx, {
      userId: user.id,
      action: "create",
      entity: "Supplier",
      entityId: supplier.id,
      changes: { name, taxNumber, quick: true },
    });
    return { id: supplier.id, name: supplier.name, taxNumber: supplier.taxNumber };
  });
}

export async function updateSupplier(supplierId: string, data: SupplierData) {
  const { user } = await requireGlobalCapability("supplier.manage");
  const before = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!before) throw new ActionError("Tedarikçi bulunamadı.");
  await assertUniqueTaxNumber(data.taxNumber, supplierId);
  await db.$transaction(async (tx) => {
    await tx.supplier.update({ where: { id: supplierId }, data });
    await writeAudit(tx, {
      userId: user.id,
      action: before.active && !data.active ? "deactivate" : "update",
      entity: "Supplier",
      entityId: supplierId,
      changes: diffFields(before, data),
    });
  });
}
