"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckIcon, CopyIcon, LoaderCircleIcon, PencilIcon, Trash2Icon, WalletIcon, XIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalStatus, PaymentStatus } from "@/generated/prisma/enums";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { approveExpensesAction, deleteExpenseAction, rejectExpensesAction, setPaidAction } from "../actions";

export function ExpenseActions({
  projectId,
  expenseId,
  approvalStatus,
  paymentStatus,
  canModify,
  canApprove,
  canManage,
  canCopy,
  isSplit,
  today,
}: {
  projectId: string;
  expenseId: string;
  approvalStatus: ApprovalStatus;
  paymentStatus: PaymentStatus;
  canModify: boolean;
  canApprove: boolean;
  canManage: boolean;
  canCopy: boolean;
  isSplit: boolean;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState<"reject" | "delete" | "pay" | null>(null);
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState("BANK_TRANSFER");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else {
        setDialog(null);
        after?.();
      }
    });
  }

  return (
    <div className="grid gap-2">
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        {canApprove && approvalStatus !== "APPROVED" && (
          <Button onClick={() => run(() => approveExpensesAction(projectId, [expenseId]))} disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
            Onayla
          </Button>
        )}
        {canApprove && approvalStatus !== "REJECTED" && (
          <Button variant="outline" onClick={() => setDialog("reject")} disabled={pending}>
            <XIcon />
            Reddet
          </Button>
        )}
        {canManage && (
          <Button
            variant="outline"
            onClick={() =>
              paymentStatus === "PAID"
                ? run(() => setPaidAction([expenseId], { paid: false }))
                : setDialog("pay")
            }
            disabled={pending}
          >
            <WalletIcon />
            {paymentStatus === "PAID" ? "Ödenmedi olarak işaretle" : "Ödendi işaretle"}
          </Button>
        )}
        {canModify && (
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/expenses/${expenseId}/edit`}>
              <PencilIcon />
              Düzenle
            </Link>
          </Button>
        )}
        {canCopy && !isSplit && (
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/expenses/new?copy=${expenseId}`}>
              <CopyIcon />
              Benzerini gir
            </Link>
          </Button>
        )}
        {canModify && (
          <Button variant="ghost" className="text-destructive" onClick={() => setDialog("delete")} disabled={pending}>
            <Trash2Icon />
            Sil
          </Button>
        )}
      </div>

      <Dialog open={dialog === "reject"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Harcamayı reddet</DialogTitle>
            <DialogDescription>Neden yazın; kaydı giren kişi görür ve düzeltip yeniden gönderebilir.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Fiş okunmuyor, tutar yanlış" maxLength={500} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={() => run(() => rejectExpensesAction(projectId, [expenseId], note))} disabled={pending}>
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "pay"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödendi olarak işaretle</DialogTitle>
            {isSplit && <DialogDescription>Fatura projelere bölünmüş; tüm satırları birlikte ödenmiş sayılır.</DialogDescription>}
          </DialogHeader>
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="paidAt" label="Ödeme tarihi">
              <Input id="paidAt" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </FormField>
            <FormField id="method" label="Ödeme şekli">
              <NativeSelect id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => run(() => setPaidAction([expenseId], { paid: true, paidAt, method }))} disabled={pending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Harcamayı sil</DialogTitle>
            <DialogDescription>
              {isSplit
                ? "Bu fatura birden fazla projeye bölünmüş; tüm projelerdeki satırları silinir."
                : "Kayıt listelerden ve raporlardan kalkar; değişiklik geçmişinde iz kalır."}
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => deleteExpenseAction(projectId, expenseId), () => router.push(`/projects/${projectId}/expenses`))}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
