"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { WalletIcon } from "lucide-react";
import { setPaidAction } from "@/app/(app)/projects/[projectId]/expenses/actions";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DUE_BUCKET_LABELS, type DueBucket } from "@/lib/expenses/payables";
import { DOCUMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import type { DocumentType } from "@/generated/prisma/enums";
import { Decimal, formatDateOnly, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PayableRow = {
  id: string;
  projectId: string;
  project: string;
  date: string;
  dueDate: string | null;
  bucket: DueBucket;
  supplier: string | null;
  costItem: string | null;
  documentType: DocumentType;
  documentNo: string | null;
  total: string;
  pendingApproval: boolean;
  canMarkPaid: boolean;
};

const ORDER: DueBucket[] = ["overdue", "thisWeek", "later", "noDueDate"];

export function PayablesTable({ rows, today }: { rows: PayableRow[]; today: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const selectedTotal = rows.filter((r) => selected.has(r.id)).reduce((s, r) => s.plus(r.total), new Decimal(0));

  return (
    <div className="grid grid-cols-1 gap-4">
      {selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2 shadow-sm md:top-12">
          <span className="px-1 text-sm">
            {selected.size} kayıt · {formatMoney(selectedTotal)}
          </span>
          <Button size="sm" onClick={() => setOpen(true)}>
            <WalletIcon />
            Ödendi işaretle
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Seçimi kaldır
          </Button>
        </div>
      )}
      {ORDER.map((bucket) => {
        const group = rows.filter((r) => r.bucket === bucket);
        if (group.length === 0) return null;
        const total = group.reduce((s, r) => s.plus(r.total), new Decimal(0));
        return (
          <Card key={bucket} className="gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className={cn("text-base", bucket === "overdue" && "text-destructive")}>
                {DUE_BUCKET_LABELS[bucket]} ({group.length})
              </CardTitle>
              <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 pl-4" />
                  <TableHead>Vade</TableHead>
                  <TableHead>Tedarikçi</TableHead>
                  <TableHead>Proje / kalem</TableHead>
                  <TableHead>Belge</TableHead>
                  <TableHead className="pr-4 text-right">Tutar (TL)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4">
                      {row.canMarkPaid && (
                        <Checkbox
                          aria-label="Seç"
                          checked={selected.has(row.id)}
                          onCheckedChange={(on) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (on === true) next.add(row.id);
                              else next.delete(row.id);
                              return next;
                            })
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.dueDate ? formatDateOnly(row.dueDate) : "—"}</TableCell>
                    <TableCell className="max-w-48 truncate">{row.supplier ?? "—"}</TableCell>
                    <TableCell className="max-w-64 truncate">
                      <Link href={`/projects/${row.projectId}/expenses/${row.id}`} className="hover:underline">
                        {row.project}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.costItem ?? "Avans"}
                        {row.pendingApproval && " · onay bekliyor"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {DOCUMENT_TYPE_LABELS[row.documentType]}
                      {row.documentNo && <span className="block text-xs text-muted-foreground">{row.documentNo}</span>}
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatMoney(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödendi olarak işaretle</DialogTitle>
            <DialogDescription>
              {selected.size} kayıt · {formatMoney(selectedTotal)}. Projelere bölünmüş faturaların tüm satırları birlikte işaretlenir.
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(undefined);
                  const result = await setPaidAction([...selected], { paid: true, paidAt, method });
                  if (!result.ok) setError(result.error);
                  else {
                    setSelected(new Set());
                    setOpen(false);
                  }
                })
              }
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
