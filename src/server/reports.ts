import "server-only";
import Decimal from "decimal.js";
import type { ApprovalStatus } from "@/generated/prisma/enums";
import { projectIdsWithCapability, projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { compareCodes } from "@/lib/cost-tree/tree";
import { COST_KINDS, PAYABLE_KINDS } from "@/lib/expenses/kinds";
import { DOCUMENT_TYPE_LABELS } from "@/lib/expenses/labels";
import { dueBucket, type DueBucket } from "@/lib/expenses/payables";
import { ActionError, getAccess } from "./access";
import { db } from "./db";

const zero = () => new Decimal(0);
const dec = (value: { toString(): string } | null | undefined) => new Decimal(value?.toString() ?? 0);

type Sum = { net: Decimal; vat: Decimal; total: Decimal; count: number };
const emptySum = (): Sum => ({ net: zero(), vat: zero(), total: zero(), count: 0 });
type Amounts = { netAmountTry: { toString(): string }; vatAmountTry: { toString(): string }; totalAmountTry: { toString(): string } };
function add(sum: Sum, row: Amounts) {
  sum.net = sum.net.plus(dec(row.netAmountTry));
  sum.vat = sum.vat.plus(dec(row.vatAmountTry));
  sum.total = sum.total.plus(dec(row.totalAmountTry));
  sum.count += 1;
}

/**
 * Proje harcama raporu: ay, maliyet kalemi (ana grup → kalem), tedarikçi ve blok bazında.
 * Tutarlar TL; avanslar maliyete katılmaz, ayrıca gösterilir. Bütçe olmadan da çalışır.
 */
export async function projectExpenseReport(
  projectId: string,
  options: { from: Date | null; to: Date | null; includePending: boolean },
) {
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "expense.viewAll")) {
    throw new ActionError("Bu projenin harcama raporlarını görme yetkiniz yok.");
  }
  const statuses: ApprovalStatus[] = options.includePending ? ["APPROVED", "PENDING"] : ["APPROVED"];
  const [rows, items, suppliers, blocks] = await Promise.all([
    db.expense.findMany({
      where: {
        projectId,
        deletedAt: null,
        approvalStatus: { in: statuses },
        date: options.from || options.to ? { gte: options.from ?? undefined, lte: options.to ?? undefined } : undefined,
      },
      select: {
        date: true,
        kind: true,
        costItemId: true,
        supplierId: true,
        blockId: true,
        netAmountTry: true,
        vatAmountTry: true,
        totalAmountTry: true,
      },
    }),
    db.costItem.findMany({ where: { projectId }, select: { id: true, parentId: true, code: true, name: true } }),
    db.supplier.findMany({ select: { id: true, name: true } }),
    db.block.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);

  const itemById = new Map(items.map((item) => [item.id, item]));
  const topOf = (id: string) => {
    let current = itemById.get(id);
    while (current?.parentId) current = itemById.get(current.parentId);
    return current;
  };

  const totals = emptySum();
  const advances = emptySum();
  const byMonth = new Map<string, Sum>();
  const byGroup = new Map<string, { code: string; name: string; sum: Sum; items: Map<string, { code: string; name: string; sum: Sum }> }>();
  const bySupplier = new Map<string | null, Sum>();
  const byBlock = new Map<string | null, Sum>();

  for (const row of rows) {
    if (row.kind === "ADVANCE") {
      add(advances, row);
      continue;
    }
    add(totals, row);
    const month = row.date.toISOString().slice(0, 7);
    add(byMonth.get(month) ?? byMonth.set(month, emptySum()).get(month)!, row);

    const item = row.costItemId ? itemById.get(row.costItemId) : undefined;
    const top = row.costItemId ? topOf(row.costItemId) : undefined;
    const groupKey = top?.id ?? "-";
    const group =
      byGroup.get(groupKey) ??
      byGroup
        .set(groupKey, { code: top?.code ?? "—", name: top?.name ?? "Kalemsiz", sum: emptySum(), items: new Map() })
        .get(groupKey)!;
    add(group.sum, row);
    const itemKey = item?.id ?? "-";
    const leaf =
      group.items.get(itemKey) ??
      group.items.set(itemKey, { code: item?.code ?? "—", name: item?.name ?? "Kalemsiz", sum: emptySum() }).get(itemKey)!;
    add(leaf.sum, row);

    add(bySupplier.get(row.supplierId) ?? bySupplier.set(row.supplierId, emptySum()).get(row.supplierId)!, row);
    add(byBlock.get(row.blockId) ?? byBlock.set(row.blockId, emptySum()).get(row.blockId)!, row);
  }

  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const blockName = new Map(blocks.map((b) => [b.id, b.name]));
  return {
    totals,
    advances,
    byMonth: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, sum]) => ({ month, sum })),
    byGroup: [...byGroup.values()]
      .sort((a, b) => compareCodes(a.code.replace("—", "99"), b.code.replace("—", "99")))
      .map((group) => ({
        ...group,
        items: [...group.items.values()].sort((a, b) => compareCodes(a.code.replace("—", "99"), b.code.replace("—", "99"))),
      })),
    bySupplier: [...bySupplier.entries()]
      .map(([id, sum]) => ({ id, name: id ? (supplierName.get(id) ?? "?") : "Tedarikçi belirtilmemiş", sum }))
      .sort((a, b) => b.sum.net.comparedTo(a.sum.net)),
    byBlock: [...byBlock.entries()]
      .map(([id, sum]) => ({ id, name: id ? (blockName.get(id) ?? "?") : "Ortak / bloğa atanmamış", sum }))
      .sort((a, b) => b.sum.net.comparedTo(a.sum.net)),
  };
}

