"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LinkIcon, UnlinkIcon } from "lucide-react";
import { PaymentBadge } from "@/components/expenses/badges";
import { FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { ContractStatus, PaymentStatus } from "@/generated/prisma/enums";
import type { ActionFailure } from "@/lib/action-result";
import { CONTRACT_STATUS_LABELS } from "@/lib/connections/labels";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { linkContractAdvanceAction, setContractStatusAction } from "../actions";

function useRun() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: true } | ActionFailure>) =>
    startTransition(async () => {
      setError(undefined);
      const result = await action();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  return { run, error, pending };
}

export function ContractStatusSelect({ projectId, contractId, status }: { projectId: string; contractId: string; status: ContractStatus }) {
  const { run, error, pending } = useRun();
  return (
    <div className="grid gap-1">
      <NativeSelect aria-label="Sözleşme durumu" className="w-40" value={status} disabled={pending} onChange={(e) => run(() => setContractStatusAction(projectId, contractId, e.target.value))}>
        {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <FormError message={error} />
    </div>
  );
}

type Advance = { id: string; date: string; amount: string; documentNo: string | null; paymentStatus: PaymentStatus };

export function ContractAdvances({
  projectId,
  contractId,
  linked,
  linkable,
  canManage,
}: {
  projectId: string;
  contractId: string;
  linked: Advance[];
  linkable: Advance[];
  canManage: boolean;
}) {
  const { run, error, pending } = useRun();
  const row = (a: Advance, action: React.ReactNode) => (
    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
      <a href={`/projects/${projectId}/expenses/${a.id}`} className="hover:underline">
        {formatDateOnly(a.date)}
        {a.documentNo && ` · ${a.documentNo}`}
      </a>
      <span className="flex items-center gap-2">
        <PaymentBadge status={a.paymentStatus} />
        <span className="tabular-nums">{formatMoney(a.amount)}</span>
        {action}
      </span>
    </li>
  );
  return (
    <div className="grid gap-3">
      <FormError message={error} />
      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bağlı avans yok. Harcamalar ekranında “Avans” olarak girilen ödeme buraya bağlanır; ödenenler hakedişlerde mahsup edilir.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {linked.map((a) =>
            row(
              a,
              canManage && (
                <Button size="icon" variant="ghost" aria-label="Bağlantıyı kaldır" disabled={pending} onClick={() => run(() => linkContractAdvanceAction(projectId, a.id, null))}>
                  <UnlinkIcon />
                </Button>
              ),
            ),
          )}
        </ul>
      )}
      {canManage && linkable.length > 0 && (
        <>
          <p className="text-sm font-medium">Bağlanabilecek avanslar (bu taşerona, TL)</p>
          <ul className="grid grid-cols-1 gap-2">
            {linkable.map((a) =>
              row(
                a,
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => linkContractAdvanceAction(projectId, a.id, contractId))}>
                  <LinkIcon />
                  Bağla
                </Button>,
              ),
            )}
          </ul>
        </>
      )}
    </div>
  );
}
