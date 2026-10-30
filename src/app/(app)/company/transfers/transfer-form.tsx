"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRightLeftIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { codeDepth } from "@/lib/cost-tree/tree";
import { deleteTransferAction, createTransferAction } from "./actions";

type Options = { projects: { id: string; name: string }[]; costItems: { code: string; name: string; unit: string | null }[] };

const empty = (today: string) => ({ date: today, fromProjectId: "", toProjectId: "", description: "", costItemCode: null as string | null, quantity: "", unit: "", amount: "", notes: "" });

export function TransferForm({ options, today }: { options: Options; today: string }) {
  const router = useRouter();
  const [values, setValues] = useState(empty(today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(undefined);
          setDone(false);
          const result = await createTransferAction({ ...values, costItemCode: values.costItemCode ?? "" });
          if (!result.ok) {
            setError(result.error);
            setErrors(result.fieldErrors ?? {});
            return;
          }
          setErrors({});
          setValues(empty(today));
          setDone(true);
          router.refresh();
        });
      }}
    >
      <FormError message={error} />
      {done && <p className="text-sm text-emerald-700">Transfer kaydedildi; maliyet iki projede de güncellendi.</p>}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="fromProjectId" label="Gönderen proje" required error={errors.fromProjectId}>
            <NativeSelect id="fromProjectId" value={values.fromProjectId} onChange={(e) => set({ fromProjectId: e.target.value })}>
              <option value="">Seçin</option>
              {options.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="toProjectId" label="Alan proje" required error={errors.toProjectId}>
            <NativeSelect id="toProjectId" value={values.toProjectId} onChange={(e) => set({ toProjectId: e.target.value })}>
              <option value="">Seçin</option>
              {options.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="date" label="Tarih" required error={errors.date}>
            <Input id="date" type="date" value={values.date} onChange={(e) => set({ date: e.target.value })} />
          </FormField>
          <FormField id="amount" label="Aktarılan maliyet (TL, KDV hariç)" required error={errors.amount}>
            <Input id="amount" inputMode="decimal" value={values.amount} onChange={(e) => set({ amount: e.target.value })} />
          </FormField>
          <FormField id="description" label="Malzeme" required error={errors.description} className="sm:col-span-2">
            <Input id="description" value={values.description} onChange={(e) => set({ description: e.target.value })} placeholder="ör. Artan Ø12 demir" />
          </FormField>
          <FormField id="costItemCode" label="Maliyet kalemi" required error={errors.costItemCode} className="sm:col-span-2">
            <Combobox
              id="costItemCode"
              options={options.costItems.map((c) => ({ value: c.code, label: `${c.code} ${c.name}`, indent: codeDepth(c.code) }))}
              value={values.costItemCode}
              onChange={(code) => {
                const unit = options.costItems.find((c) => c.code === code)?.unit;
                set({ costItemCode: code, ...(unit && !values.unit ? { unit } : {}) });
              }}
              placeholder="Kalem seçin"
            />
          </FormField>
          <FormField id="quantity" label="Miktar" error={errors.quantity}>
            <Input id="quantity" inputMode="decimal" value={values.quantity} onChange={(e) => set({ quantity: e.target.value })} />
          </FormField>
          <FormField id="unit" label="Birim">
            <Input id="unit" value={values.unit} onChange={(e) => set({ unit: e.target.value })} />
          </FormField>
          <FormField id="notes" label="Not" className="sm:col-span-2">
            <Input id="notes" value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
          </FormField>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <ArrowRightLeftIcon />}
          Transferi kaydet
        </Button>
      </div>
    </form>
  );
}

export function DeleteTransferButton({ transferId }: { transferId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        size="icon"
        variant="ghost"
        aria-label="Transferi sil"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteTransferAction(transferId);
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        <Trash2Icon />
      </Button>
    </span>
  );
}