/** Portföy ve proje paneli: proje başına onaylı harcama (KDV hariç / dahil), bekleyen ve ödenmemiş. */
export async function spendSummaries() {
  const { scope } = await getAccess();
  const where = { ...projectIdsWithCapability(scope, "expense.viewAll"), deletedAt: null };
  const [approved, pending, unpaid] = await Promise.all([
    db.expense.groupBy({
      by: ["projectId"],
      where: { ...where, kind: { in: [...COST_KINDS] }, approvalStatus: "APPROVED" },
      _sum: { netAmountTry: true, totalAmountTry: true },
    }),
    db.expense.groupBy({ by: ["projectId"], where: { ...where, kind: { notIn: ["PROGRESS", "TRANSFER"] }, approvalStatus: "PENDING" }, _count: true }),
    db.expense.groupBy({
      by: ["projectId"],
      where: { ...where, kind: { in: [...PAYABLE_KINDS] }, approvalStatus: { not: "REJECTED" }, paymentStatus: "UNPAID" },
      _sum: { totalAmountTry: true },
    }),
  ]);
  const result = new Map<string, { net: Decimal; total: Decimal; pending: number; unpaid: Decimal }>();
  const get = (projectId: string) =>
    result.get(projectId) ??
    result.set(projectId, { net: zero(), total: zero(), pending: 0, unpaid: zero() }).get(projectId)!;
  for (const row of approved) {
    const entry = get(row.projectId);
    entry.net = dec(row._sum.netAmountTry);
    entry.total = dec(row._sum.totalAmountTry);
  }
  for (const row of pending) get(row.projectId).pending = row._count;
  for (const row of unpaid) get(row.projectId).unpaid = dec(row._sum.totalAmountTry);
  return { summaries: result, visibleProjects: projectIdsWithCapability(scope, "expense.viewAll") };
}

export type PayableSource = "expense" | "connection" | "billing";

export type PayableItem = {
  key: string;
  source: PayableSource;
  id: string;
  projectId: string | null;
  project: string;
  date: Date;
  dueDate: Date | null;
  bucket: DueBucket;
  supplier: string | null;
  label: string;
  documentLabel: string;
  documentNo: string | null;
  totalTry: Decimal;
  pendingApproval: boolean;
  canMarkPaid: boolean;
  href: string;
};

/**
 * Vade listesi: ödenmemiş harcama ve avanslar, bağlantı ödeme planı satırları ve onaylı
 * hakedişlerin net ödemesi; vadeye göre gruplanır. Bağlantı ödemeleri şirket geneli olduğundan
 * proje filtresinde görünmez.
 */
