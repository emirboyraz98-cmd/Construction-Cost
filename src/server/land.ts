import "server-only";
import Decimal from "decimal.js";
import { hasCapability } from "@/lib/auth/roles";
import { computeExpenseAmounts } from "@/lib/expenses/amounts";
import { ActionError, requireProjectAccess, requireProjectCapability } from "./access";
import { writeAudit } from "./audit";
import { db } from "./db";

// Arsa satın alma ödeme planı (PLAN.md 5.3, 11 #11): 01 grubu ödemeleri vade sırasıyla; taksitler
// 01.01 kalemine vadeli harcama olarak girilir, böylece vade listesi ve nakit akışına kendiliğinden yansır.

export async function landPayments(projectId: string) {
  const { role } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "expense.viewAll")) return null;
  const rows = await db.expense.findMany({
    where: { projectId, deletedAt: null, kind: { in: ["EXPENSE", "ADVANCE"] }, approvalStatus: { not: "REJECTED" }, costItem: { code: { startsWith: "01" } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "first" } }, { date: "asc" }],
    select: { id: true, date: true, dueDate: true, paidAt: true, paymentStatus: true, totalAmountTry: true, description: true, costItem: { select: { code: true, name: true } }, supplier: { select: { name: true } } },
  });
  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((s, r) => s.plus(r.totalAmountTry.toString()), new Decimal(0));
  return { rows, paid: sum((r) => r.paymentStatus === "PAID"), unpaid: sum((r) => r.paymentStatus !== "PAID"), canAdd: hasCapability(role, "expense.manage") };
}

export async function addLandInstallment(projectId: string, data: { dueDate: Date; amount: Decimal; vatRate: Decimal; description: string | null; supplierId: string | null }) {
  const { user } = await requireProjectCapability(projectId, "expense.manage");
  const item = await db.costItem.findFirst({ where: { projectId, code: "01.01" }, select: { id: true } });
  if (!item) throw new ActionError("Projede 01.01 Arsa bedeli kalemi yok (Maliyet ağacından ekleyin).");
  const amounts = computeExpenseAmounts({ mode: "total", amount: data.amount, includesVat: true, vatRate: data.vatRate, exchangeRate: new Decimal(1) });
  await db.$transaction(async (tx) => {
    const e = await tx.expense.create({
      data: {
        projectId,
        costItemId: item.id,
        supplierId: data.supplierId,
        kind: "EXPENSE",
        date: data.dueDate,
        dueDate: data.dueDate,
        description: data.description ?? "Arsa bedeli taksiti",
        vatRate: data.vatRate,
        ...amounts,
        documentType: "NONE",
        paymentStatus: "UNPAID",
        approvalStatus: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        createdById: user.id,
      },
    });
    await writeAudit(tx, { userId: user.id, projectId, action: "create", entity: "Expense", entityId: e.id, changes: { arsaTaksiti: data.amount.toString(), vade: data.dueDate.toISOString().slice(0, 10) } });
  });
}
