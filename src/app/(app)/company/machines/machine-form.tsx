"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SaveIcon, Trash2Icon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { FormMore } from "@/components/form-more";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { MACHINE_STATUS_LABELS } from "@/lib/machines/labels";
import { deleteMachineAction, saveMachineAction } from "./actions";

export type MachineFormValues = {
  code: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  plateOrSerial: string;
  year: string;
  status: string;
  usageUnit: string;
  internalRate: string;
  notes: string;
};

export const EMPTY_MACHINE: MachineFormValues = { code: "", name: "", category: "", brand: "", model: "", plateOrSerial: "", year: "", status: "ACTIVE", usageUnit: "HOUR", internalRate: "", notes: "" };

const CATEGORIES = ["Ekskavatör", "Beko loder", "Loder", "Dozer", "Greyder", "Silindir", "Kamyon", "Damperli kamyon", "Vinç", "Mobil vinç", "Forklift", "Jeneratör", "Kompresör", "Beton pompası", "Transmikser"];

/** Makine kartı (yeni / düzenle). */
export function MachineForm({ machineId, initial }: { machineId: string | null; initial: MachineFormValues }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const { run, error, fieldErrors, pending } = useAction();
  const set = (patch: Partial<MachineFormValues>) => setF((v) => ({ ...v, ...patch }));
  const unit = f.usageUnit === "DAY" ? "gün" : "saat";

  return (
    <Card className="max-w-3xl">
      <CardContent className="grid gap-4">
        <FormError message={error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="m-code" label="Makine kodu" required error={fieldErrors.code} hint="Kısa ve benzersiz, ör. EKS-01">
            <Input id="m-code" value={f.code} onChange={(e) => set({ code: e.target.value })} />
          </FormField>
          <FormField id="m-name" label="Makine adı" required error={fieldErrors.name}>
            <Input id="m-name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="ör. Paletli ekskavatör 21 ton" />
          </FormField>
          <FormField id="m-category" label="Cinsi" error={fieldErrors.category}>
            <Input id="m-category" list="machine-categories" value={f.category} onChange={(e) => set({ category: e.target.value })} placeholder="ör. Ekskavatör" />
            <datalist id="machine-categories">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormField>
          <FormField id="m-unit" label="Çalışma birimi">
            <NativeSelect id="m-unit" value={f.usageUnit} onChange={(e) => set({ usageUnit: e.target.value })}>
              <option value="HOUR">Saat</option>
              <option value="DAY">Gün</option>
            </NativeSelect>
          </FormField>
          <FormField id="m-rate" label="İç kullanım ücreti" error={fieldErrors.internalRate} hint={`TL / ${unit}, KDV hariç. Puantajda projeye bu ücretle yazılır.`}>
            <Input id="m-rate" inputMode="decimal" value={f.internalRate} onChange={(e) => set({ internalRate: e.target.value })} />
          </FormField>
        </div>
        <FormMore title="Ayrıntılar: marka, model, plaka / seri no, yıl, durum, not" hasValue={Boolean(f.brand || f.model || f.plateOrSerial || f.year || f.notes || f.status !== "ACTIVE")}>
          <FormField id="m-brand" label="Marka">
            <Input id="m-brand" value={f.brand} onChange={(e) => set({ brand: e.target.value })} />
          </FormField>
          <FormField id="m-model" label="Model">
            <Input id="m-model" value={f.model} onChange={(e) => set({ model: e.target.value })} />
          </FormField>
          <FormField id="m-plate" label="Plaka / seri no">
            <Input id="m-plate" value={f.plateOrSerial} onChange={(e) => set({ plateOrSerial: e.target.value })} />
          </FormField>
          <FormField id="m-year" label="Model yılı" error={fieldErrors.year}>
            <Input id="m-year" inputMode="numeric" value={f.year} onChange={(e) => set({ year: e.target.value })} />
          </FormField>
          <FormField id="m-status" label="Durum">
            <NativeSelect id="m-status" value={f.status} onChange={(e) => set({ status: e.target.value })}>
              {Object.entries(MACHINE_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="m-notes" label="Not" className="sm:col-span-2">
            <Textarea id="m-notes" value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
          </FormField>
        </FormMore>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => run(() => saveMachineAction(machineId, f), (r) => router.push(`/company/machines/${r.id}`))}>
            <SaveIcon />
            Kaydet
          </Button>
          {machineId && (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => {
                if (confirm("Makine silinsin mi? Puantajı olan makine silinemez.")) run(() => deleteMachineAction(machineId), () => router.push("/company/machines"));
              }}
            >
              <Trash2Icon />
              Sil
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
