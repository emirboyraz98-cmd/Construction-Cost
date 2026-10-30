"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircleIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { FilePicker } from "@/components/expenses/file-picker";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionPriceType, ConnectionStatus, Currency, PaymentMethod } from "@/generated/prisma/enums";
import { CONNECTION_STATUS_LABELS, PRICE_TYPE_LABELS } from "@/lib/connections/labels";
import { codeDepth } from "@/lib/cost-tree/tree";
import { roundMoney } from "@/lib/expenses/amounts";
import { CURRENCIES, CURRENCY_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { toFormData } from "@/lib/form-data";
import { Decimal, formatMoney, parseDecimalInput } from "@/lib/format";
import { createConnectionAction, updateConnectionAction } from "./actions";

export type ConnectionItemRow = {
  key: string;
  id?: string;
  description: string;
  costItemCode: string | null;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
};

export type ConnectionPaymentRow = {
  key: string;
  dueDate: string;
  amount: string;
  description: string;
  paymentMethod: PaymentMethod | null;
  instrumentNo: string;
};

export type ConnectionFormValues = {
  no: string;
  date: string;
  supplierId: string | null;
  status: ConnectionStatus;
  priceType: ConnectionPriceType;
  currency: Currency;
  priceFixedUntil: string;
  validUntil: string;
  lastDrawDate: string;
  deliveryPlace: string;
  transportIncluded: boolean;
  unloadingIncluded: boolean;
  notes: string;
  items: ConnectionItemRow[];
  payments: ConnectionPaymentRow[];
};

type Options = {
  suppliers: { id: string; name: string; taxNumber: string | null }[];
  costItems: { code: string; name: string; unit: string | null }[];
  vatRates: string[];
};

const newKey = () => Math.random().toString(36).slice(2);
export const emptyItem = (vatRate: string): ConnectionItemRow => ({
  key: newKey(),
  description: "",
  costItemCode: null,
  unit: "",
  quantity: "",
  unitPrice: "",
  vatRate,
});
const emptyPayment = (): ConnectionPaymentRow => ({ key: newKey(), dueDate: "", amount: "", description: "", paymentMethod: null, instrumentNo: "" });

const num = (text: string) => {
  const parsed = parseDecimalInput(text);
  return parsed.ok && parsed.value ? parsed.value : new Decimal(0);
};

export function ConnectionForm({
  connectionId,
  initial,
  options,
  documents = [],
}: {
  connectionId: string | null;
  initial: ConnectionFormValues;
  options: Options;
  documents?: { id: string; fileName: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<ConnectionFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const setItem = (index: number, patch: Partial<ConnectionItemRow>) =>
    set({ items: values.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const setPayment = (index: number, patch: Partial<ConnectionPaymentRow>) =>
    set({ payments: values.payments.map((p, i) => (i === index ? { ...p, ...patch } : p)) });

  const totals = values.items.reduce(
    (acc, item) => {
      const net = roundMoney(num(item.quantity).times(num(item.unitPrice)));
      return { net: acc.net.plus(net), vat: acc.vat.plus(roundMoney(net.times(num(item.vatRate)).div(100))) };
    },
    { net: new Decimal(0), vat: new Decimal(0) },
  );
  const planned = values.payments.reduce((s, p) => s.plus(num(p.amount)), new Decimal(0));
  const currency = values.currency;
  const fx = values.priceType === "FX_AT_DELIVERY" || values.priceType === "FX_AT_PAYMENT";
  const costOptions = options.costItems.map((c) => ({ value: c.code, label: `${c.code} ${c.name}`, indent: codeDepth(c.code) }));

  function submit() {
    startTransition(async () => {
      setError(undefined);
      const payload = {
        ...values,
        no: values.no || undefined,
        items: values.items.map((item) => ({ ...item, costItemCode: item.costItemCode ?? "" })),
        payments: connectionId ? [] : values.payments,
      };
      const formData = toFormData(payload, files, removed);
      const result = connectionId ? await updateConnectionAction(connectionId, formData) : await createConnectionAction(formData);
      if (!result.ok) {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      router.push(`/company/connections/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form
      className="grid max-w-5xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <FormError message={error} />
      <Card>
        <CardHeader>
          <CardTitle>Bağlantı bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="supplierId" label="Tedarikçi" required error={errors.supplierId} className="sm:col-span-2">
            <Combobox
              id="supplierId"
              options={options.suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.taxNumber }))}
              value={values.supplierId}
              onChange={(supplierId) => set({ supplierId })}
              placeholder="Tedarikçi seçin"
              invalid={Boolean(errors.supplierId)}
            />
          </FormField>
          <FormField id="no" label="Bağlantı no" error={errors.no} hint="Boş bırakılırsa BG-yıl-sıra verilir.">
            <Input id="no" value={values.no} onChange={(e) => set({ no: e.target.value })} />
          </FormField>
          <FormField id="date" label="Tarih" required error={errors.date}>
            <Input id="date" type="date" value={values.date} onChange={(e) => set({ date: e.target.value })} />
          </FormField>
          <FormField id="status" label="Durum">
            <NativeSelect id="status" value={values.status} onChange={(e) => set({ status: e.target.value as ConnectionStatus })}>
              {Object.entries(CONNECTION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="priceType" label="Fiyat tipi">
            <NativeSelect id="priceType" value={values.priceType} onChange={(e) => set({ priceType: e.target.value as ConnectionPriceType })}>
              {Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="currency" label="Para birimi" error={errors.currency} hint={fx ? "Çekişte o günün TCMB döviz alış kuru kullanılır." : undefined}>
            <NativeSelect id="currency" value={values.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {values.priceType === "FIXED_UNTIL" && (
            <FormField id="priceFixedUntil" label="Fiyat şu tarihe kadar sabit" required error={errors.priceFixedUntil}>
              <Input id="priceFixedUntil" type="date" value={values.priceFixedUntil} onChange={(e) => set({ priceFixedUntil: e.target.value })} />
            </FormField>
          )}
          <FormField id="validUntil" label="Geçerlilik sonu" error={errors.validUntil}>
            <Input id="validUntil" type="date" value={values.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
          </FormField>
          <FormField id="lastDrawDate" label="Son çekiş tarihi" error={errors.lastDrawDate}>
            <Input id="lastDrawDate" type="date" value={values.lastDrawDate} onChange={(e) => set({ lastDrawDate: e.target.value })} />
          </FormField>
          <FormField id="deliveryPlace" label="Teslim yeri" className="sm:col-span-2">
            <Input id="deliveryPlace" value={values.deliveryPlace} onChange={(e) => set({ deliveryPlace: e.target.value })} placeholder="ör. Şantiye teslim" />
          </FormField>
          <div className="flex flex-wrap items-end gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={values.transportIncluded} onCheckedChange={(on) => set({ transportIncluded: on === true })} />
              Nakliye dahil
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={values.unloadingIncluded} onCheckedChange={(on) => set({ unloadingIncluded: on === true })} />
              Boşaltma dahil
            </label>
          </div>
          <FormField id="notes" label="Notlar" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="notes" value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kalemler</CardTitle>
          <CardDescription>
            Birim fiyat KDV hariç, {CURRENCY_LABELS[currency]}. Maliyet kalemi, çekişte projedeki aynı kodlu kaleme yazılır.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {errors.items && <p className="text-sm text-destructive">{errors.items}</p>}
          {values.items.map((item, index) => {
            const e = (field: string) => errors[`items.${index}.${field}`];
            return (
              <div key={item.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-6">
                <FormField id={`item-${index}-description`} label="Malzeme" required error={e("description")} className="sm:col-span-3">
                  <Input
                    id={`item-${index}-description`}
                    value={item.description}
                    onChange={(ev) => setItem(index, { description: ev.target.value })}
                    placeholder="ör. Nervürlü demir Ø12"
                  />
                </FormField>
                <FormField id={`item-${index}-code`} label="Maliyet kalemi" required error={e("costItemCode")} className="sm:col-span-3">
                  <Combobox
                    id={`item-${index}-code`}
                    options={costOptions}
                    value={item.costItemCode}
                    onChange={(code) => {
                      const unit = options.costItems.find((c) => c.code === code)?.unit;
                      setItem(index, { costItemCode: code, ...(unit && !item.unit ? { unit } : {}) });
                    }}
                    placeholder="Kalem seçin"
                    invalid={Boolean(e("costItemCode"))}
                  />
                </FormField>
                <FormField id={`item-${index}-quantity`} label="Miktar" required error={e("quantity")}>
                  <Input id={`item-${index}-quantity`} inputMode="decimal" value={item.quantity} onChange={(ev) => setItem(index, { quantity: ev.target.value })} />
                </FormField>
                <FormField id={`item-${index}-unit`} label="Birim" required error={e("unit")}>
                  <Input id={`item-${index}-unit`} value={item.unit} onChange={(ev) => setItem(index, { unit: ev.target.value })} placeholder="ton" />
                </FormField>
                <FormField id={`item-${index}-price`} label="Birim fiyat" required error={e("unitPrice")}>
                  <Input id={`item-${index}-price`} inputMode="decimal" value={item.unitPrice} onChange={(ev) => setItem(index, { unitPrice: ev.target.value })} />
                </FormField>
                <FormField id={`item-${index}-vat`} label="KDV %" error={e("vatRate")}>
                  <NativeSelect id={`item-${index}-vat`} value={item.vatRate} onChange={(ev) => setItem(index, { vatRate: ev.target.value })}>
                    {[...new Set([...options.vatRates, item.vatRate])].map((rate) => (
                      <option key={rate} value={rate}>
                        %{rate}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <div className="flex items-end justify-between gap-2 sm:col-span-2">
                  <span className="pb-2 text-sm tabular-nums">
                    {formatMoney(roundMoney(num(item.quantity).times(num(item.unitPrice))), currency)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Kalemi sil"
                    disabled={values.items.length === 1}
                    onClick={() => set({ items: values.items.filter((_, i) => i !== index) })}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => set({ items: [...values.items, emptyItem(options.vatRates[0] ?? "20")] })}>
              <PlusIcon />
              Kalem ekle
            </Button>
            <p className="text-sm">
              Matrah <strong className="tabular-nums">{formatMoney(totals.net, currency)}</strong> + KDV{" "}
              <span className="tabular-nums">{formatMoney(totals.vat, currency)}</span> ={" "}
              <strong className="tabular-nums">{formatMoney(totals.net.plus(totals.vat), currency)}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {!connectionId && (
        <Card>
          <CardHeader>
            <CardTitle>Ödeme planı</CardTitle>
            <CardDescription>Avans, taksit, çek / senet vadeleri (KDV dahil, {CURRENCY_LABELS[currency]}). Sonradan bağlantı sayfasından da eklenir.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {values.payments.map((p, index) => {
              const e = (field: string) => errors[`payments.${index}.${field}`];
              return (
                <div key={p.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-6">
                  <FormField id={`pay-${index}-due`} label="Vade" required error={e("dueDate")}>
                    <Input id={`pay-${index}-due`} type="date" value={p.dueDate} onChange={(ev) => setPayment(index, { dueDate: ev.target.value })} />
                  </FormField>
                  <FormField id={`pay-${index}-amount`} label="Tutar" required error={e("amount")}>
                    <Input id={`pay-${index}-amount`} inputMode="decimal" value={p.amount} onChange={(ev) => setPayment(index, { amount: ev.target.value })} />
                  </FormField>
                  <FormField id={`pay-${index}-desc`} label="Açıklama" className="sm:col-span-2">
                    <Input id={`pay-${index}-desc`} value={p.description} onChange={(ev) => setPayment(index, { description: ev.target.value })} placeholder="ör. Peşin avans %30" />
                  </FormField>
                  <FormField id={`pay-${index}-method`} label="Ödeme şekli">
                    <NativeSelect
                      id={`pay-${index}-method`}
                      value={p.paymentMethod ?? ""}
                      onChange={(ev) => setPayment(index, { paymentMethod: (ev.target.value || null) as PaymentMethod | null })}
                    >
                      <option value="">—</option>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                  <div className="flex items-end gap-2">
                    <FormField id={`pay-${index}-no`} label="Çek / senet no" className="flex-1">
                      <Input id={`pay-${index}-no`} value={p.instrumentNo} onChange={(ev) => setPayment(index, { instrumentNo: ev.target.value })} />
                    </FormField>
                    <Button type="button" variant="ghost" size="icon" aria-label="Ödemeyi sil" onClick={() => set({ payments: values.payments.filter((_, i) => i !== index) })}>
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => set({ payments: [...values.payments, emptyPayment()] })}>
                <PlusIcon />
                Ödeme ekle
              </Button>
              {values.payments.length > 0 && (
                <p className="text-sm">
                  Plan toplamı <strong className="tabular-nums">{formatMoney(planned, currency)}</strong>
                  {!planned.eq(totals.net.plus(totals.vat)) && <span className="text-amber-700"> · bağlantı tutarından farklı</span>}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sözleşme / teklif belgesi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {documents.filter((d) => !removed.includes(d.id)).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="truncate hover:underline">
                {d.fileName}
              </a>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRemoved([...removed, d.id])}>
                Kaldır
              </Button>
            </div>
          ))}
          <FilePicker files={files} onChange={setFiles} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
          Kaydet
        </Button>
      </div>
    </form>
  );
}
