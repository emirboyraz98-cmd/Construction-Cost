"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { CheckIcon, ClockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { FormError, FormField } from "@/components/form-field";
import { FormMore } from "@/components/form-more";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import { formatMoney, parseDecimalInput } from "@/lib/format";
import { MACHINE_ENTRY_TYPE_LABELS } from "@/lib/machines/labels";
import { INCOME_TYPES } from "@/lib/machines/machines";
import { addMachineEntryAction, addMachineUsageAction, deleteMachineEntryAction, deleteMachineUsageAction, setMachineEntryPaidAction } from "../actions";

type Project = { id: string; name: string };
const codeDepth = (code: string) => code.split(".").length - 1;

/** Nakit hareketi ekleme (gider veya gelir; ödenmemişse vadeli). */
export function EntryDialog({ machineId, projects, today }: { machineId: string; projects: Project[]; today: string }) {
  const blank = { date: today, type: "FUEL", amount: "", description: "", quantity: "", unit: "", paid: true, dueDate: "", projectId: "", counterparty: "" };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const { run, error, fieldErrors, pending, reset } = useAction();
  const set = (patch: Partial<typeof blank>) => setF((v) => ({ ...v, ...patch }));
  const types = Object.entries(MACHINE_ENTRY_TYPE_LABELS);
  return (
    <>
      <Button size="sm" onClick={() => (reset(), setF(blank), setOpen(true))}>
        <PlusIcon />
        Hareket ekle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nakit hareketi</DialogTitle>
            <DialogDescription>Tutar KDV dahil, TL. Gelecek taksitleri “ödenmedi” ve vadesiyle girin; nakit akışında o aya yazılır.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="me-type" label="Hareket türü">
              <NativeSelect id="me-type" value={f.type} onChange={(e) => set({ type: e.target.value })}>
                <optgroup label="Gider (kasadan çıkış)">
                  {types
                    .filter(([v]) => !INCOME_TYPES.includes(v as never))
                    .map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Gelir (kasaya giriş)">
                  {types
                    .filter(([v]) => INCOME_TYPES.includes(v as never))
                    .map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                </optgroup>
              </NativeSelect>
            </FormField>
            <FormField id="me-date" label="Tarih" required error={fieldErrors.date}>
              <Input id="me-date" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </FormField>
            <FormField id="me-amount" label="Tutar (TL, KDV dahil)" required error={fieldErrors.amount}>
              <Input id="me-amount" inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
            </FormField>
            <FormField id="me-desc" label="Açıklama" error={fieldErrors.description}>
              <Input id="me-desc" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="ör. 250 saat bakımı" />
            </FormField>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={f.paid} onCheckedChange={(v) => set({ paid: v === true })} />
              Ödendi / tahsil edildi
            </label>
            {!f.paid && (
              <FormField id="me-due" label="Vade" required error={fieldErrors.dueDate}>
                <Input id="me-due" type="date" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              </FormField>
            )}
          </div>
          <FormMore title="Ayrıntılar: miktar, şantiye, tedarikçi / müşteri" hasValue={Boolean(f.quantity || f.projectId || f.counterparty)}>
            <FormField id="me-qty" label="Miktar (bilgi)" error={fieldErrors.quantity}>
              <Input id="me-qty" inputMode="decimal" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} placeholder="ör. 400" />
            </FormField>
            <FormField id="me-unit" label="Birim">
              <Input id="me-unit" value={f.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="ör. litre" />
            </FormField>
            <FormField id="me-project" label="Şantiye">
              <NativeSelect id="me-project" value={f.projectId} onChange={(e) => set({ projectId: e.target.value })}>
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="me-cp" label="Tedarikçi / müşteri">
              <Input id="me-cp" value={f.counterparty} onChange={(e) => set({ counterparty: e.target.value })} />
            </FormField>
          </FormMore>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => run(() => addMachineEntryAction(machineId, f), () => setOpen(false))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Puantaj: makinenin projede çalışması; projeye iç maliyet olarak yazılır. */
export function UsageDialog({
  machineId,
  unitLabel,
  defaultRate,
  projects,
  costItems,
  today,
}: {
  machineId: string;
  unitLabel: string;
  defaultRate: string;
  projects: Project[];
  costItems: Record<string, { id: string; code: string; name: string }[]>;
  today: string;
}) {
  const blank = { date: today, projectId: projects.length === 1 ? projects[0].id : "", costItemId: "", quantity: "", rate: defaultRate, description: "" };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const { run, error, fieldErrors, pending, reset } = useAction();
  const set = (patch: Partial<typeof blank>) => setF((v) => ({ ...v, ...patch }));
  const q = parseDecimalInput(f.quantity);
  const r = parseDecimalInput(f.rate);
  const total = q.ok && r.ok && q.value && r.value ? q.value.times(r.value) : new Decimal(0);
  return (
    <>
      <Button size="sm" onClick={() => (reset(), setF(blank), setOpen(true))} disabled={projects.length === 0}>
        <ClockIcon />
        Çalışma gir
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Puantaj: projede çalışma</DialogTitle>
            <DialogDescription>Çalışma × birim ücret projeye maliyet olarak yazılır (onaylı, borç oluşturmaz). Şirket kasasından ayrıca para çıkmaz; makinenin giderleri nakit hareketlerindedir.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="mu-date" label="Tarih" required error={fieldErrors.date}>
              <Input id="mu-date" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </FormField>
            <FormField id="mu-project" label="Proje" required error={fieldErrors.projectId}>
              <NativeSelect id="mu-project" value={f.projectId} onChange={(e) => set({ projectId: e.target.value, costItemId: "" })}>
                <option value="">Seçin…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="mu-item" label="Maliyet kalemi" required error={fieldErrors.costItemId} className="sm:col-span-2">
              <Combobox
                id="mu-item"
                options={(costItems[f.projectId] ?? []).map((i) => ({ value: i.id, label: `${i.code} ${i.name}`, indent: codeDepth(i.code) }))}
                value={f.costItemId || null}
                onChange={(v) => set({ costItemId: v ?? "" })}
                placeholder={f.projectId ? "Kalem seçin (ör. 04.01 kazı)" : "Önce proje seçin"}
                disabled={!f.projectId}
              />
            </FormField>
            <FormField id="mu-qty" label={`Çalışma (${unitLabel})`} required error={fieldErrors.quantity}>
              <Input id="mu-qty" inputMode="decimal" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} />
            </FormField>
            <FormField id="mu-rate" label={`Birim ücret (TL / ${unitLabel})`} required error={fieldErrors.rate}>
              <Input id="mu-rate" inputMode="decimal" value={f.rate} onChange={(e) => set({ rate: e.target.value })} />
            </FormField>
            <FormField id="mu-desc" label="Açıklama" className="sm:col-span-2">
              <Input id="mu-desc" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="ör. temel kazısı" />
            </FormField>
          </div>
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            Projeye yazılacak: <strong className="tabular-nums">{formatMoney(total)}</strong>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => run(() => addMachineUsageAction(machineId, f), () => setOpen(false))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EntryActions({ entryId, paid }: { entryId: string; paid: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <span className="flex items-center gap-1">
      {error && <span className="text-xs text-destructive">{error}</span>}
      {!paid && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setMachineEntryPaidAction(entryId, true))}>
          <CheckIcon />
          Ödendi
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" aria-label="Sil" disabled={pending} onClick={() => confirm("Hareket silinsin mi?") && run(() => deleteMachineEntryAction(entryId))}>
        <Trash2Icon />
      </Button>
    </span>
  );
}

export function UsageDelete({ usageId }: { usageId: string }) {
  const { run, pending, error } = useAction();
  return (
    <span className="flex items-center gap-1">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button size="icon-sm" variant="ghost" aria-label="Sil" disabled={pending} onClick={() => confirm("Puantaj silinsin mi? Projedeki maliyet kaydı da silinir.") && run(() => deleteMachineUsageAction(usageId))}>
        <Trash2Icon />
      </Button>
    </span>
  );
}