export async function listPayables(options: { projectId?: string | null; bucket?: DueBucket | null } = {}): Promise<PayableItem[]> {
  const { user, scope } = await getAccess();
  const seeConnections = hasCapability(user.role, "connection.view") && !options.projectId;
  const projectFilter = {
    ...projectIdsWithCapability(scope, "expense.viewAll"),
    ...(options.projectId ? { projectId: options.projectId } : {}),
  };
  const [expenses, payments, billings] = await Promise.all([
    db.expense.findMany({
      where: {
        ...projectFilter,
        deletedAt: null,
        kind: { in: [...PAYABLE_KINDS] },
        paymentStatus: "UNPAID",
        approvalStatus: { not: "REJECTED" },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { date: "asc" }],
      take: 1000,
      select: {
        id: true,
        projectId: true,
        date: true,
        dueDate: true,
        kind: true,
        documentType: true,
        documentNo: true,
        totalAmountTry: true,
        approvalStatus: true,
        project: { select: { name: true } },
        supplier: { select: { name: true } },
        costItem: { select: { code: true, name: true } },
      },
    }),
    seeConnections
      ? db.connectionPayment.findMany({
          where: { paymentStatus: "UNPAID", connection: { status: { not: "CANCELLED" } } },
          orderBy: { dueDate: "asc" },
          take: 500,
          include: { connection: { select: { id: true, no: true, createdAt: true, supplier: { select: { name: true } } } } },
        })
      : [],
    db.progressBilling.findMany({
      where: { ...projectFilter, status: "APPROVED", paymentStatus: "UNPAID" },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { date: "asc" }],
      take: 500,
      include: { project: { select: { name: true } }, contract: { select: { no: true, title: true, supplier: { select: { name: true } } } } },
    }),
  ]);
  const today = new Date();
  const items: PayableItem[] = [
    ...expenses.map((row) => ({
      key: `expense:${row.id}`,
      source: "expense" as const,
      id: row.id,
      projectId: row.projectId,
      project: row.project.name,
      date: row.date,
      dueDate: row.dueDate,
      bucket: dueBucket(row.dueDate, today),
      supplier: row.supplier?.name ?? null,
      label: row.costItem ? `${row.costItem.code} ${row.costItem.name}` : "Avans",
      documentLabel: DOCUMENT_TYPE_LABELS[row.documentType],
      documentNo: row.documentNo,
      totalTry: dec(row.totalAmountTry),
      pendingApproval: row.approvalStatus === "PENDING",
      canMarkPaid: hasCapability(projectRole(scope, row.projectId), "expense.manage"),
      href: `/projects/${row.projectId}/expenses/${row.id}`,
    })),
    ...payments.map((p) => ({
      key: `connection:${p.id}`,
      source: "connection" as const,
      id: p.id,
      projectId: null,
      project: "Şirket geneli",
      date: p.connection.createdAt,
      dueDate: p.dueDate,
      bucket: dueBucket(p.dueDate, today),
      supplier: p.connection.supplier.name,
      label: `Bağlantı ${p.connection.no}${p.description ? ` · ${p.description}` : ""}`,
      documentLabel: "Bağlantı ödemesi",
      documentNo: p.instrumentNo,
      totalTry: dec(p.amountTry),
      pendingApproval: false,
      canMarkPaid: hasCapability(user.role, "connection.manage"),
      href: `/company/connections/${p.connection.id}`,
    })),
    ...billings.map((b) => ({
      key: `billing:${b.id}`,
      source: "billing" as const,
      id: b.id,
      projectId: b.projectId,
      project: b.project.name,
      date: b.date,
      dueDate: b.dueDate,
      bucket: dueBucket(b.dueDate, today),
      supplier: b.contract.supplier.name,
      label: `${b.contract.title} – ${b.seq}. hakediş`,
      documentLabel: "Hakediş (net)",
      documentNo: `${b.contract.no}/${b.seq}`,
      totalTry: dec(b.payableAmount),
      pendingApproval: false,
      canMarkPaid: hasCapability(projectRole(scope, b.projectId), "expense.manage"),
      href: `/projects/${b.projectId}/contracts/${b.contractId}/billings/${b.id}`,
    })),
  ].sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) || a.date.getTime() - b.date.getTime());
  return options.bucket ? items.filter((row) => row.bucket === options.bucket) : items;
}
