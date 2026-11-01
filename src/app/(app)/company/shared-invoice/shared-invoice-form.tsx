"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2Icon, LoaderCircleIcon, SaveIcon } from "lucide-react";
import { quickCreateSupplierAction } from "@/app/(app)/projects/[projectId]/expenses/actions";
import { Combobox } from "@/components/combobox";
import { ChipGroup, type SupplierOption } from "@/components/expenses/expense-form";
import { FilePicker } from "@/components/expenses/file-picker";
import { emptyExpenseValues } from "@/components/expenses/form-values";
import { FormError, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentType, PaymentMethod } from "@/generated/prisma/enums";
import { codeDepth } from "@/lib/cost-tree/tree";
import { computeExpenseAmounts } from "@/lib/expenses/amounts";
import { DOCUMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { splitExpenseAmounts } from "@/lib/expenses/split";
import { Decimal, formatMoney, formatNumber, parseDecimalInput } from "@/lib/format";
import { createSharedInvoiceAction } from "./actions";

type Method = "equal" | "area" | "manual";
export type SplitProject = { id: string; name: string; area: string };

export function SharedInvoiceForm({
  projects,
  costItemCodes,
  suppliers: initialSuppliers,
  vatRates,
  today,
}: {
  projects: SplitProject[];
  costItemCodes: { code: string; name: string }[];
  suppliers: SupplierOption[];
  vatRates: { value: string; description: string | null }[];
  today: string;
}) {
  const empty = emptyExpenseValues(new Date(`${today}T00:00:00Z`), vatRates[0]?.value ?? "20");
  const [values, setValues] = useState(empty);
  const [costItemCode, setCostItemCode] = useState<string | null>("03.08");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<Method>("area");
  const [manual, setManual] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));

  const chosen = projects.filter((p) => selected.has(p.id));
  const weights = chosen.map((p) => {
    if (method === "equal") return new Decimal(1);
    if (method === "area") return new Decimal(p.area);
    const parsed = parseDecimalInput(manual[p.id] ?? "");
    return parsed.ok && parsed.value ? parsed.value : new Decimal(0);
  });
  const manualSum = method === "manual" ? weights.reduce((s, w) => s.plus(w), new Decimal(0)) : null;

  const preview = useMemo(() => {
    const amount = parseDecimalInput(values.amount);
    const vat = parseDecimalInput(values.vatRate);
    if (!amount.ok || !amount.value || !vat.ok || vat.value == null) return null;
    return computeExpenseAmounts({ mode: "total", amount: amount.value, includesVat: values.amountIncludesVat, vatRate: vat.value, exchangeRate: new Decimal(1) });
  }, [values.amount, values.vatRate, values.amountIncludesVat]);

  let parts: ReturnType<typeof splitExpenseAmounts> | null = null;
  try {
    parts = preview && chosen.length > 0 ? splitExpenseAmounts(preview, weights) : null;
  } catch {
    parts = null;
  }

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const data = new FormData();
      data.set(
        "payload",
        JSON.stringify({
          form: { ...values, costItemId: null },
          costItemCode,
          allocations: chosen.map((p, i) => ({ projectId: p.id, weight: weights[i].toString() })),
        }),
      );
      files.forEach((f) => data.append("files", f));
      const result = await createSharedInvoiceAction(data);
      if (result.ok) {
        setDone(true);
        setValues(empty);
        setFiles([]);
        return;
      }
      if ("duplicate" in result && result.duplicate) {
        setError(`Bu tedarikçide aynı belge no zaten kayıtlı (${result.duplicate.map((d) => d.project).join(", ")}).`);
        return;
      }
      setError("error" in result ? result.error : "Kaydedilemedi.");
      setErrors(("fieldErrors" in result && result.fieldErrors) || {});
    });
  }

  if (projects.length < 2) {
    return (
      <Alert>
        <AlertDescription>Ortak fatura için en az iki projede muhasebe veya yönetici yetkiniz olmalı.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid max-w-3xl gap-4">
      {done && (
        <Alert variant="info">
          <CheckCircle2Icon />
          <AlertDescription>Fatura projelere bölünerek kaydedildi. Her projenin Harcamalar ekranında görünür.</AlertDescription>
        </Alert>
      )}
      <FormError message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Fatura</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FilePicker files={files} onChange={setFiles} />
          <FormField id="supplier" label="Tedarikçi">
            <Combobox
              id="supplier"
              options={suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.taxNumber }))}
              value={values.supplierId}
              onChange={(supplierId) => set({ supplierId })}
              placeholder="Tedarikçi seçin"
              clearable
              onCreate={(name) =>
                startTransition(async () => {
                  const result = await quickCreateSupplierAction(name, null);
                  if (!result.ok) setError(result.error);
                  else {
                    setSuppliers((list) => [...list, result.supplier]);
                    set({ supplierId: result.supplier.id });
                  }
                })
              }
              createLabel={(name) => `Yeni tedarikçi ekle: “${name}”`}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="date" label="Tarih" required error={errors.date}>
              <Input id="date" type="date" value={values.date} onChange={(e) => set({ date: e.target.value })} />
            </FormField>
            <FormField id="documentType" label="Belge türü">
              <NativeSelect id="documentType" value={values.documentType} onChange={(e) => set({ documentType: e.target.value as DocumentType })}>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="documentNo" label="Belge no">
              <Input id="documentNo" value={values.documentNo} onChange={(e) => set({ documentNo: e.target.value })} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <FormField id="amount" label={values.amountIncludesVat ? "Tutar (KDV dahil, TL)" : "Tutar (KDV hariç, TL)"} required error={errors.amount}>
              <Input id="amount" inputMode="decimal" value={values.amount} onChange={(e) => set({ amount: e.target.value })} className="text-lg font-semibold" />
            </FormField>
            <FormField id="vat" label="KDV">
              <div className="flex flex-wrap gap-2">
                <ChipGroup
                  label="KDV dahil/hariç"
                  value={values.amountIncludesVat ? "incl" : "excl"}
                  onChange={(v) => set({ amountIncludesVat: v === "incl" })}
                  options={[
                    { value: "incl", label: "Dahil" },
                    { value: "excl", label: "Hariç" },
                  ]}
                />
                <ChipGroup label="KDV oranı" value={values.vatRate} onChange={(vatRate) => set({ vatRate })} options={vatRates.map((r) => ({ value: r.value, label: `%${r.value}` }))} />
              </div>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="payment" label="Ödeme">
              <ChipGroup
                label="Ödeme durumu"
                value={values.paymentStatus}
                onChange={(paymentStatus) => set({ paymentStatus })}
                options={[
                  { value: "UNPAID", label: "Ödenmedi" },
                  { value: "PAID", label: "Ödendi" },
                ]}
              />
            </FormField>
            <FormField id="paymentMethod" label="Ödeme şekli">
              <NativeSelect id="paymentMethod" value={values.paymentMethod ?? ""} onChange={(e) => set({ paymentMethod: (e.target.value || null) as PaymentMethod | null })}>
                <option value="">—</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="dueDate" label="Vade">
              <Input id="dueDate" type="date" value={values.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
            </FormField>
          </div>
          <FormField id="description" label="Açıklama">
            <Textarea id="description" value={values.description} onChange={(e) => set({ description: e.target.value })} placeholder="ör. Ekim ayı genel merkez kira ve muhasebe giderleri" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projelere dağıtım</CardTitle>
          <CardDescription>Her projede aynı kodlu maliyet kalemine yazılır.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField id="costItemCode" label="Maliyet kalemi">
            <Combobox
              id="costItemCode"
              options={costItemCodes.map((c) => ({ value: c.code, label: `${c.code} ${c.name}`, indent: codeDepth(c.code) }))}
              value={costItemCode}
              onChange={setCostItemCode}
              placeholder="Kalem seçin"
            />
          </FormField>
          <FormField id="method" label="Dağıtım anahtarı">
            <ChipGroup
              label="Dağıtım anahtarı"
              value={method}
              onChange={setMethod}
              options={[
                { value: "area", label: "İnşaat alanı oranı" },
                { value: "equal", label: "Eşit" },
                { value: "manual", label: "Elle (%)" },
              ]}
            />
          </FormField>
          <ul className="grid grid-cols-1 gap-2">
            {projects.map((project) => {
              const index = chosen.findIndex((p) => p.id === project.id);
              const part = index >= 0 && parts ? parts[index] : null;
              return (
                <li key={project.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.has(project.id)}
                      onCheckedChange={(on) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (on === true) next.add(project.id);
                          else next.delete(project.id);
                          return next;
                        })
                      }
                    />
                    <span className="font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground">{formatNumber(project.area)} m²</span>
                  </label>
                  {method === "manual" && selected.has(project.id) && (
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      aria-label={`${project.name} payı (%)`}
                      placeholder="%"
                      value={manual[project.id] ?? ""}
                      onChange={(e) => setManual({ ...manual, [project.id]: e.target.value })}
                    />
                  )}
                  {part && <span className="text-sm font-medium tabular-nums">{formatMoney(part.totalAmountTry)}</span>}
                </li>
              );
            })}
          </ul>
          {method === "area" && chosen.some((p) => new Decimal(p.area).isZero()) && (
            <p className="text-sm text-amber-700">İnşaat alanı girilmemiş projenin payı 0 olur; blok alanlarını girin veya başka anahtar seçin.</p>
          )}
          {manualSum && !manualSum.eq(100) && chosen.length > 0 && (
            <p className="text-sm text-amber-700">Yüzdelerin toplamı %{formatNumber(manualSum)}; oranlar toplama göre ölçeklenir.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={pending || chosen.length < 2 || !costItemCode}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
          Böl ve kaydet
        </Button>
      </div>
    </div>
  );
}
