"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { FilePicker } from "@/components/expenses/file-picker";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { computeProgressBilling } from "@/lib/contracts/progress";
import { toFormData } from "@/lib/form-data";
import { Decimal, formatMoney, formatNumber, parseDecimalInput } from "@/lib/format";
import { saveBillingAction } from "../../actions";

export type BillingLine = {
  contractItemId: string;
  description: string;
  unit: string;
  contractQuantity: string;
  unitPrice: string | null;
  previousQuantity: string;
  cumulativeQuantity: string;
};

export type BillingFormValues = {
  date: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  advanceOffset: string;
  materialOffset: string;
  otherDeductions: string;
  otherDeductionNote: string;
  notes: string;
};

type Terms = { vatRate: string; vatWithholdingRate: string; retentionRate: string; advanceOffsetRate: string };

const dec = (text: string | null | undefined) => {
  const parsed = parseDecimalInput(text ?? "");
  return parsed.ok && parsed.value ? parsed.value : new Decimal(0);
};

export function BillingForm({
  projectId,
  contractId,
  billingId,
  seq,
  initial,
  lines: initialLines,
  terms,
  openAdvance,
}: {
  projectId: string;
  contractId: string;
  billingId: string | null;
  seq: number;
  initial: BillingFormValues;
  lines: BillingLine[];
  /** Fiyatları görmeyen (şantiye şefi) için yok: yalnızca miktarlar girilir */
  terms: Terms | null;
  openAdvance: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [cumulative, setCumulative] = useState<Record<string, string>>(
    Object.fromEntries(initialLines.map((l) => [l.contractItemId, formatNumber(l.cumulativeQuantity, 4)])),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<BillingFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const preview = terms
    ? computeProgressBilling({
        lines: initialLines.map((l) => ({
          contractItemId: l.contractItemId,
          description: l.description,
          unit: l.unit,
          unitPrice: dec(l.unitPrice),
          contractQuantity: dec(l.contractQuantity),
          previousQuantity: dec(l.previousQuantity),
          cumulativeQuantity: dec(cumulative[l.contractItemId]),
        })),
        terms: { vatRate: dec(terms.vatRate), vatWithholdingRate: dec(terms.vatWithholdingRate), retentionRate: dec(terms.retentionRate), advanceOffsetRate: dec(terms.advanceOffsetRate) },
        openAdvance: dec(openAdvance),
        advanceOffset: values.advanceOffset.trim() ? dec(values.advanceOffset) : null,
        materialOffset: dec(values.materialOffset),
        otherDeductions: dec(values.otherDeductions),
      })
    : null;

  return (
    <form
      className="grid max-w-5xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(undefined);
          const payload = {
            ...values,
            lines: initialLines.map((l) => ({ contractItemId: l.contractItemId, cumulativeQuantity: cumulative[l.contractItemId] ?? "" })),
          };
          const result = await saveBillingAction(projectId, contractId, billingId, toFormData(payload, files));
          if (!result.ok) {
            setError(result.error);
            setErrors(result.fieldErrors ?? {});
            return;
          }
          setWarnings(result.warnings);
          router.push(`/projects/${projectId}/contracts/${contractId}/billings/${result.id}`);
          router.refresh();
        });
      }}
    >
      <FormError message={error} />
      {warnings.length > 0 && <FormError message={warnings.join(" ")} />}
      <Card>
        <CardHeader>
          <CardTitle>{seq}. hakediş</CardTitle>
          <CardDescription>Kümülatif miktar: bu hakedişe kadar yapılan toplam iş. Bu dönem = kümülatif − önceki hakedişler.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <FormField id="date" label="Hakediş tarihi" required error={errors.date}>
            <Input id="date" type="date" value={values.date} onChange={(e) => set({ date: e.target.value })} />
          </FormField>
          <FormField id="periodStart" label="Dönem başı">
            <Input id="periodStart" type="date" value={values.periodStart} onChange={(e) => set({ periodStart: e.target.value })} />
          </FormField>
          <FormField id="periodEnd" label="Dönem sonu">
            <Input id="periodEnd" type="date" value={values.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} />
          </FormField>
          <FormField id="dueDate" label="Ödeme vadesi">
            <Input id="dueDate" type="date" value={values.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metraj</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {initialLines.map((line, index) => {
            const period = dec(cumulative[line.contractItemId]).minus(line.previousQuantity);
            const amount = preview?.lines[index]?.amount;
            return (
              <div key={line.contractItemId} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                <div className="min-w-0">
                  <p className="font-medium">{line.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Sözleşme {formatNumber(line.contractQuantity, 4)} {line.unit} · önceki {formatNumber(line.previousQuantity, 4)} {line.unit}
                    {line.unitPrice && ` · ${formatMoney(line.unitPrice)} / ${line.unit}`}
                  </p>
                </div>
                <FormField id={`cum-${line.contractItemId}`} label={`Kümülatif (${line.unit})`} error={errors[`lines.${index}.cumulativeQuantity`]}>
                  <Input
                    id={`cum-${line.contractItemId}`}
                    inputMode="decimal"
                    value={cumulative[line.contractItemId] ?? ""}
                    onChange={(e) => setCumulative({ ...cumulative, [line.contractItemId]: e.target.value })}
                  />
                </FormField>
                <p className="text-right text-sm tabular-nums">
                  Bu dönem <strong className={period.isNegative() ? "text-destructive" : undefined}>{formatNumber(period, 4)}</strong> {line.unit}
                  {amount && <span className="block">{formatMoney(amount)}</span>}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {preview && terms && (
        <Card>
          <CardHeader>
            <CardTitle>Kesintiler ve net ödeme</CardTitle>
            <CardDescription>
              KDV %{formatNumber(terms.vatRate)} · tevkifat %{formatNumber(terms.vatWithholdingRate)} · teminat %{formatNumber(terms.retentionRate)} · avans mahsubu %
              {formatNumber(terms.advanceOffsetRate)} (açık avans {formatMoney(openAdvance)})
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="advanceOffset" label="Avans mahsubu" error={errors.advanceOffset} hint={`Boş: önerilen ${formatMoney(preview.suggestedAdvanceOffset)}`}>
                <Input id="advanceOffset" inputMode="decimal" value={values.advanceOffset} onChange={(e) => set({ advanceOffset: e.target.value })} placeholder={formatNumber(preview.suggestedAdvanceOffset)} />
              </FormField>
              <FormField id="materialOffset" label="Malzeme mahsubu" error={errors.materialOffset} hint="Bizim verdiğimiz, taşerondan düşülen malzeme.">
                <Input id="materialOffset" inputMode="decimal" value={values.materialOffset} onChange={(e) => set({ materialOffset: e.target.value })} />
              </FormField>
              <FormField id="otherDeductions" label="Diğer kesintiler" error={errors.otherDeductions}>
                <Input id="otherDeductions" inputMode="decimal" value={values.otherDeductions} onChange={(e) => set({ otherDeductions: e.target.value })} />
              </FormField>
              <FormField id="otherDeductionNote" label="Diğer kesinti açıklaması">
                <Input id="otherDeductionNote" value={values.otherDeductionNote} onChange={(e) => set({ otherDeductionNote: e.target.value })} placeholder="ör. SGK, ceza, damga vergisi" />
              </FormField>
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 p-4 text-sm tabular-nums">
              <dt>Bu dönem brüt (KDV hariç)</dt>
              <dd className="text-right font-medium">{formatMoney(preview.grossAmount)}</dd>
              <dt>+ KDV</dt>
              <dd className="text-right">{formatMoney(preview.vatAmount)}</dd>
              <dt>− KDV tevkifatı</dt>
              <dd className="text-right">{formatMoney(preview.vatWithheld)}</dd>
              <dt>− Teminat</dt>
              <dd className="text-right">{formatMoney(preview.retention)}</dd>
              <dt>− Avans mahsubu</dt>
              <dd className="text-right">{formatMoney(preview.advanceOffset)}</dd>
              <dt>− Malzeme mahsubu</dt>
              <dd className="text-right">{formatMoney(preview.materialOffset)}</dd>
              <dt>− Diğer</dt>
              <dd className="text-right">{formatMoney(preview.otherDeductions)}</dd>
              <dt className="border-t pt-1.5 font-semibold">Net ödenecek</dt>
              <dd className="border-t pt-1.5 text-right text-base font-semibold">{formatMoney(preview.payableAmount)}</dd>
            </dl>
            {(preview.errors.length > 0 || preview.warnings.length > 0) && (
              <ul className="grid grid-cols-1 gap-1 text-sm lg:col-span-2">
                {preview.errors.map((e, i) => (
                  <li key={`e${i}`} className="text-destructive">
                    {e}
                  </li>
                ))}
                {preview.warnings.map((w, i) => (
                  <li key={`w${i}`} className="text-amber-700">
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Not ve belgeler</CardTitle>
          <CardDescription>Metraj cetveli, tutanak veya fotoğraf.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Textarea aria-label="Not" value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
          <FilePicker files={files} onChange={setFiles} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending || (preview?.errors.length ?? 0) > 0}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
          Taslağı kaydet
        </Button>
      </div>
    </form>
  );
}
