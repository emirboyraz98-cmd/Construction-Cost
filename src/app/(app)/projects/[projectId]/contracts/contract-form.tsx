"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircleIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { FilePicker } from "@/components/expenses/file-picker";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ContractStatus, SupplyMethod } from "@/generated/prisma/enums";
import { CONTRACT_STATUS_LABELS, SUPPLY_METHOD_LABELS } from "@/lib/connections/labels";
import { codeDepth } from "@/lib/cost-tree/tree";
import { roundMoney } from "@/lib/expenses/amounts";
import { SUPPLIER_KIND_LABELS } from "@/lib/expenses/labels";
import { toFormData } from "@/lib/form-data";
import { emptyContractItem } from "@/lib/form-rows";
import { Decimal, formatMoney, parseDecimalInput } from "@/lib/format";
import type { SupplierKind } from "@/generated/prisma/enums";
import { saveContractAction } from "./actions";

export type ContractItemRow = {
  key: string;
  id?: string;
  costItemId: string | null;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export type ContractFormValues = {
  no: string;
  date: string;
  supplierId: string | null;
  title: string;
  scope: string;
  supplyMethod: SupplyMethod;
  vatRate: string;
  vatWithholdingRate: string;
  retentionRate: string;
  advanceOffsetRate: string;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  notes: string;
  items: ContractItemRow[];
};

type Options = {
  suppliers: { id: string; name: string; taxNumber: string | null; kind: SupplierKind }[];
  costItems: { id: string; code: string; name: string; unit: string | null; isGroup: boolean }[];
  vatRates: string[];
};

const num = (text: string) => {
  const parsed = parseDecimalInput(text);
  return parsed.ok && parsed.value ? parsed.value : new Decimal(0);
};

export function ContractForm({
  projectId,
  contractId,
  initial,
  options,
  documents = [],
}: {
  projectId: string;
  contractId: string | null;
  initial: ContractFormValues;
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
  const set = (patch: Partial<ContractFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const setItem = (index: number, patch: Partial<ContractItemRow>) =>
    set({ items: values.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const total = values.items.reduce((s, item) => s.plus(roundMoney(num(item.quantity).times(num(item.unitPrice)))), new Decimal(0));
  const costOptions = options.costItems.map((c) => ({ value: c.id, label: `${c.code} ${c.name}`, indent: codeDepth(c.code), emphasis: c.isGroup }));
  const rateField = (key: "vatWithholdingRate" | "retentionRate" | "advanceOffsetRate", label: string, hint: string) => (
    <FormField id={key} label={label} error={errors[key]} hint={hint}>
      <Input id={key} inputMode="decimal" value={values[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </FormField>
  );

  return (
    <form
      className="grid max-w-5xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(undefined);
          const payload = { ...values, supplierId: values.supplierId ?? "", items: values.items.map((i) => ({ ...i, costItemId: i.costItemId ?? "" })) };
          const result = await saveContractAction(projectId, contractId, toFormData(payload, files, removed));
          if (!result.ok) {
            setError(result.error);
            setErrors(result.fieldErrors ?? {});
            return;
          }
          router.push(`/projects/${projectId}/contracts/${result.id}`);
          router.refresh();
        });
      }}
    >
      <FormError message={error} />
      <Card>
        <CardHeader>
          <CardTitle>Sözleşme</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="supplierId" label="Taşeron" required error={errors.supplierId} className="sm:col-span-2">
            <Combobox
              id="supplierId"
              options={options.suppliers.map((s) => ({ value: s.id, label: s.name, hint: SUPPLIER_KIND_LABELS[s.kind] }))}
              value={values.supplierId}
              onChange={(supplierId) => set({ supplierId })}
              placeholder="Taşeron seçin"
              invalid={Boolean(errors.supplierId)}
            />
          </FormField>
          <FormField id="no" label="Sözleşme no" required error={errors.no}>
            <Input id="no" value={values.no} onChange={(e) => set({ no: e.target.value })} />
          </FormField>
          <FormField id="title" label="İş" required error={errors.title} className="sm:col-span-2">
            <Input id="title" value={values.title} onChange={(e) => set({ title: e.target.value })} placeholder="ör. Kaba inşaat işçiliği" />
          </FormField>
          <FormField id="date" label="Sözleşme tarihi" required error={errors.date}>
            <Input id="date" type="date" value={values.date} onChange={(e) => set({ date: e.target.value })} />
          </FormField>
          <FormField id="supplyMethod" label="Temin şekli" className="sm:col-span-2">
            <NativeSelect id="supplyMethod" value={values.supplyMethod} onChange={(e) => set({ supplyMethod: e.target.value as SupplyMethod })}>
              {Object.entries(SUPPLY_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="status" label="Durum">
            <NativeSelect id="status" value={values.status} onChange={(e) => set({ status: e.target.value as ContractStatus })}>
              {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="startDate" label="Başlangıç">
            <Input id="startDate" type="date" value={values.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </FormField>
          <FormField id="endDate" label="Bitiş">
            <Input id="endDate" type="date" value={values.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          </FormField>
          <FormField id="scope" label="Kapsam" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="scope" value={values.scope} onChange={(e) => set({ scope: e.target.value })} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hakediş şartları</CardTitle>
          <CardDescription>Oranlar sözleşmeden girilir; programda sabit oran yoktur. Tevkifat ve teminatı muhasebecinizle teyit edin.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="vatRate" label="KDV %" error={errors.vatRate}>
            <NativeSelect id="vatRate" value={values.vatRate} onChange={(e) => set({ vatRate: e.target.value })}>
              {[...new Set([...options.vatRates, values.vatRate])].map((rate) => (
                <option key={rate} value={rate}>
                  %{rate}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {rateField("vatWithholdingRate", "KDV tevkifatı (%)", "KDV'nin tevkif edilen kısmı; ör. 4/10 için 40.")}
          {rateField("retentionRate", "Teminat kesintisi (%)", "Her hakediş brütünden.")}
          {rateField("advanceOffsetRate", "Avans mahsup oranı (%)", "Brütün bu oranı kadar, açık avansla sınırlı.")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Birim fiyatlar</CardTitle>
          <CardDescription>KDV hariç, TL. Her satır projenin bir maliyet kalemine yazılır.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {errors.items && <p className="text-sm text-destructive">{errors.items}</p>}
          {values.items.map((item, index) => {
            const e = (field: string) => errors[`items.${index}.${field}`];
            return (
              <div key={item.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-6">
                <FormField id={`ci-${index}-desc`} label="İş kalemi" required error={e("description")} className="sm:col-span-3">
                  <Input id={`ci-${index}-desc`} value={item.description} onChange={(ev) => setItem(index, { description: ev.target.value })} placeholder="ör. Kalıp işçiliği" />
                </FormField>
                <FormField id={`ci-${index}-cost`} label="Maliyet kalemi" required error={e("costItemId")} className="sm:col-span-3">
                  <Combobox
                    id={`ci-${index}-cost`}
                    options={costOptions}
                    value={item.costItemId}
                    onChange={(costItemId) => {
                      const unit = options.costItems.find((c) => c.id === costItemId)?.unit;
                      setItem(index, { costItemId, ...(unit && !item.unit ? { unit } : {}) });
                    }}
                    placeholder="Kalem seçin"
                    invalid={Boolean(e("costItemId"))}
                  />
                </FormField>
                <FormField id={`ci-${index}-qty`} label="Sözleşme miktarı" required error={e("quantity")}>
                  <Input id={`ci-${index}-qty`} inputMode="decimal" value={item.quantity} onChange={(ev) => setItem(index, { quantity: ev.target.value })} />
                </FormField>
                <FormField id={`ci-${index}-unit`} label="Birim" required error={e("unit")}>
                  <Input id={`ci-${index}-unit`} value={item.unit} onChange={(ev) => setItem(index, { unit: ev.target.value })} placeholder="m²" />
                </FormField>
                <FormField id={`ci-${index}-price`} label="Birim fiyat" required error={e("unitPrice")}>
                  <Input id={`ci-${index}-price`} inputMode="decimal" value={item.unitPrice} onChange={(ev) => setItem(index, { unitPrice: ev.target.value })} />
                </FormField>
                <div className="flex items-end justify-between gap-2 sm:col-span-3">
                  <span className="pb-2 text-sm tabular-nums">{formatMoney(roundMoney(num(item.quantity).times(num(item.unitPrice))))}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Satırı sil" disabled={values.items.length === 1} onClick={() => set({ items: values.items.filter((_, i) => i !== index) })}>
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => set({ items: [...values.items, emptyContractItem()] })}>
              <PlusIcon />
              Satır ekle
            </Button>
            <p className="text-sm">
              Sözleşme tutarı (KDV hariç): <strong className="tabular-nums">{formatMoney(total)}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notlar ve belge</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Textarea aria-label="Notlar" value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
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
