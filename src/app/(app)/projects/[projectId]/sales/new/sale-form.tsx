"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormError, FormField } from "@/components/form-field";
import { FormMore } from "@/components/form-more";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/expenses/labels";
import { Decimal, formatMoney, formatNumber, parseDecimalInput } from "@/lib/format";
import { contractAmounts } from "@/lib/sales/sales";
import { createSaleAction } from "../actions";
import { PlanEditor, type PlanRowInput } from "../plan-editor";
import { CustomerPicker } from "../sales-panels";

export type SaleUnitOption = { id: string; label: string; listPrice: string | null; listVatRate: string | null; reservedBy: string | null; reservedCustomerId: string | null };

const toDec = (v: string) => {
  const r = parseDecimalInput(v);
  return r.ok && r.value ? r.value : new Decimal(0);
};

export function SaleForm({
  projectId,
  units,
  customers,
  initialUnitId,
  commissionPercent,
  today,
  rates,
}: {
  projectId: string;
  units: SaleUnitOption[];
  customers: { id: string; name: string; phone: string | null }[];
  initialUnitId: string | null;
  commissionPercent: string;
  today: string;
  rates: Record<string, string>;
}) {
  const router = useRouter();
  const pick = (id: string | null) => units.find((u) => u.id === id) ?? null;
  const first = pick(initialUnitId);
  const [form, setForm] = useState({
    unitId: first?.id ?? "",
    customerId: first?.reservedCustomerId ?? (null as string | null),
    contractNo: "",
    date: today,
    currency: "TRY",
    exchangeRate: "1",
    listPrice: first?.listPrice ? formatNumber(first.listPrice, 2) : "",
    discount: "0",
    vatRate: first?.listVatRate ? formatNumber(first.listVatRate, 2) : "",
    agent: "",
    commissionAmount: "",
    notes: "",
  });
  const [plan, setPlan] = useState<PlanRowInput[]>([]);
  const { run, error, fieldErrors, pending } = useAction();
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const amounts = useMemo(() => contractAmounts({ listPrice: toDec(form.listPrice), discount: toDec(form.discount), vatRate: toDec(form.vatRate) }), [form.listPrice, form.discount, form.vatRate]);
  const rate = form.currency === "TRY" ? new Decimal(1) : toDec(form.exchangeRate);
  const suggestedCommission = amounts.salePrice.times(rate).times(toDec(commissionPercent)).div(100).toDecimalPlaces(2);

  return (
    <div className="grid grid-cols-1 gap-4">
      <FormError message={error} />
      <Card>
        <CardHeader>
          <CardTitle>Bölüm ve müşteri</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="sl-unit" label="Bölüm" required error={fieldErrors.unitId} className="sm:col-span-2">
            <NativeSelect
              id="sl-unit"
              value={form.unitId}
              onChange={(e) => {
                const u = pick(e.target.value);
                set({
                  unitId: e.target.value,
                  listPrice: u?.listPrice ? formatNumber(u.listPrice, 2) : "",
                  vatRate: u?.listVatRate ? formatNumber(u.listVatRate, 2) : form.vatRate,
                  customerId: u?.reservedCustomerId ?? form.customerId,
                });
              }}
            >
              <option value="">Seçin…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                  {u.listPrice ? ` · ${formatMoney(u.listPrice)}` : " · liste fiyatı yok"}
                  {u.reservedBy ? ` · rezerve: ${u.reservedBy}` : ""}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="customer" label="Müşteri" required error={fieldErrors.customerId} className="sm:col-span-2">
            <CustomerPicker projectId={projectId} customers={customers} value={form.customerId} onChange={(v) => set({ customerId: v })} invalid={Boolean(fieldErrors.customerId)} />
          </FormField>
          <FormField id="sl-date" label="Sözleşme tarihi" required error={fieldErrors.date}>
            <Input id="sl-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </FormField>
          <div className="sm:col-span-2 lg:col-span-4">
            <FormMore title="Ayrıntılar: sözleşme no, para birimi" hasValue={Boolean(form.contractNo || form.currency !== "TRY")} className="lg:grid-cols-4">
          <FormField id="sl-no" label="Sözleşme no">
            <Input id="sl-no" value={form.contractNo} onChange={(e) => set({ contractNo: e.target.value })} />
          </FormField>
          <FormField id="sl-currency" label="Para birimi">
            <NativeSelect id="sl-currency" value={form.currency} onChange={(e) => set({ currency: e.target.value, exchangeRate: e.target.value === "TRY" ? "1" : rates[e.target.value] ? formatNumber(rates[e.target.value], 4) : "" })}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {form.currency !== "TRY" && (
            <FormField id="sl-rate" label={`Kur (1 ${form.currency} = TL)`} required error={fieldErrors.exchangeRate} hint="Son kayıtlı TCMB alış kuru önerilir.">
              <Input id="sl-rate" inputMode="decimal" value={form.exchangeRate} onChange={(e) => set({ exchangeRate: e.target.value })} />
            </FormField>
          )}
            </FormMore>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fiyat</CardTitle>
          <CardDescription>Liste fiyatı onaylı fiyat listesinden gelir; indirim girilince satış fiyatı hesaplanır. Fiyatlar KDV hariç, {form.currency}.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="sl-list" label="Liste fiyatı" required error={fieldErrors.listPrice}>
            <Input id="sl-list" inputMode="decimal" value={form.listPrice} onChange={(e) => set({ listPrice: e.target.value })} />
          </FormField>
          <FormField id="sl-discount" label="İndirim" error={fieldErrors.discount}>
            <Input id="sl-discount" inputMode="decimal" value={form.discount} onChange={(e) => set({ discount: e.target.value })} />
          </FormField>
          <FormField id="sl-vat" label="KDV oranı (%)" required error={fieldErrors.vatRate} hint="Fiyat listesindeki orandan gelir; muhasebecinizle teyit edin.">
            <Input id="sl-vat" inputMode="decimal" value={form.vatRate} onChange={(e) => set({ vatRate: e.target.value })} />
          </FormField>
          <div className="grid content-start gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
            <span className="flex justify-between gap-2">
              Satış fiyatı <strong className="tabular-nums">{formatMoney(amounts.salePrice, form.currency)}</strong>
            </span>
            <span className="flex justify-between gap-2 text-muted-foreground">
              KDV <span className="tabular-nums">{formatMoney(amounts.vatAmount, form.currency)}</span>
            </span>
            <span className="flex justify-between gap-2">
              Toplam (KDV dahil) <strong className="tabular-nums">{formatMoney(amounts.totalAmount, form.currency)}</strong>
            </span>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <FormMore title="Ayrıntılar: emlakçı, komisyon, not" hasValue={Boolean(form.agent || form.commissionAmount || form.notes)} className="lg:grid-cols-4">
          <FormField id="sl-agent" label="Emlakçı / satış danışmanı">
            <Input id="sl-agent" value={form.agent} onChange={(e) => set({ agent: e.target.value })} />
          </FormField>
          <FormField id="sl-commission" label="Komisyon (TL)" error={fieldErrors.commissionAmount} hint={Number(commissionPercent) > 0 ? `Fiyatlandırmadaki %${formatNumber(commissionPercent, 2)} ile ${formatMoney(suggestedCommission)}` : undefined}>
            <Input id="sl-commission" inputMode="decimal" value={form.commissionAmount} onChange={(e) => set({ commissionAmount: e.target.value })} placeholder={suggestedCommission.gt(0) ? formatNumber(suggestedCommission, 2) : ""} />
          </FormField>
          <FormField id="sl-notes" label="Not" className="sm:col-span-2">
            <Input id="sl-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </FormField>
            </FormMore>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ödeme planı</CardTitle>
          <CardDescription>Peşinat, taksitler, ara ödemeler, anahtar teslim ve banka kredisi. Tutarlar KDV dahil; toplam satış tutarına eşit olmalı.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlanEditor rows={plan} onChange={setPlan} total={amounts.totalAmount} currency={form.currency} startDate={form.date} error={fieldErrors.installments} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            run(
              () =>
                createSaleAction(projectId, {
                  ...form,
                  customerId: form.customerId ?? "",
                  commissionAmount: form.commissionAmount || (suggestedCommission.gt(0) ? suggestedCommission.toString() : ""),
                  installments: plan,
                }),
              (r) => router.push(`/projects/${projectId}/sales/${r.id}`),
            )
          }
        >
          Satışı kaydet
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
