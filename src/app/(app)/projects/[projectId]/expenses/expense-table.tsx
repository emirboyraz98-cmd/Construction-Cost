"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckIcon, PaperclipIcon, WalletIcon, XIcon } from "lucide-react";
import { ApprovalBadge, PaymentBadge } from "@/components/expenses/badges";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalStatus, Currency, DocumentType, ExpenseKind, PaymentStatus } from "@/generated/prisma/enums";
import { CURRENCY_LABELS, DOCUMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { approveExpensesAction, rejectExpensesAction, setPaidAction } from "./actions";

export type ExpenseRow = {
  id: string;
  date: string;
  kind: ExpenseKind;
  description: string | null;
  currency: Currency;
  totalAmount: string;
  totalAmountTry: string;
  documentType: DocumentType;
  documentNo: string | null;
  paymentStatus: PaymentStatus;
  dueDate: string | null;
  overdue: boolean;
  approvalStatus: ApprovalStatus;
  costItem: string | null;
  supplier: string | null;
  block: string | null;
  createdBy: string;
  documents: number;
  split: boolean;
};

export function ExpenseTable({
  projectId,
  rows,
  canApprove,
  canManage,
  today,
}: {
  projectId: string;
  rows: ExpenseRow[];
  canApprove: boolean;
  canManage: boolean;
  today: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"reject" | "pay" | null>(null);
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const selectable = canApprove || canManage;
  const ids = [...selected];

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function run(action: () => Promise<{ ok: boolean; error?: string; count?: number }>, done: string) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`${result.count ?? ids.length} kayıt ${done}.`);
      setSelected(new Set());
      setDialog(null);
    });
  }

  const amount = (row: ExpenseRow) => (
    <span className="tabular-nums">
      {formatMoney(row.totalAmountTry)}
      {row.currency !== "TRY" && (
        <span className="block text-xs text-muted-foreground">
          {formatMoney(row.totalAmount, row.currency)} {CURRENCY_LABELS[row.currency]}
        </span>
      )}
    </span>
  );

  return (
    <div className="grid grid-cols-1 gap-3">
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      <FormError message={error} />
      {selectable && selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2 shadow-sm md:top-12">
          <span className="px-1 text-sm">{selected.size} kayıt seçili</span>
          {canApprove && (
            <>
              <Button size="sm" onClick={() => run(() => approveExpensesAction(projectId, ids), "onaylandı")} disabled={pending}>
                <CheckIcon />
                Onayla
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog("reject")} disabled={pending}>
                <XIcon />
                Reddet
              </Button>
            </>
          )}
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setDialog("pay")} disabled={pending}>
              <WalletIcon />
              Ödendi işaretle
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Seçimi kaldır
          </Button>
        </div>
      )}

      <Card className="hidden py-0 md:flex">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-8 pl-4">
                  <Checkbox
                    aria-label="Tümünü seç"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onCheckedChange={(on) => setSelected(on === true ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </TableHead>
              )}
              <TableHead className={cn(!selectable && "pl-4")}>Tarih</TableHead>
              <TableHead>Kalem</TableHead>
              <TableHead>Tedarikçi</TableHead>
              <TableHead>Belge</TableHead>
              <TableHead className="text-right">Toplam (TL)</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="pr-4">Ödeme</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined} className="data-[state=selected]:bg-muted">
                {selectable && (
                  <TableCell className="pl-4">
                    <Checkbox aria-label="Seç" checked={selected.has(row.id)} onCheckedChange={(on) => toggle(row.id, on === true)} />
                  </TableCell>
                )}
                <TableCell className={cn(!selectable && "pl-4")}>
                  <Link href={`/projects/${projectId}/expenses/${row.id}`} className="font-medium hover:underline">
                    {formatDateOnly(row.date)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-64 truncate" title={row.costItem ?? undefined}>
                  <Link href={`/projects/${projectId}/expenses/${row.id}`} className="hover:underline">
                    {row.costItem ?? (row.kind === "ADVANCE" ? "Avans" : "—")}
                  </Link>
                  {(row.description || row.block) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {[row.block, row.description].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-48 truncate">{row.supplier ?? "—"}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    {DOCUMENT_TYPE_LABELS[row.documentType]}
                    {row.documents > 0 ? (
                      <PaperclipIcon className="size-3.5 text-muted-foreground" aria-label={`${row.documents} belge`} />
                    ) : row.documentType !== "NONE" ? (
                      <span className="text-xs text-amber-700" title="Belge fotoğrafı eklenmemiş">
                        (belgesiz)
                      </span>
                    ) : null}
                  </span>
                  {row.documentNo && <span className="block text-xs text-muted-foreground">{row.documentNo}</span>}
                </TableCell>
                <TableCell className="text-right">{amount(row)}</TableCell>
                <TableCell>
                  <ApprovalBadge status={row.approvalStatus} />
                </TableCell>
                <TableCell className="pr-4">
                  <PaymentBadge status={row.paymentStatus} overdue={row.overdue} />
                  {row.paymentStatus === "UNPAID" && row.dueDate && (
                    <span className="block text-xs text-muted-foreground">Vade {formatDateOnly(row.dueDate)}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ul className="grid grid-cols-1 gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2 rounded-lg border bg-card p-3">
            {selectable && (
              <Checkbox className="mt-1" aria-label="Seç" checked={selected.has(row.id)} onCheckedChange={(on) => toggle(row.id, on === true)} />
            )}
            <Link href={`/projects/${projectId}/expenses/${row.id}`} className="grid min-w-0 flex-1 grid-cols-1 gap-1">
              <span className="flex items-start justify-between gap-2">
                <span className="truncate font-medium">{row.costItem ?? "Avans"}</span>
                <span className="shrink-0 text-right font-semibold">{amount(row)}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {formatDateOnly(row.date)} · {row.supplier ?? "Tedarikçi yok"}
                {row.documents === 0 && row.documentType !== "NONE" && " · belgesiz"}
              </span>
              <span className="flex flex-wrap gap-1">
                <ApprovalBadge status={row.approvalStatus} />
                <PaymentBadge status={row.paymentStatus} overdue={row.overdue} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Dialog open={dialog === "reject"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected.size} kaydı reddet</DialogTitle>
          </DialogHeader>
          <FormError message={error} />
          <FormField id="note" label="Neden (giren kişi görür)" required>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={() => run(() => rejectExpensesAction(projectId, ids, note), "reddedildi")} disabled={pending}>
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "pay"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected.size} kaydı ödendi işaretle</DialogTitle>
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
            <Button onClick={() => run(() => setPaidAction(ids, { paid: true, paidAt, method }), "ödendi olarak işaretlendi")} disabled={pending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
