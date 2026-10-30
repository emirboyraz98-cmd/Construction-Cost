"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { formatMoney, formatNumber } from "@/lib/format";
import { deleteLandownerAction, saveLandownerAction } from "../units/actions";

export type LandownerView = {
  id: string;
  name: string;
  sharePercent: string;
  monthlyRentAid: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  markedGross: string;
  unitCount: number;
};

type Form = { name: string; sharePercent: string; monthlyRentAid: string; phone: string; email: string; notes: string };

export function LandownersManager({ projectId, landowners, canEdit }: { projectId: string; landowners: LandownerView[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const { run, error, fieldErrors, pending, reset } = useAction();
  const set = (patch: Partial<Form>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });
  return (
    <div className="grid gap-3">
      {!editing && <FormError message={error} />}
      {landowners.length === 0 ? (
        <p className="text-sm text-muted-foreground">Arsa sahibi girilmemiş.</p>
      ) : (
        <ul className="grid gap-2">
          {landowners.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{l.name}</span> · pay %{formatNumber(l.sharePercent, 4)}
                <span className="block text-xs text-muted-foreground">
                  {l.unitCount} bölüm işaretli ({formatNumber(l.markedGross)} m² brüt)
                  {l.monthlyRentAid && ` · kira yardımı ${formatMoney(l.monthlyRentAid)}/ay`}
                  {l.phone && ` · ${l.phone}`}
                </span>
              </span>
              {canEdit && (
                <span className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Düzenle"
                    onClick={() => {
                      reset();
                      setEditing({
                        id: l.id,
                        form: {
                          name: l.name,
                          sharePercent: formatNumber(l.sharePercent, 4),
                          monthlyRentAid: l.monthlyRentAid ? formatNumber(l.monthlyRentAid) : "",
                          phone: l.phone ?? "",
                          email: l.email ?? "",
                          notes: l.notes ?? "",
                        },
                      });
                    }}
                  >
                    <PencilIcon />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Sil" disabled={pending} onClick={() => run(() => deleteLandownerAction(projectId, l.id))}>
                    <Trash2Icon />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => {
            reset();
            setEditing({ id: null, form: { name: "", sharePercent: "", monthlyRentAid: "", phone: "", email: "", notes: "" } });
          }}
        >
          <PlusIcon />
          Arsa sahibi ekle
        </Button>
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Arsa sahibini düzenle" : "Arsa sahibi ekle"}</DialogTitle>
          </DialogHeader>
          <FormError message={error} />
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="lo-name" label="Ad soyad" required error={fieldErrors.name} className="sm:col-span-2">
                <Input id="lo-name" value={editing.form.name} onChange={(e) => set({ name: e.target.value })} />
              </FormField>
              <FormField id="lo-share" label="Pay oranı (%)" required error={fieldErrors.sharePercent} hint="Sözleşmedeki yüzde, ör. 45">
                <Input id="lo-share" inputMode="decimal" value={editing.form.sharePercent} onChange={(e) => set({ sharePercent: e.target.value })} />
              </FormField>
              <FormField id="lo-rent" label="Aylık kira yardımı (TL)" error={fieldErrors.monthlyRentAid}>
                <Input id="lo-rent" inputMode="decimal" value={editing.form.monthlyRentAid} onChange={(e) => set({ monthlyRentAid: e.target.value })} />
              </FormField>
              <FormField id="lo-phone" label="Telefon">
                <Input id="lo-phone" value={editing.form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </FormField>
              <FormField id="lo-email" label="E-posta">
                <Input id="lo-email" value={editing.form.email} onChange={(e) => set({ email: e.target.value })} />
              </FormField>
              <FormField id="lo-notes" label="Not" className="sm:col-span-2">
                <Textarea id="lo-notes" value={editing.form.notes} onChange={(e) => set({ notes: e.target.value })} />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => editing && run(() => saveLandownerAction(projectId, editing.id, editing.form), () => setEditing(null))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
