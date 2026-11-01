"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { addLandInstallmentAction } from "./actions";

/** Arsa bedeli taksiti ekleme (vadeli, ödenmemiş harcama olarak). */
export function LandInstallmentForm({ projectId, today }: { projectId: string; today: string }) {
  const blank = { dueDate: today, amount: "", vatRate: "0", description: "" };
  const [form, setForm] = useState(blank);
  const { run, error, fieldErrors, pending } = useAction();
  return (
    <div className="grid gap-2">
      <FormError message={error} />
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
        <FormField id="li-due" label="Vade" error={fieldErrors.dueDate}>
          <Input id="li-due" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
        </FormField>
        <FormField id="li-amount" label="Tutar (TL)" error={fieldErrors.amount}>
          <Input id="li-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </FormField>
        <FormField id="li-vat" label="KDV %" error={fieldErrors.vatRate} hint="Muhasebeciye sorun">
          <Input id="li-vat" inputMode="decimal" value={form.vatRate} onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))} />
        </FormField>
        <FormField id="li-desc" label="Açıklama" className="col-span-2 sm:col-span-1">
          <Input id="li-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="ör. 2. taksit" />
        </FormField>
        <Button disabled={pending} onClick={() => run(() => addLandInstallmentAction(projectId, form), () => setForm(blank))}>
          <PlusIcon />
          Taksit ekle
        </Button>
      </div>
    </div>
  );
}
