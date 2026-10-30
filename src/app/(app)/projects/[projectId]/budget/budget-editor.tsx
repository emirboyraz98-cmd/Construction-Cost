"use client";

import { useState } from "react";
import { AlertTriangleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { ChipGroup } from "@/components/expenses/expense-form";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import type { BudgetPriceSource, Currency, QuantitySource, SupplyMethod } from "@/generated/prisma/enums";
import { COEFFICIENT_BASIS_LABELS, QUANTITY_SOURCE_LABELS } from "@/lib/budget/labels";
import { SUPPLY_METHOD_LABELS } from "@/lib/connections/labels";
import { codeDepth } from "@/lib/cost-tree/tree";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/expenses/labels";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteBudgetLineAction, saveBudgetLineAction } from "./actions";

export type BudgetItem = { id: string; code: string; name: string; unit: string | null; isLeaf: boolean; active: boolean; budget: string; actual: string };

export type BudgetLineView = {
  id: string;
  costItemId: string;
  blockId: string | null;
  blockName: string | null;
  description: string | null;
  supplyMethod: SupplyMethod | null;
  quantitySource: QuantitySource;
  quantity: string;
  storedQuantity: string;
  formula: string | null;
  coefficientId: string | null;
  unit: string | null;
  priceSource: BudgetPriceSource;
  recipeId: string | null;
  resourceId: string | null;
  unitPrice: string | null;
  currency: Currency;
  unitPriceTry: string | null;
  priceLabel: string;
  wastePercent: string;
  priceNote: string | null;
  amount: string;
  warnings: string[];
};

type Options = {
  blocks: { id: string; name: string }[];
  recipes: { id: string; code: string; name: string; unit: string }[];
  resources: { id: string; code: string; name: string; unit: string }[];
  coefficients: { id: string; name: string; costItemCode: string; basis: keyof typeof COEFFICIENT_BASIS_LABELS; coefficient: string; unit: string }[];
  variables: { name: string; label: string; value: string }[];
};

type LineForm = {
  costItemId: string | null;
  blockId: string;
  description: string;
  supplyMethod: string;
  quantitySource: QuantitySource;
  quantity: string;
  formula: string;
  coefficientId: string | null;
  unit: string;
  priceSource: BudgetPriceSource;
  recipeId: string | null;
  resourceId: string | null;
  unitPrice: string;
  currency: Currency;
  wastePercent: string;
  priceNote: string;
};

const emptyLine = (item?: BudgetItem): LineForm => ({
  costItemId: item?.id ?? null,
  blockId: "",
  description: "",
  supplyMethod: "",
  quantitySource: "MANUAL",
  quantity: "",
  formula: "",
  coefficientId: null,
  unit: item?.unit ?? "",
  priceSource: "MANUAL",
  recipeId: null,
  resourceId: null,
  unitPrice: "",
  currency: "TRY",
  wastePercent: "0",
  priceNote: "",
});

const toForm = (l: BudgetLineView): LineForm => ({
  costItemId: l.costItemId,
  blockId: l.blockId ?? "",
  description: l.description ?? "",
  supplyMethod: l.supplyMethod ?? "",
  quantitySource: l.quantitySource,
  quantity: l.quantitySource === "MANUAL" ? formatNumber(l.storedQuantity, 4) : "",
  formula: l.formula ?? "",
  coefficientId: l.coefficientId,
  unit: l.unit ?? "",
  priceSource: l.priceSource,
  recipeId: l.recipeId,
  resourceId: l.resourceId,
  unitPrice: l.unitPrice ? formatNumber(l.unitPrice, 4) : "",
  currency: l.currency,
  wastePercent: formatNumber(l.wastePercent, 2),
  priceNote: l.priceNote ?? "",
});

export function BudgetEditor({
  projectId,
  items,
  lines,
  options,
  canEdit,
}: {
  projectId: string;
  items: BudgetItem[];
  lines: BudgetLineView[];
  options: Options;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<{ id: string | null; form: LineForm } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { run, error, fieldErrors, pending, reset } = useAction();
  const set = (patch: Partial<LineForm>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });
  const linesByItem = new Map<string, BudgetLineView[]>();
  for (const l of lines) (linesByItem.get(l.costItemId) ?? linesByItem.set(l.costItemId, []).get(l.costItemId)!).push(l);
  const visible = items.filter((i) => showAll || codeDepth(i.code) === 0 || Number(i.budget) !== 0 || Number(i.actual) !== 0);
  const open = (id: string | null, form: LineForm) => {
    reset();
    setEditing({ id, form });
  };
  const f = editing?.form;

  return (
    <div className="grid grid-cols-1 gap-3">
      {!editing && <FormError message={error} />}
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button onClick={() => open(null, emptyLine())}>
            <PlusIcon />
            Bütçe satırı ekle
          </Button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Bütçesi boş kalemleri de göster
        </label>
      </div>

      <Card className="gap-0 overflow-x-auto py-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Kalem</th>
              <th className="px-2 py-2 text-right font-medium">Miktar</th>
              <th className="px-2 py-2 text-right font-medium">Birim fiyat (TL)</th>
              <th className="px-2 py-2 text-right font-medium">Bütçe</th>
              <th className="px-4 py-2 text-right font-medium">Gerçekleşen</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const depth = codeDepth(item.code);
              const own = linesByItem.get(item.id) ?? [];
              return [
                <tr key={item.id} className={cn("border-b", depth === 0 && "bg-muted/40 font-semibold")}>
                  <td className="px-4 py-2" style={{ paddingLeft: `${1 + depth * 1.25}rem` }}>
                    <span className="flex items-center gap-1">
                      <span className={cn(!item.active && "text-muted-foreground line-through")}>
                        {item.code} {item.name}
                      </span>
                      {canEdit && item.isLeaf && item.active && (
                        <Button size="icon" variant="ghost" className="size-6" aria-label={`${item.code} satır ekle`} onClick={() => open(null, emptyLine(item))}>
                          <PlusIcon className="size-3.5" />
                        </Button>
                      )}
                    </span>
                  </td>
                  <td />
                  <td />
                  <td className="px-2 py-2 text-right tabular-nums">{Number(item.budget) ? formatMoney(item.budget) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{Number(item.actual) ? formatMoney(item.actual) : "—"}</td>
                </tr>,
                ...own.map((l) => (
                  <tr key={l.id} className="border-b bg-background/50 text-xs">
                    <td className="px-4 py-1.5" style={{ paddingLeft: `${2 + depth * 1.25}rem` }}>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm">{l.description || "Satır"}</span>
                        {l.blockName && <span className="text-muted-foreground">· {l.blockName}</span>}
                        <span className="rounded bg-muted px-1.5 py-0.5">{QUANTITY_SOURCE_LABELS[l.quantitySource]}</span>
                        <span className="text-muted-foreground">{l.priceLabel}</span>
                        {l.supplyMethod && <span className="text-muted-foreground">· {SUPPLY_METHOD_LABELS[l.supplyMethod]}</span>}
                        {canEdit && (
                          <span className="flex">
                            <Button size="icon" variant="ghost" className="size-6" aria-label="Düzenle" onClick={() => open(l.id, toForm(l))}>
                              <PencilIcon className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-6" aria-label="Sil" disabled={pending} onClick={() => run(() => deleteBudgetLineAction(projectId, l.id))}>
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </span>
                        )}
                      </span>
                      {l.warnings.map((w, i) => (
                        <span key={i} className="flex items-center gap-1 text-amber-700">
                          <AlertTriangleIcon className="size-3" />
                          {w}
                        </span>
                      ))}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                      {formatNumber(l.quantity, 2)} {l.unit}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                      {l.unitPriceTry ? formatMoney(l.unitPriceTry) : "—"}
                      {Number(l.wastePercent) > 0 && <span className="block text-muted-foreground">+%{formatNumber(l.wastePercent)} fire</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(l.amount)}</td>
                    <td />
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Bütçe satırını düzenle" : "Bütçe satırı"}</DialogTitle>
            <DialogDescription>Kalem maliyeti = miktar × birim fiyat × (1 + fire). Reçete ve kütüphane fiyatları canlı hesaplanır.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          {f && (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="b-item" label="Maliyet kalemi" required error={fieldErrors.costItemId} className="sm:col-span-2">
                  <Combobox
                    id="b-item"
                    options={items.filter((i) => i.active).map((i) => ({ value: i.id, label: `${i.code} ${i.name}`, indent: codeDepth(i.code), emphasis: !i.isLeaf }))}
                    value={f.costItemId}
                    onChange={(v) => set({ costItemId: v, unit: f.unit || items.find((i) => i.id === v)?.unit || "" })}
                    placeholder="Kalem seçin"
                  />
                </FormField>
                <FormField id="b-desc" label="Açıklama">
                  <Input id="b-desc" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="ör. C30 hazır beton" />
                </FormField>
                <FormField id="b-block" label="Blok">
                  <NativeSelect id="b-block" value={f.blockId} onChange={(e) => set({ blockId: e.target.value })}>
                    <option value="">Ortak (alan oranında dağıtılır)</option>
                    {options.blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField id="b-supply" label="Temin şekli" className="sm:col-span-2">
                  <NativeSelect id="b-supply" value={f.supplyMethod} onChange={(e) => set({ supplyMethod: e.target.value })}>
                    <option value="">Belirtilmemiş</option>
                    {Object.entries(SUPPLY_METHOD_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>

              <fieldset className="grid gap-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">Miktar (metraj)</legend>
                <ChipGroup
                  label="Miktar kaynağı"
                  value={f.quantitySource}
                  onChange={(v) => set({ quantitySource: v })}
                  options={[
                    { value: "MANUAL", label: "Manuel" },
                    { value: "FORMULA", label: "Formül" },
                    { value: "PARAMETRIC", label: "Parametrik" },
                  ]}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  {f.quantitySource === "MANUAL" && (
                    <FormField id="b-qty" label="Miktar" required error={fieldErrors.quantity} className="sm:col-span-2">
                      <Input id="b-qty" inputMode="decimal" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} />
                    </FormField>
                  )}
                  {f.quantitySource === "FORMULA" && (
                    <FormField
                      id="b-formula"
                      label="Formül"
                      required
                      error={fieldErrors.formula}
                      className="sm:col-span-2"
                      hint={`Değişkenler: ${options.variables.map((v) => v.name).join(", ")}`}
                    >
                      <Input id="b-formula" value={f.formula} onChange={(e) => set({ formula: e.target.value })} placeholder="insaat_alani * 0,42" />
                    </FormField>
                  )}
                  {f.quantitySource === "PARAMETRIC" && (
                    <FormField id="b-coef" label="Katsayı" required className="sm:col-span-2">
                      <NativeSelect
                        id="b-coef"
                        value={f.coefficientId ?? ""}
                        onChange={(e) => {
                          const c = options.coefficients.find((x) => x.id === e.target.value);
                          set({ coefficientId: e.target.value || null, unit: c?.unit ?? f.unit });
                        }}
                      >
                        <option value="">Seçin</option>
                        {options.coefficients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.costItemCode} {c.name}: {formatNumber(c.coefficient, 6)} {c.unit} / {COEFFICIENT_BASIS_LABELS[c.basis]}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                  )}
                  <FormField id="b-unit" label="Birim">
                    <Input id="b-unit" value={f.unit} onChange={(e) => set({ unit: e.target.value })} />
                  </FormField>
                </div>
              </fieldset>

              <fieldset className="grid gap-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">Birim fiyat (KDV hariç)</legend>
                <ChipGroup
                  label="Fiyat kaynağı"
                  value={f.priceSource}
                  onChange={(v) => set({ priceSource: v })}
                  options={[
                    { value: "MANUAL", label: "Elle / taşeron fiyatı" },
                    { value: "RESOURCE", label: "Kütüphane" },
                    { value: "RECIPE", label: "Reçete" },
                  ]}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  {f.priceSource === "MANUAL" && (
                    <>
                      <FormField id="b-price" label="Birim fiyat" required error={fieldErrors.unitPrice}>
                        <Input id="b-price" inputMode="decimal" value={f.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} />
                      </FormField>
                      <FormField id="b-cur" label="Para birimi" hint={f.currency !== "TRY" ? "Son kayıtlı kurla TL'ye çevrilir." : undefined}>
                        <NativeSelect id="b-cur" value={f.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {CURRENCY_LABELS[c]}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormField>
                    </>
                  )}
                  {f.priceSource === "RESOURCE" && (
                    <FormField id="b-res" label="Kaynak" required className="sm:col-span-2" hint="Öncelik: bağlantı → son alım → teklif → piyasa.">
                      <Combobox
                        id="b-res"
                        options={options.resources.map((r) => ({ value: r.id, label: `${r.name} (${r.unit})`, hint: r.code }))}
                        value={f.resourceId}
                        onChange={(v) => set({ resourceId: v, unit: f.unit || options.resources.find((r) => r.id === v)?.unit || "" })}
                        placeholder="Kaynak seçin"
                      />
                    </FormField>
                  )}
                  {f.priceSource === "RECIPE" && (
                    <FormField id="b-recipe" label="Reçete" required className="sm:col-span-2">
                      <Combobox
                        id="b-recipe"
                        options={options.recipes.map((r) => ({ value: r.id, label: `${r.code} ${r.name} (${r.unit})` }))}
                        value={f.recipeId}
                        onChange={(v) => set({ recipeId: v, unit: f.unit || options.recipes.find((r) => r.id === v)?.unit || "" })}
                        placeholder="Reçete seçin"
                      />
                    </FormField>
                  )}
                  <FormField id="b-waste" label="Fire (%)" error={fieldErrors.wastePercent} hint={f.priceSource === "RECIPE" ? "Reçetede fire zaten var." : undefined}>
                    <Input id="b-waste" inputMode="decimal" value={f.wastePercent} onChange={(e) => set({ wastePercent: e.target.value })} />
                  </FormField>
                  <FormField id="b-note" label="Fiyat notu" className="sm:col-span-3">
                    <Input id="b-note" value={f.priceNote} onChange={(e) => set({ priceNote: e.target.value })} placeholder="ör. Yıldız Yapı teklifi 10/2026" />
                  </FormField>
                </div>
              </fieldset>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                editing &&
                run(
                  () =>
                    saveBudgetLineAction(projectId, editing.id, {
                      ...editing.form,
                      costItemId: editing.form.costItemId ?? "",
                      blockId: editing.form.blockId || null,
                      supplyMethod: editing.form.supplyMethod || null,
                    }),
                  () => setEditing(null),
                )
              }
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
