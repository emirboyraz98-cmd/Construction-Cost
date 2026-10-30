// Harcama kayıtlarına erişim kuralları (saf). Projeye erişim ayrıca proje kapsamıyla denetlenir.
import type { ApprovalStatus, ExpenseKind, Role } from "@/generated/prisma/enums";
import { hasCapability } from "../auth/roles";

/**
 * Projedeki hangi harcamaları görebilir: null → hiçbiri, {} → hepsi,
 * { createdById } → yalnızca kendi girdikleri (ör. şantiye şefi "son girişlerim").
 */
export function expenseVisibility(role: Role | null, userId: string): { createdById?: string } | null {
  if (hasCapability(role, "expense.viewAll")) return {};
  if (hasCapability(role, "expense.create")) return { createdById: userId };
  return null;
}

type ExpenseRef = { createdById: string; approvalStatus: ApprovalStatus; kind: ExpenseKind };

/**
 * Düzeltme/silme: ofis (yönetici, muhasebe) her kaydı; giren kişi onaylanmamış kendi kaydını.
 * Hakediş ve transfer satırları kendi ekranlarından yönetilir (hakedişin onayı geri alınır,
 * transfer silinir); burada değiştirilemez.
 */
export function canModifyExpense(role: Role | null, userId: string, expense: ExpenseRef): boolean {
  if (expense.kind === "PROGRESS" || expense.kind === "TRANSFER") return false;
  if (hasCapability(role, "expense.manage")) return true;
  return (
    hasCapability(role, "expense.create") &&
    expense.createdById === userId &&
    expense.approvalStatus !== "APPROVED"
  );
}

/** Onay yetkisi olanın girdiği kayıt doğrudan onaylı başlar; diğerleri ofis onayını bekler. */
export function initialApprovalStatus(role: Role | null): ApprovalStatus {
  return hasCapability(role, "expense.approve") ? "APPROVED" : "PENDING";
}
