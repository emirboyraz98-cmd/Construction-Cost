"use client";

import { useState } from "react";
import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { formatNumber } from "@/lib/format";
import { deleteScenarioAction, duplicateScenarioAction, saveScenarioAction } from "../cash-flow/actions";

export type ScenarioView = {
  id: string;
  name: string;
  note: string | null;
  monthlyInflationPercent: string | null;
  fxChangePercent: string | null;
  monthlyInterestPercent: string | null;
  delayMonths: number;
  salesPriceChangePercent: string;
  salesSpeedPercent: string;
  landownerSharePercent: string | null;
  adjustments: { costItemCode: string; changePercent: string }[];
};

const n = (v: string | null) => (v == null ? "" : formatNumber(v, 3));
const empty = { name: "", note: "", monthlyInflationPercent: "", fxChangePercent: "", monthlyInterestPercent: "", delayMonths: "0", salesPriceChangePercent: "0", salesSpeedPercent: "100", landownerSharePercent: "", adjustments: [] as { costItemCode: string; changePercent: string }[] };

function ScenarioDialog({ projectId, scenario, onClose }: { projectId: string; scenario: ScenarioView | null; onClose: () => void }) {
  const [form, setForm] = useState(
    scenario
      ? {
          name: scenario.name,
          note: scenario.note ?? "",
          monthlyInflationPercent: n(scenario.monthlyInflationPercent),
          fxChangePercent: n(scenario.fxChangePercent),
          monthlyInterestPercent: n(scenario.monthlyInterestPercent),
          delayMonths: String(scenario.delayMonths),
          salesPriceChangePercent: n(scenario.salesPriceChangePercent),
          salesSpeedPercent: n(scenario.salesSpeedPercent),
          landownerSharePercent: n(scenario.landownerSharePercent),
          adjustments: scenario.adjustments.map((a) => ({ costItemCode: a.costItemCode, changePercent: n(a.changePercent) })),
        }
      : empty,
  );
  const { run, error, fieldErrors, pending } = useAction();
  const set = (k: Exclude<keyof typeof form, "adjustments">, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const f = (k: Exclude<keyof typeof form, "adjustments" | "name" | "note">, label: string, hint?: string) => (
    <FormField id={`sn-${k}`} label={label} hint={hint} error={fieldErrors[k]}>
      <Input id={`sn-${k}`} inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </FormField>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{scenario ? "Senaryoyu düzenle" : "Yeni senaryo"}</DialogTitle>
          <DialogDescription>Boş bırakılan oranlar baz varsayımı kullanır. Fiyat değişimleri yalnızca kalan (harcanmamış) maliyete uygulanır; bağlantıyla sabitlenmiş miktar etkilenmez.</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField id="sn-name" label="Ad" required error={fieldErrors.name} className="sm:col-span-2">
            <Input id="sn-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ör. Kötümser" />
          </FormField>
          {f("delayMonths", "Gecikme (ay)")}
          {f("monthlyInflationPercent", "Aylık maliyet artışı (%)", "Boş = baz")}
          {f("fxChangePercent", "Kur değişimi (%)", "Boş = baz")}
          {f("monthlyInterestPercent", "Aylık finansman (%)", "Boş = baz")}
          {f("salesPriceChangePercent", "Satış fiyatı değişimi (%)", "Satılmamış bölümler")}
          {f("salesSpeedPercent", "Satış hızı (%)", "100 = baz hız")}
          {f("landownerSharePercent", "Arsa sahibi payı (%)", "Boş = mevcut bölüm dağılımı")}
          <FormField id="sn-note" label="Not" className="sm:col-span-3">
            <Input id="sn-note" value={form.note} onChange={(e) => set("note", e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <p className="text-sm font-medium">Kalem fiyat değişimleri</p>
          <p className="text-xs text-muted-foreground">Kod öneki: 05.05 yalnızca demir, 05 tüm kaba inşaat, 08 tüm ince işler.</p>
          {form.adjustments.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label="Kalem kodu" className="w-32" value={a.costItemCode} onChange={(e) => setForm((s) => ({ ...s, adjustments: s.adjustments.map((x, j) => (j === i ? { ...x, costItemCode: e.target.value } : x)) }))} placeholder="05.05" />
              <Input aria-label="Değişim (%)" className="w-28" inputMode="decimal" value={a.changePercent} onChange={(e) => setForm((s) => ({ ...s, adjustments: s.adjustments.map((x, j) => (j === i ? { ...x, changePercent: e.target.value } : x)) }))} placeholder="15" />
              <span className="text-sm text-muted-foreground">%</span>
              <Button size="icon" variant="ghost" aria-label="Satırı sil" onClick={() => setForm((s) => ({ ...s, adjustments: s.adjustments.filter((_, j) => j !== i) }))}>
                <Trash2Icon />
              </Button>
            </div>
          ))}
          {Object.entries(fieldErrors)
            .filter(([k]) => k.startsWith("adjustments"))
            .map(([k, msg]) => (
              <p key={k} className="text-sm text-destructive">
                {msg}
              </p>
            ))}
          <div>
            <Button size="sm" variant="outline" onClick={() => setForm((s) => ({ ...s, adjustments: [...s.adjustments, { costItemCode: "", changePercent: "" }] }))}>
              <PlusIcon />
              Kalem ekle
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button disabled={pending} onClick={() => run(() => saveScenarioAction(projectId, scenario?.id ?? null, form), onClose)}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewScenarioButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Yeni senaryo
      </Button>
      {open && <ScenarioDialog projectId={projectId} scenario={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ScenarioActions({ projectId, scenario }: { projectId: string; scenario: ScenarioView }) {
  const [open, setOpen] = useState(false);
  const { run, error, pending } = useAction();
  return (
    <span className="inline-flex items-center gap-0.5">
      <Button size="icon" variant="ghost" className="size-7" aria-label={`${scenario.name} düzenle`} onClick={() => setOpen(true)}>
        <PencilIcon />
      </Button>
      <Button size="icon" variant="ghost" className="size-7" aria-label={`${scenario.name} kopyala`} disabled={pending} onClick={() => run(() => duplicateScenarioAction(projectId, scenario.id))}>
        <CopyIcon />
      </Button>
      <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={`${scenario.name} sil`} disabled={pending} onClick={() => confirm(`${scenario.name} silinsin mi?`) && run(() => deleteScenarioAction(projectId, scenario.id))}>
        <Trash2Icon />
      </Button>
      <FormError message={error} />
      {open && <ScenarioDialog projectId={projectId} scenario={scenario} onClose={() => setOpen(false)} />}
    </span>
  );
}
