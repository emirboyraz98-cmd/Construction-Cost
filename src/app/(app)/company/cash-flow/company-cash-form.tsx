"use client";

import { useState } from "react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { formatNumber } from "@/lib/format";
import { saveCompanyCashAction } from "./actions";

export function CompanyCashForm({ openingCash, monthlyOverhead }: { openingCash: string; monthlyOverhead: string }) {
  const [form, setForm] = useState({ openingCash: formatNumber(openingCash, 2), monthlyOverhead: formatNumber(monthlyOverhead, 2) });
  const { run, error, fieldErrors, pending } = useAction();
  return (
    <div className="grid grid-cols-1 gap-3">
      <FormError message={error} />
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
        <FormField id="cc-open" label="Şirket başlangıç nakdi (TL)" error={fieldErrors.openingCash}>
          <Input id="cc-open" inputMode="decimal" value={form.openingCash} onChange={(e) => setForm((f) => ({ ...f, openingCash: e.target.value }))} />
        </FormField>
        <FormField id="cc-overhead" label="Genel merkez gideri (aylık, KDV dahil)" error={fieldErrors.monthlyOverhead} hint="Bu aydan itibaren her aya yazılır.">
          <Input id="cc-overhead" inputMode="decimal" value={form.monthlyOverhead} onChange={(e) => setForm((f) => ({ ...f, monthlyOverhead: e.target.value }))} />
        </FormField>
        <div className="pb-0.5">
          <Button disabled={pending} onClick={() => run(() => saveCompanyCashAction(form))}>
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}
