"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import type { Currency, PriceSource, ResourceType } from "@/generated/prisma/enums";
import { PRICE_SOURCE_LABELS, RESOURCE_TYPE_LABELS } from "@/lib/budget/labels";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/expenses/labels";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addPriceAction, deletePriceAction, saveResourceAction } from "./actions";

export function LibraryTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/company/library", label: "Kaynaklar", active: path === "/company/library" || path.startsWith("/company/library/resources") },
    { href: "/company/library/recipes", label: "Reçeteler", active: path.startsWith("/company/library/recipes") },
    { href: "/company/library/match", label: "Faturalardan fiyat", active: path.startsWith("/company/library/match") },
  ];
  return (
    <nav className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={cn("rounded-md px-3 py-1.5", t.active ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export type ResourceFormValues = {
  code: string;
  name: string;
  type: ResourceType;
  category: string;
  unit: string;
  wastePercent: string;
  currency: Currency;
  spec: string;
  defaultSupplierId: string | null;
  active: boolean;
};

export const emptyResource: ResourceFormValues = {
  code: "",
  name: "",
  type: "MATERIAL",
  category: "",
  unit: "",
  wastePercent: "0",
  currency: "TRY",
  spec: "",
  defaultSupplierId: null,
  active: true,
};

/** Kaynak ekleme / düzenleme penceresi; `onSaved` yeni kaynağın kimliğini alır. */
export function ResourceDialog({
  open,
  onOpenChange,
  resourceId,
  initial,
  suppliers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string | null;
  initial: ResourceFormValues;
  suppliers: { id: string; name: string }[];
  onSaved?: (id: string) => void;
}) {
  const [values, setValues] = useState(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setValues(initial);
  }
  const { run, error, fieldErrors, pending } = useAction();
  const set = (patch: Partial<ResourceFormValues>) => setValues((v) => ({ ...v, ...patch }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{resourceId ? "Kaynağı düzenle" : "Yeni kaynak"}</DialogTitle>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="r-name" label="Ad" required error={fieldErrors.name} className="sm:col-span-2">
            <Input id="r-name" value={values.name} onChange={(e) => set({ name: e.target.value })} placeholder="ör. Seramik 60×60" />
          </FormField>
          <FormField id="r-type" label="Tür">
            <NativeSelect id="r-type" value={values.type} onChange={(e) => set({ type: e.target.value as ResourceType })}>
              {Object.entries(RESOURCE_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="r-code" label="Kod" hint="Boşsa M-0001 gibi verilir." error={fieldErrors.code}>
            <Input id="r-code" value={values.code} onChange={(e) => set({ code: e.target.value })} />
          </FormField>
          <FormField id="r-unit" label="Birim" required error={fieldErrors.unit}>
            <Input id="r-unit" value={values.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="m², kg, ton, adet, saat" />
          </FormField>
          <FormField id="r-waste" label="Fire (%)" error={fieldErrors.wastePercent}>
            <Input id="r-waste" inputMode="decimal" value={values.wastePercent} onChange={(e) => set({ wastePercent: e.target.value })} />
          </FormField>
          <FormField id="r-category" label="Kategori">
            <Input id="r-category" value={values.category} onChange={(e) => set({ category: e.target.value })} placeholder="ör. İnce işler" />
          </FormField>
          <FormField id="r-currency" label="Varsayılan para birimi">
            <NativeSelect id="r-currency" value={values.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="r-spec" label="Marka / özellik" className="sm:col-span-2">
            <Input id="r-spec" value={values.spec} onChange={(e) => set({ spec: e.target.value })} />
          </FormField>
          <FormField id="r-supplier" label="Varsayılan tedarikçi" className="sm:col-span-2">
            <Combobox
              id="r-supplier"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              value={values.defaultSupplierId}
              onChange={(v) => set({ defaultSupplierId: v })}
              placeholder="Seçin"
              clearable
            />
          </FormField>
          {resourceId && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.active} onCheckedChange={(on) => set({ active: on === true })} />
              Aktif
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => saveResourceAction(resourceId, values), (result) => {
                onOpenChange(false);
                onSaved?.(result.id);
              })
            }
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewResourceButton({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Yeni kaynak
      </Button>
      <ResourceDialog open={open} onOpenChange={setOpen} resourceId={null} initial={emptyResource} suppliers={suppliers} />
    </>
  );
}

export function EditResourceButton({ resourceId, initial, suppliers }: { resourceId: string; initial: ResourceFormValues; suppliers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PencilIcon />
        Düzenle
      </Button>
      <ResourceDialog open={open} onOpenChange={setOpen} resourceId={resourceId} initial={initial} suppliers={suppliers} />
    </>
  );
}

export function AddPriceButton({ resourceId, currency, today, suppliers }: { resourceId: string; currency: Currency; today: string; suppliers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ date: today, price: "", currency, source: "QUOTE" as PriceSource, supplierId: null as string | null, note: "" });
  const { run, error, fieldErrors, pending } = useAction();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon />
        Fiyat ekle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teklif / piyasa fiyatı</DialogTitle>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="p-source" label="Kaynak">
              <NativeSelect id="p-source" value={values.source} onChange={(e) => setValues({ ...values, source: e.target.value as PriceSource })}>
                <option value="QUOTE">{PRICE_SOURCE_LABELS.QUOTE}</option>
                <option value="MARKET">{PRICE_SOURCE_LABELS.MARKET}</option>
              </NativeSelect>
            </FormField>
            <FormField id="p-date" label="Tarih" error={fieldErrors.date}>
              <Input id="p-date" type="date" value={values.date} onChange={(e) => setValues({ ...values, date: e.target.value })} />
            </FormField>
            <FormField id="p-price" label="Birim fiyat (KDV hariç)" required error={fieldErrors.price}>
              <Input id="p-price" inputMode="decimal" value={values.price} onChange={(e) => setValues({ ...values, price: e.target.value })} />
            </FormField>
            <FormField id="p-currency" label="Para birimi">
              <NativeSelect id="p-currency" value={values.currency} onChange={(e) => setValues({ ...values, currency: e.target.value as Currency })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="p-supplier" label="Tedarikçi" className="sm:col-span-2">
              <Combobox id="p-supplier" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} value={values.supplierId} onChange={(v) => setValues({ ...values, supplierId: v })} placeholder="Seçin" clearable />
            </FormField>
            <FormField id="p-note" label="Not" className="sm:col-span-2">
              <Input id="p-note" value={values.note} onChange={(e) => setValues({ ...values, note: e.target.value })} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => run(() => addPriceAction(resourceId, values), () => setOpen(false))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeletePriceButton({ priceId }: { priceId: string }) {
  const { run, pending } = useAction();
  return (
    <Button size="icon" variant="ghost" aria-label="Fiyatı sil" disabled={pending} onClick={() => run(() => deletePriceAction(priceId))}>
      <Trash2Icon />
    </Button>
  );
}

export const priceText = (price: string, currency: Currency) => `${formatNumber(price, 4)} ${CURRENCY_LABELS[currency]}`;
