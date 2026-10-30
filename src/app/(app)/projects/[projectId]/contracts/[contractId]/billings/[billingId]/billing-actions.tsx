"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckIcon, PencilIcon, SendIcon, Trash2Icon, Undo2Icon, WalletIcon, XIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentStatus, ProgressBillingStatus } from "@/generated/prisma/enums";
import type { ActionFailure } from "@/lib/action-result";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { billingAction, rejectBillingAction, setBillingPaidAction } from "../../../actions";

export function BillingActions({
  projectId,
  contractId,
  billingId,
  status,
  paymentStatus,
  canEdit,
  canApprove,
  canPay,
  canPrepare,
  isLatest,
  today,
}: {
  projectId: string;
  contractId: string;
  billingId: string;
  status: ProgressBillingStatus;
  paymentStatus: PaymentStatus;
  canEdit: boolean;
  canApprove: boolean;
  canPay: boolean;
  canPrepare: boolean;
  isLatest: boolean;
  today: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState<"reject" | "pay" | "delete" | null>(null);
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [pending, startTransition] = useTransition();
  const base = `/projects/${projectId}/contracts/${contractId}`;
  const run = (action: () => Promise<{ ok: true } | ActionFailure>, after?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const result = await action();
      if (!result.ok) return setError(result.error);
      setDialog(null);
      after?.();
      router.refresh();
    });

  return (
    <div className="grid gap-2">
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button asChild variant="outline">
            <Link href={`${base}/billings/${billingId}/edit`}>
              <PencilIcon />
              Düzenle
            </Link>
          </Button>
        )}
        {status === "DRAFT" && canPrepare && (
          <Button onClick={() => run(() => billingAction(projectId, billingId, "submit"))} disabled={pending}>
            <SendIcon />
            Onaya gönder
          </Button>
        )}
        {status !== "APPROVED" && canApprove && (
          <Button onClick={() => run(() => billingAction(projectId, billingId, "approve"))} disabled={pending}>
            <CheckIcon />
            Onayla
          </Button>
        )}
        {status === "PENDING" && canApprove && (
          <Button variant="outline" onClick={() => setDialog("reject")} disabled={pending}>
            <XIcon />
            Geri gönder
          </Button>
        )}
        {status === "APPROVED" && canPay && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => (paymentStatus === "PAID" ? run(() => setBillingPaidAction(projectId, billingId, { paid: false })) : setDialog("pay"))}
          >
            <WalletIcon />
            {paymentStatus === "PAID" ? "Ödenmedi olarak işaretle" : "Ödendi işaretle"}
          </Button>
        )}
        {status === "APPROVED" && canApprove && isLatest && paymentStatus === "UNPAID" && (
          <Button variant="ghost" onClick={() => run(() => billingAction(projectId, billingId, "revert"))} disabled={pending}>
            <Undo2Icon />
            Onayı geri al
          </Button>
        )}
        {status !== "APPROVED" && canPrepare && (
          <Button variant="ghost" className="text-destructive" onClick={() => setDialog("delete")} disabled={pending}>
            <Trash2Icon />
            Sil
          </Button>
        )}
      </div>

      <Dialog open={dialog === "reject"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hakedişi geri gönder</DialogTitle>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Kalıp metrajı tutanakla uyuşmuyor" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => run(() => rejectBillingAction(projectId, billingId, note))}>
              Geri gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "pay"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Net ödeme yapıldı</DialogTitle>
          </DialogHeader>
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
            <Button disabled={pending} onClick={() => run(() => setBillingPaidAction(projectId, billingId, { paid: true, paidAt, method }))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hakedişi sil</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => run(() => billingAction(projectId, billingId, "delete"), () => router.push(base))}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
