"use client";

import { useState } from "react";
import { LinkIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/components/use-action";
import type { Currency } from "@/generated/prisma/enums";
import { formatDateOnly, formatNumber } from "@/lib/format";
import { CURRENCY_LABELS } from "@/lib/expenses/labels";
import { applyLearnedAction, matchInvoicesAction } from "../actions";
import { ResourceDialog, emptyResource } from "../library-panels";

export type MatchRow = {
  id: string;
  date: string;
  project: string;
  supplier: string | null;
  description: string | null;
  costItem: string | null;
  quantity: string | null;
  unit: string | null;
  unitPrice: string;
  currency: Currency;
  documentNo: string | null;
  suggestion: string | null;
};

export function MatchTable({
  rows,
  resources,
  suppliers,
  total,
}: {
  rows: MatchRow[];
  resources: { id: string; code: string; name: string; unit: string }[];
  suppliers: { id: string; name: string }[];
  total: number;
}) {
  const [choice, setChoice] = useState<Record<string, string | null>>(Object.fromEntries(rows.map((r) => [r.id, r.suggestion])));
  const [creating, setCreating] = useState<MatchRow | null>(null);
  const [message, setMessage] = useState<string>();
  const { run, error, pending } = useAction();
  const chosen = Object.entries(choice).filter(([, v]) => v);
  const learned = rows.filter((r) => r.suggestion).length;
  const options = resources.map((r) => ({ value: r.id, label: `${r.name} (${r.unit})`, hint: r.code }));

  return (
    <div className="grid grid-cols-1 gap-3">
      <FormError message={error} />
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pending || chosen.length === 0}
          onClick={() => run(() => matchInvoicesAction(chosen.map(([expenseId, resourceId]) => ({ expenseId, resourceId }))), (r) => setMessage(`${r.count} fatura eşleştirildi; fiyatları kütüphaneye yansıdı.`))}
        >
          <LinkIcon />
          Seçilenleri eşleştir ({chosen.length})
        </Button>
        {learned > 0 && (
          <Button variant="outline" disabled={pending} onClick={() => run(() => applyLearnedAction(), (r) => setMessage(`${r.count} fatura önceki eşleşmelere göre otomatik eşleştirildi.`))}>
            <SparklesIcon />
            Öğrenilenleri uygula
          </Button>
        )}
        <span className="text-sm text-muted-foreground">{total} eşleşmemiş fatura satırı{total > rows.length && ` (son ${rows.length} gösteriliyor)`}</span>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Fatura</TableHead>
              <TableHead>Açıklama / kalem</TableHead>
              <TableHead className="text-right">Miktar × birim fiyat</TableHead>
              <TableHead className="min-w-64 pr-4">Kütüphane kaynağı</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4">
                  <span className="whitespace-nowrap">{formatDateOnly(r.date)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[r.supplier, r.documentNo, r.project].filter(Boolean).join(" · ")}
                  </span>
                </TableCell>
                <TableCell className="max-w-64">
                  <span className="block truncate">{r.description ?? "—"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.costItem}</span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {r.quantity ? `${formatNumber(r.quantity, 4)} ${r.unit ?? ""} × ` : ""}
                  {formatNumber(r.unitPrice, 4)} {CURRENCY_LABELS[r.currency]}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <Combobox options={options} value={choice[r.id] ?? null} onChange={(v) => setChoice({ ...choice, [r.id]: v })} placeholder="Seçin" clearable />
                    </div>
                    <Button size="icon" variant="ghost" aria-label="Yeni kaynak olarak ekle" onClick={() => setCreating(r)}>
                      <PlusIcon />
                    </Button>
                  </div>
                  {r.suggestion && choice[r.id] === r.suggestion && <span className="text-xs text-muted-foreground">Önceki eşleşmeden önerildi</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ResourceDialog
        open={creating !== null}
        onOpenChange={(open) => !open && setCreating(null)}
        resourceId={null}
        suppliers={suppliers}
        initial={creating ? { ...emptyResource, name: creating.description ?? "", unit: creating.unit ?? "" } : emptyResource}
        onSaved={(id) => creating && setChoice((c) => ({ ...c, [creating.id]: id }))}
      />
    </div>
  );
}
