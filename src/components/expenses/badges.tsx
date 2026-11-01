import { Badge } from "@/components/ui/badge";
import type { ApprovalStatus, ExpenseKind, PaymentStatus } from "@/generated/prisma/enums";
import { isPayableKind } from "@/lib/expenses/kinds";
import { APPROVAL_STATUS_LABELS, EXPENSE_KIND_SHORT, PAYMENT_STATUS_LABELS } from "@/lib/expenses/labels";
import { cn } from "@/lib/utils";

const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-300 bg-red-50 text-red-700",
};

export function ApprovalBadge({ status, className }: { status: ApprovalStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(APPROVAL_STYLES[status], className)}>
      {APPROVAL_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentBadge({ status, overdue, className }: { status: PaymentStatus; overdue?: boolean; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "PAID" ? "border-sky-300 bg-sky-50 text-sky-800" : overdue ? "border-red-300 bg-red-50 text-red-700" : "",
        className,
      )}
    >
      {status === "UNPAID" && overdue ? "Vadesi geçti" : PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Ödemesi izlenen türlerde ödeme durumu; çekiş / hakediş / transferde türün adı. */
export function PaymentOrKindBadge({ kind, status, overdue }: { kind: ExpenseKind; status: PaymentStatus; overdue?: boolean }) {
  if (isPayableKind(kind)) return <PaymentBadge status={status} overdue={overdue} />;
  return (
    <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-800">
      {EXPENSE_KIND_SHORT[kind]}
    </Badge>
  );
}
