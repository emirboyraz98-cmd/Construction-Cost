"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import { FormField } from "@/components/form-field";
import { FormMore } from "@/components/form-more";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { InstallmentKind } from "@/generated/prisma/enums";
import { dateInputToDate, dateToDateInput, Decimal, formatMoney, formatNumber, parseDecimalInput } from "@/lib/format";
import { INSTALLMENT_KIND_LABELS } from "@/lib/sales/labels";
import { addMonths, buildPlan } from "@/lib/sales/sales";
import { cn } from "@/lib/utils";

export type PlanRowInput = { dueDate: string; amount: string; kind: InstallmentKind; note: string };

const toDec = (v: string) => {
  const r = parseDecimalInput(v);
  return r.ok && r.value ? r.value : new Decimal(0);
};

/** Ödeme planı: hızlı oluşturucu (peşinat + eşit taksit + sabit ödemeler) ve satır satır düzenleme. */
export function PlanEditor({ rows, onChange, total, currency, startDate, error }: { rows: PlanRowInput[]; onChange: (rows: PlanRowInput[]) => void; total: Decimal; currency: string; startDate: string; error?: string }) {
  const firstOfNext = dateToDateInput(addMonths(dateInputToDate(startDate) ?? new Date(), 1));
  const [gen, setGen] = useState({ down: "", downDate: startDate, count: "12", first: firstOfNext, interval: "1", keyAmount: "", keyDate: "", loanAmount: "", loanDate: "" });
  const [genError, setGenError] = useState<string | null>(null);
  const sum = rows.reduce((s, r) => s.plus(toDec(r.amount)), new Decimal(0));
  const diff = total.minus(sum);
  const set = (i: number, patch: Partial<PlanRowInput>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function generate() {
    const fixed = [
      gen.keyAmount && { dueDate: dateInputToDate(gen.keyDate), amount: toDec(gen.keyAmount), kind: "KEY_DELIVERY" as const, note: null },
      gen.loanAmount && { dueDate: dateInputToDate(gen.loanDate), amount: toDec(gen.loanAmount), kind: "BANK_LOAN" as const, note: null },
    ].filter((x): x is { dueDate: Date | null; amount: Decimal; kind: "KEY_DELIVERY" | "BANK_LOAN"; note: null } => Boolean(x));
    if (fixed.some((f) => !f.dueDate)) return setGenError("Anahtar teslim / kredi için tarih girin.");
    const first = dateInputToDate(gen.first);
    const count = Number(gen.count || 0);
    const result = buildPlan({
      total,
      downPayment: gen.down ? { amount: toDec(gen.down), date: dateInputToDate(gen.downDate) ?? new Date() } : null,
      fixed: fixed.map((f) => ({ ...f, dueDate: f.dueDate! })),
      installments: count > 0 && first ? { count, firstDate: first, intervalMonths: Math.max(1, Number(gen.interval || 1)) } : null,
    });
    setGenError(result.error);
    if (!result.error) onChange(result.rows.map((r) => ({ dueDate: dateToDateInput(r.dueDate), amount: formatNumber(r.amount, 2), kind: r.kind, note: r.note ?? "" })));
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4 lg:grid-cols-6">
        <FormField id="g-down" label="Peşinat">
          <Input id="g-down" inputMode="decimal" value={gen.down} onChange={(e) => setGen((g) => ({ ...g, down: e.target.value }))} />
        </FormField>
        <FormField id="g-downdate" label="Peşinat tarihi">
          <Input id="g-downdate" type="date" value={gen.downDate} onChange={(e) => setGen((g) => ({ ...g, downDate: e.target.value }))} />
        </FormField>
        <FormField id="g-count" label="Taksit sayısı">
          <Input id="g-count" inputMode="numeric" value={gen.count} onChange={(e) => setGen((g) => ({ ...g, count: e.target.value }))} />
        </FormField>
        <FormField id="g-first" label="İlk taksit">
          <Input id="g-first" type="date" value={gen.first} onChange={(e) => setGen((g) => ({ ...g, first: e.target.value }))} />
        </FormField>
        <div className="col-span-2 sm:col-span-4 lg:col-span-6">
          <FormMore title="Ayrıntılar: taksit aralığı, anahtar teslim, banka kredisi" hasValue={Boolean(gen.keyAmount || gen.loanAmount || (gen.interval && gen.interval !== "1"))} className="sm:grid-cols-3 lg:grid-cols-5">
        <FormField id="g-interval" label="Aralık (ay)">
          <Input id="g-interval" inputMode="numeric" value={gen.interval} onChange={(e) => setGen((g) => ({ ...g, interval: e.target.value }))} />
        </FormField>
        <FormField id="g-key" label="Anahtar teslim ödemesi">
          <Input id="g-key" inputMode="decimal" value={gen.keyAmount} onChange={(e) => setGen((g) => ({ ...g, keyAmount: e.target.value }))} />
        </FormField>
        <FormField id="g-keydate" label="Anahtar teslim tarihi">
          <Input id="g-keydate" type="date" value={gen.keyDate} onChange={(e) => setGen((g) => ({ ...g, keyDate: e.target.value }))} />
        </FormField>
        <FormField id="g-loan" label="Banka kredisi">
          <Input id="g-loan" inputMode="decimal" value={gen.loanAmount} onChange={(e) => setGen((g) => ({ ...g, loanAmount: e.target.value }))} />
        </FormField>
        <FormField id="g-loandate" label="Kredi tarihi">
          <Input id="g-loandate" type="date" value={gen.loanDate} onChange={(e) => setGen((g) => ({ ...g, loanDate: e.target.value }))} />
        </FormField>
          </FormMore>
        </div>
        <div className="col-span-2 flex items-end">
          <Button type="button" variant="outline" onClick={generate} className="w-full sm:w-auto">
            <WandSparklesIcon />
            Planı oluştur
          </Button>
        </div>
        {genError && <p className="col-span-full text-sm text-destructive">{genError}</p>}
        <p className="col-span-full text-xs text-muted-foreground">Peşinat, anahtar teslim ve kredi düşüldükten sonra kalan tutar eşit taksitlere bölünür. Ara ödeme için aşağıdan satır ekleyin.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 font-medium">Vade</th>
              <th className="py-1 pr-2 font-medium">Tür</th>
              <th className="py-1 pr-2 text-right font-medium">Tutar ({currency})</th>
              <th className="py-1 pr-2 font-medium">Açıklama</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <Input type="date" aria-label={`${i + 1}. satır vade`} value={r.dueDate} onChange={(e) => set(i, { dueDate: e.target.value })} />
                </td>
                <td className="py-1 pr-2">
                  <NativeSelect aria-label={`${i + 1}. satır tür`} value={r.kind} onChange={(e) => set(i, { kind: e.target.value as InstallmentKind })}>
                    {Object.entries(INSTALLMENT_KIND_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="py-1 pr-2">
                  <Input aria-label={`${i + 1}. satır tutar`} className="text-right" inputMode="decimal" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} />
                </td>
                <td className="py-1 pr-2">
                  <Input aria-label={`${i + 1}. satır açıklama`} value={r.note} onChange={(e) => set(i, { note: e.target.value })} />
                </td>
                <td className="py-1">
                  <Button type="button" size="icon" variant="ghost" aria-label={`${i + 1}. satırı sil`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { dueDate: startDate, amount: diff.gt(0) ? formatNumber(diff, 2) : "", kind: "INTERIM", note: "" }])}>
          <PlusIcon />
          Satır ekle
        </Button>
        <p className={cn("text-sm tabular-nums", diff.isZero() ? "text-emerald-700" : "text-destructive")}>
          Plan toplamı {formatMoney(sum, currency)} / satış (KDV dahil) {formatMoney(total, currency)}
          {!diff.isZero() && ` · fark ${formatMoney(diff, currency)}`}
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
