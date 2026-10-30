"use client";

import { useState } from "react";
import { ListPlusIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/components/use-action";
import type { CoefficientBasis } from "@/generated/prisma/enums";
import { COEFFICIENT_BASIS_LABELS } from "@/lib/budget/labels";
import { formatNumber } from "@/lib/format";
import { addCoefficientLinesAction, deleteCoefficientAction, saveCoefficientAction } from "../budget/actions";

export type CoefficientView = {
  id: string;
  costItemCode: string;
  costItemName: string | null;
  name: string;
  basis: CoefficientBasis;
  coefficient: string;
  unit: string;
  note: string | null;
  base: string;
  quantity: string;
  actualQuantity: string;
  actualCoefficient: string | null;
  inBudget: boolean;
  /** Diğer projelerde gerçekleşen katsayı ortalaması */
  otherAverage: string | null;
  otherCount: number;
};

type Form = { costItemCode: string; name: string; basis: CoefficientBasis; coefficient: string; unit: string; note: string };

export function CoefficientsPanel({ projectId, coefficients, canEdit }: { projectId: string; coefficients: CoefficientView[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<{ id: string | null; form: Form; suggestion?: string | null } | null>(null);
  const [message, setMessage] = useState<string>();
  const { run, error, fieldErrors, pending, reset } = useAction();
  const missing = coefficients.filter((c) => !c.inBudget && c.costItemName);
  const set = (patch: Partial<Form>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });

  return (
    <div className="grid grid-cols-1 gap-3">
      {!editing && <FormError message={error} />}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setEditing({ id: null, form: { costItemCode: "", name: "", basis: "CONSTRUCTION_AREA", coefficient: "", unit: "", note: "" } });
            }}
          >
            <PlusIcon />
            Katsayı ekle
          </Button>
          {missing.length > 0 && (
            <Button
              disabled={pending}
              onClick={() => run(() => addCoefficientLinesAction(projectId, missing.map((c) => c.id)), (r) => setMessage(`${r.count} parametrik bütçe satırı açıldı; birim fiyatlarını Bütçe ekranından girin.`))}
            >
              <ListPlusIcon />
              Bütçede olmayanları ekle ({missing.length})
            </Button>
          )}
        </div>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Kalem / katsayı</TableHead>
              <TableHead className="text-right">Katsayı</TableHead>
              <TableHead className="text-right">Taban</TableHead>
              <TableHead className="text-right">Parametrik miktar</TableHead>
              <TableHead className="text-right">Gerçekleşen</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {coefficients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-4">
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.costItemCode} {c.costItemName ?? "(kalem projede yok)"}
                    {c.inBudget && " · bütçede"}
                  </span>
                  {c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatNumber(c.coefficient, 6)} {c.unit}
                  <span className="block text-xs text-muted-foreground">/ {COEFFICIENT_BASIS_LABELS[c.basis]}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(c.base, 2)}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatNumber(c.quantity, 2)} {c.unit}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {Number(c.actualQuantity) > 0 ? (
                    <>
                      {formatNumber(c.actualQuantity, 2)} {c.unit}
                      <span className="block text-xs text-muted-foreground">katsayı {c.actualCoefficient ? formatNumber(c.actualCoefficient, 4) : "—"}</span>
                    </>
                  ) : (
                    "—"
                  )}
                  {c.otherAverage && (
                    <span className="block text-xs text-sky-800">
                      Diğer {c.otherCount} projede ort. {formatNumber(c.otherAverage, 4)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {canEdit && (
                    <span className="flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Düzenle"
                        onClick={() => {
                          reset();
                          setEditing({ id: c.id, form: { costItemCode: c.costItemCode, name: c.name, basis: c.basis, coefficient: formatNumber(c.coefficient, 6), unit: c.unit, note: c.note ?? "" }, suggestion: c.otherAverage ?? c.actualCoefficient });
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Sil" disabled={pending} onClick={() => run(() => deleteCoefficientAction(projectId, c.id))}>
                        <Trash2Icon />
                      </Button>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Katsayıyı düzenle" : "Katsayı ekle"}</DialogTitle>
          </DialogHeader>
          <FormError message={error} />
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="c-code" label="Maliyet kalemi kodu" required error={fieldErrors.costItemCode}>
                <Input id="c-code" value={editing.form.costItemCode} onChange={(e) => set({ costItemCode: e.target.value })} placeholder="05.04.01" />
              </FormField>
              <FormField id="c-name" label="Ad" required error={fieldErrors.name}>
                <Input id="c-name" value={editing.form.name} onChange={(e) => set({ name: e.target.value })} />
              </FormField>
              <FormField
                id="c-coef"
                label="Katsayı"
                required
                error={fieldErrors.coefficient}
                hint={
                  editing.suggestion ? (
                    <button type="button" className="text-sky-800 underline" onClick={() => set({ coefficient: formatNumber(editing.suggestion!, 6) })}>
                      Gerçekleşen değeri kullan: {formatNumber(editing.suggestion, 4)}
                    </button>
                  ) : undefined
                }
              >
                <Input id="c-coef" inputMode="decimal" value={editing.form.coefficient} onChange={(e) => set({ coefficient: e.target.value })} />
              </FormField>
              <FormField id="c-unit" label="Birim" required error={fieldErrors.unit}>
                <Input id="c-unit" value={editing.form.unit} onChange={(e) => set({ unit: e.target.value })} />
              </FormField>
              <FormField id="c-basis" label="Taban" className="sm:col-span-2">
                <NativeSelect id="c-basis" value={editing.form.basis} onChange={(e) => set({ basis: e.target.value as CoefficientBasis })}>
                  {Object.entries(COEFFICIENT_BASIS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l} başına
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="c-note" label="Not" className="sm:col-span-2">
                <Input id="c-note" value={editing.form.note} onChange={(e) => set({ note: e.target.value })} />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => editing && run(() => saveCoefficientAction(projectId, editing.id, editing.form), () => setEditing(null))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
