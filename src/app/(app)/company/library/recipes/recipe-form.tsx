"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircleIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { Decimal, formatMoney, parseDecimalInput } from "@/lib/format";
import { saveRecipeAction } from "../actions";

export type RecipeResource = { id: string; code: string; name: string; unit: string; wastePercent: string; priceTry: string | null };
export type RecipeFormValues = { code: string; name: string; unit: string; description: string; active: boolean; lines: { key: string; resourceId: string | null; quantity: string }[] };

const num = (t: string) => {
  const p = parseDecimalInput(t);
  return p.ok && p.value ? p.value : new Decimal(0);
};
const key = () => Math.random().toString(36).slice(2);

export function RecipeForm({ recipeId, initial, resources, canManage }: { recipeId: string | null; initial: RecipeFormValues; resources: RecipeResource[]; canManage: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const { run, error, fieldErrors, pending } = useAction();
  const byId = new Map(resources.map((r) => [r.id, r]));
  const set = (patch: Partial<RecipeFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const setLine = (i: number, patch: Partial<RecipeFormValues["lines"][number]>) => set({ lines: values.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  let missing = 0;
  const lineAmounts = values.lines.map((l) => {
    const r = l.resourceId ? byId.get(l.resourceId) : undefined;
    if (!r?.priceTry) {
      if (r) missing++;
      return null;
    }
    return num(l.quantity).times(new Decimal(r.wastePercent).div(100).plus(1)).times(r.priceTry);
  });
  const total = lineAmounts.reduce<Decimal>((s, a) => s.plus(a ?? 0), new Decimal(0));

  return (
    <form
      className="grid max-w-4xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => saveRecipeAction(recipeId, { ...values, lines: values.lines.map((l) => ({ resourceId: l.resourceId ?? "", quantity: l.quantity })) }),
          (result) => router.push(`/company/library/recipes/${result.id}`),
        );
      }}
    >
      <FormError message={error} />
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <FormField id="rc-code" label="Kod" required error={fieldErrors.code}>
            <Input id="rc-code" value={values.code} disabled={!canManage} onChange={(e) => set({ code: e.target.value })} placeholder="R-08.05" />
          </FormField>
          <FormField id="rc-name" label="Ad" required error={fieldErrors.name} className="sm:col-span-2">
            <Input id="rc-name" value={values.name} disabled={!canManage} onChange={(e) => set({ name: e.target.value })} placeholder="Zemin seramiği" />
          </FormField>
          <FormField id="rc-unit" label="Birim" required error={fieldErrors.unit}>
            <Input id="rc-unit" value={values.unit} disabled={!canManage} onChange={(e) => set({ unit: e.target.value })} placeholder="m²" />
          </FormField>
          <FormField id="rc-desc" label="Açıklama" className="sm:col-span-4">
            <Textarea id="rc-desc" value={values.description} disabled={!canManage} onChange={(e) => set({ description: e.target.value })} />
          </FormField>
          {recipeId && canManage && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.active} onCheckedChange={(on) => set({ active: on === true })} />
              Aktif
            </label>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>1 {values.unit || "birim"} için kaynaklar</CardTitle>
          <CardDescription>Fire kaynağın kendi fire oranından eklenir. Fiyatlar kütüphaneden; fiyat değişince reçete ve onu kullanan bütçeler kendiliğinden güncellenir.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {fieldErrors.lines && <p className="text-sm text-destructive">{fieldErrors.lines}</p>}
          {values.lines.map((l, i) => {
            const r = l.resourceId ? byId.get(l.resourceId) : undefined;
            return (
              <div key={l.key} className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-[1fr_8rem_9rem_auto] sm:items-center">
                <Combobox
                  id={`rl-${i}`}
                  options={resources.map((res) => ({ value: res.id, label: `${res.name} (${res.unit})`, hint: res.code }))}
                  value={l.resourceId}
                  onChange={(v) => setLine(i, { resourceId: v })}
                  placeholder="Kaynak seçin"
                  disabled={!canManage}
                  invalid={Boolean(fieldErrors[`lines.${i}.resourceId`])}
                />
                <Input aria-label="Miktar" inputMode="decimal" value={l.quantity} disabled={!canManage} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder={r ? r.unit : "Miktar"} />
                <span className="text-right text-sm tabular-nums">
                  {lineAmounts[i] ? formatMoney(lineAmounts[i]!.toDecimalPlaces(2)) : r ? <span className="text-amber-700">fiyat yok</span> : "—"}
                  {r && Number(r.wastePercent) > 0 && <span className="block text-xs text-muted-foreground">fire %{r.wastePercent}</span>}
                </span>
                {canManage && (
                  <Button type="button" size="icon" variant="ghost" aria-label="Satırı sil" onClick={() => set({ lines: values.lines.filter((_, j) => j !== i) })}>
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canManage && (
              <Button type="button" variant="outline" onClick={() => set({ lines: [...values.lines, { key: key(), resourceId: null, quantity: "" }] })}>
                <PlusIcon />
                Kaynak ekle
              </Button>
            )}
            <p className="text-sm">
              Birim fiyat: <strong className="tabular-nums">{formatMoney(total.toDecimalPlaces(2))}</strong> / {values.unit || "birim"}
              {missing > 0 && <span className="text-amber-700"> · {missing} kaynağın fiyatı yok</span>}
            </p>
          </div>
        </CardContent>
      </Card>
      {canManage && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
            Kaydet
          </Button>
        </div>
      )}
    </form>
  );
}
