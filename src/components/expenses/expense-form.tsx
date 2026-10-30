"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  FileTextIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import {
  createExpenseAction,
  fetchTcmbAction,
  lastUsedAction,
  quickCreateSupplierAction,
  suggestRateAction,
  updateExpenseAction,
  type ExpenseSaveResult,
} from "@/app/(app)/projects/[projectId]/expenses/actions";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { FormError, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Currency, DocumentType, PaymentMethod } from "@/generated/prisma/enums";
import { codeDepth } from "@/lib/cost-tree/tree";
import { computeExpenseAmounts } from "@/lib/expenses/amounts";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  DOCUMENT_TYPE_LABELS,
  EXPENSE_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/expenses/labels";
import { Decimal, formatDateOnly, formatMoney, formatNumber, parseDecimalInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExpenseFormInput } from "@/lib/validation/expense";
import { FilePicker } from "./file-picker";

export type ExpenseFormValues = Required<Omit<ExpenseFormInput, "confirmDuplicate">> & {
  description: string;
  unit: string;
  documentNo: string;
};

export type CostItemOption = { id: string; code: string; name: string; unit: string | null; isGroup: boolean };
export type SupplierOption = { id: string; name: string; taxNumber: string | null };

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-9 rounded-full border px-3 text-sm transition-colors disabled:opacity-50",
            value === option.value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const DOCUMENT_CHIPS = (["INVOICE", "RECEIPT", "DELIVERY_NOTE", "VOUCHER", "PROGRESS_BILLING", "NONE"] as DocumentType[]).map(
  (value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }),
);

export function ExpenseForm({
  projectId,
  mode,
  expenseId,
  initial,
  costItems,
  blocks,
  suppliers: initialSuppliers,
  vatRates,
  existingDocuments = [],
  splitLocked = false,
  advancedOpen = false,
  canCreateSupplier,
}: {
  projectId: string;
  mode: "create" | "edit";
  expenseId?: string;
  initial: ExpenseFormValues;
  costItems: CostItemOption[];
  blocks: { id: string; name: string }[];
  suppliers: SupplierOption[];
  vatRates: { value: string; description: string | null }[];
  existingDocuments?: { id: string; fileName: string; mimeType: string }[];
  splitLocked?: boolean;
  advancedOpen?: boolean;
  canCreateSupplier: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ExpenseFormValues>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [duplicates, setDuplicates] = useState<Extract<ExpenseSaveResult, { duplicate: unknown }>["duplicate"] | null>(null);
  const [saved, setSaved] = useState<{ id: string; total: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [rateNote, setRateNote] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState<{ name: string; taxNumber: string; error?: string } | null>(null);
  const [vatTouched, setVatTouched] = useState(mode === "edit");
  const [pending, startTransition] = useTransition();
  const [another, setAnother] = useState(false);

  const set = (patch: Partial<ExpenseFormValues>) => setValues((current) => ({ ...current, ...patch }));
  const locked = splitLocked;

  const costItemOptions: ComboboxOption[] = useMemo(
    () =>
      costItems.map((item) => ({
        value: item.id,
        label: `${item.code} ${item.name}`,
        hint: item.unit ? `Birim: ${item.unit}` : null,
        emphasis: item.isGroup,
        indent: codeDepth(item.code),
      })),
    [costItems],
  );
  const supplierOptions: ComboboxOption[] = suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.taxNumber }));

  // Canlı hesap: matrah + KDV = toplam (ve dövizde TL karşılığı)
  const preview = useMemo(() => {
    const vat = parseDecimalInput(values.vatRate);
    if (!vat.ok || vat.value == null) return null;
    let exchangeRate = new Decimal(1);
    if (values.currency !== "TRY") {
      const fx = parseDecimalInput(values.exchangeRate);
      if (!fx.ok || fx.value == null || fx.value.lte(0)) return null;
      exchangeRate = fx.value;
    }
    if (values.amountMode === "unit") {
      const quantity = parseDecimalInput(values.quantity);
      const unitPrice = parseDecimalInput(values.unitPrice);
      if (!quantity.ok || !unitPrice.ok || quantity.value == null || unitPrice.value == null) return null;
      return computeExpenseAmounts({ mode: "unit", quantity: quantity.value, unitPrice: unitPrice.value, vatRate: vat.value, exchangeRate });
    }
    const amount = parseDecimalInput(values.amount);
    if (!amount.ok || amount.value == null) return null;
    return computeExpenseAmounts({
      mode: "total",
      amount: amount.value,
      includesVat: values.amountIncludesVat,
      vatRate: vat.value,
      exchangeRate,
    });
  }, [values]);

  async function loadRate(date: string, currency: Currency, force = false) {
    if (currency === "TRY") return;
    const rate = await suggestRateAction(date, currency);
    if (rate) {
      setValues((current) => (force || !current.exchangeRate ? { ...current, exchangeRate: rate.value.replace(".", ",") } : current));
      setRateNote(`${formatDateOnly(rate.date)} ${rate.source === "TCMB" ? "TCMB döviz alış" : "elle girilen"} kuru`);
    } else {
      setRateNote("Bu tarih için kayıtlı kur yok; TCMB'den getirin veya elle yazın.");
    }
  }

  async function chooseCostItem(costItemId: string | null) {
    set({ costItemId });
    setHint(null);
    if (!costItemId) return;
    const item = costItems.find((c) => c.id === costItemId);
    if (item?.unit && !values.unit && item.unit !== "götürü") set({ unit: item.unit });
    const last = await lastUsedAction(projectId, costItemId);
    if (!last) return;
    const parts: string[] = [];
    if (last.supplier) {
      parts.push(last.supplier.name);
      if (!values.supplierId && !locked) {
        if (!suppliers.some((s) => s.id === last.supplier!.id)) setSuppliers((list) => [...list, last.supplier!]);
        set({ supplierId: last.supplier.id });
      }
    }
    parts.push(`KDV %${last.vatRate}`);
    if (!vatTouched && !locked) set({ vatRate: last.vatRate });
    if (last.unitPrice) {
      parts.push(`birim fiyat ${formatNumber(last.unitPrice, 4)}${last.unit ? ` / ${last.unit}` : ""}`);
    }
    setHint(`Bu kalemde son kayıt: ${parts.join(" · ")}`);
  }

  function submit(confirmDuplicate = false) {
    setFormError(undefined);
    setSaved(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("payload", JSON.stringify({ ...values, confirmDuplicate }));
      for (const file of files) formData.append("files", file);
      if (mode === "edit") formData.set("removeDocuments", JSON.stringify(removed));
      const result =
        mode === "create"
          ? await createExpenseAction(projectId, formData)
          : await updateExpenseAction(projectId, expenseId!, formData);
      if ("duplicate" in result) {
        setDuplicates(result.duplicate);
        return;
      }
      setDuplicates(null);
      if (!result.ok) {
        setFormError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      setErrors({});
      if (mode === "create" && another) {
        setSaved({ id: result.id, total: preview ? formatMoney(preview.totalAmountTry) : "" });
        setFiles([]);
        setHint(null);
        // Aynı fişten bir sonraki kalem: tarih, tedarikçi, belge bilgisi kalır.
        set({ amount: "", quantity: "", unitPrice: "", description: "", costItemId: null });
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
      } else {
        router.push(`/projects/${projectId}/expenses/${result.id}`);
      }
    });
  }

  function createSupplier() {
    if (!newSupplier) return;
    startTransition(async () => {
      const result = await quickCreateSupplierAction(newSupplier.name, newSupplier.taxNumber || null);
      if (!result.ok) {
        setNewSupplier({ ...newSupplier, error: result.error });
        return;
      }
      setSuppliers((list) => [...list, result.supplier]);
      set({ supplierId: result.supplier.id });
      setNewSupplier(null);
    });
  }

  const isAdvance = values.kind === "ADVANCE";
  const paid = values.paymentStatus === "PAID";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid max-w-2xl gap-5 pb-24 md:pb-0"
    >
      {saved && (
        <Alert variant="info">
          <CheckCircle2Icon />
          <AlertDescription>
            <span>
              Kaydedildi {saved.total}.{" "}
              <Link href={`/projects/${projectId}/expenses/${saved.id}`} className="underline">
                Kaydı gör
              </Link>{" "}
              — sıradaki kalemi girebilirsiniz.
            </span>
          </AlertDescription>
        </Alert>
      )}
      <FormError message={formError} />
      {locked && (
        <Alert variant="info">
          <AlertDescription>
            Bu kayıt birden fazla projeye bölünmüş bir faturanın parçası. Burada yalnızca maliyet kalemi, blok ve
            açıklama değişir; tutar veya fatura bilgisini değiştirmek için faturayı silip yeniden girin.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-2">
        <h2 className="text-sm font-medium">Fiş / fatura</h2>
        {existingDocuments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {existingDocuments.map((doc) => {
              const isRemoved = removed.includes(doc.id);
              return (
                <li key={doc.id} className={cn("relative", isRemoved && "opacity-40")}>
                  <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" title={doc.fileName}>
                    {doc.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- yetki kontrollü belge adresi
                      <img src={`/api/documents/${doc.id}`} alt={doc.fileName} className="size-20 rounded-md border object-cover" />
                    ) : (
                      <span className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border bg-muted p-1 text-[10px]">
                        <FileTextIcon className="size-5" />
                        PDF
                      </span>
                    )}
                  </a>
                  {!locked && (
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 rounded-full border bg-background p-1 shadow"
                      onClick={() => setRemoved((list) => (isRemoved ? list.filter((x) => x !== doc.id) : [...list, doc.id]))}
                      aria-label={isRemoved ? "Belgeyi geri al" : "Belgeyi kaldır"}
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!locked && <FilePicker files={files} onChange={setFiles} />}
      </section>

      <FormField
        id="costItemId"
        label={isAdvance ? "Maliyet kalemi (isteğe bağlı)" : "Maliyet kalemi"}
        required={!isAdvance}
        error={errors.costItemId}
        hint={hint}
      >
        <Combobox
          id="costItemId"
          options={costItemOptions}
          value={values.costItemId}
          onChange={(value) => void chooseCostItem(value)}
          placeholder="Kalem seçin (ör. beton, demir, 05.04)"
          searchPlaceholder="Kod veya kalem adı yazın"
          emptyText="Kalem bulunamadı"
          clearable={isAdvance}
          invalid={Boolean(errors.costItemId)}
        />
      </FormField>

      <section className="grid gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ChipGroup
            label="Tutar girişi"
            value={values.amountMode}
            onChange={(amountMode) => set({ amountMode })}
            disabled={locked}
            options={[
              { value: "total", label: "Tutar" },
              { value: "unit", label: "Miktar × birim fiyat" },
            ]}
          />
          {values.amountMode === "total" && (
            <ChipGroup
              label="KDV"
              value={values.amountIncludesVat ? "incl" : "excl"}
              onChange={(value) => set({ amountIncludesVat: value === "incl" })}
              disabled={locked}
              options={[
                { value: "incl", label: "KDV dahil" },
                { value: "excl", label: "KDV hariç" },
              ]}
            />
          )}
        </div>

        {values.amountMode === "total" ? (
          <FormField id="amount" label={values.amountIncludesVat ? "Tutar (KDV dahil)" : "Tutar (KDV hariç)"} required error={errors.amount}>
            <div className="flex gap-2">
              <Input
                id="amount"
                value={values.amount}
                onChange={(e) => set({ amount: e.target.value })}
                inputMode="decimal"
                placeholder="0,00"
                className="h-12 text-2xl font-semibold tabular-nums md:h-11 md:text-xl"
                disabled={locked}
                aria-invalid={errors.amount ? true : undefined}
              />
              <span className="flex items-center text-lg text-muted-foreground">{CURRENCY_LABELS[values.currency]}</span>
            </div>
          </FormField>
        ) : (
          <div className="grid grid-cols-[1fr_6rem] gap-2 sm:grid-cols-[1fr_6rem_1.4fr]">
            <FormField id="quantity" label="Miktar" required error={errors.quantity}>
              <Input id="quantity" value={values.quantity} onChange={(e) => set({ quantity: e.target.value })} inputMode="decimal" disabled={locked} />
            </FormField>
            <FormField id="unit" label="Birim" error={errors.unit}>
              <Input id="unit" value={values.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="ton" disabled={locked} />
            </FormField>
            <FormField id="unitPrice" label={`Birim fiyat (KDV hariç, ${CURRENCY_LABELS[values.currency]})`} required error={errors.unitPrice} className="col-span-2 sm:col-span-1">
              <Input id="unitPrice" value={values.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} inputMode="decimal" disabled={locked} />
            </FormField>
          </div>
        )}

        <FormField id="vatRate" label="KDV oranı" error={errors.vatRate}>
          <div className="flex flex-wrap items-center gap-2">
            <ChipGroup
              label="KDV oranı"
              value={values.vatRate}
              disabled={locked}
              onChange={(vatRate) => {
                setVatTouched(true);
                set({ vatRate });
              }}
              options={vatRates.map((rate) => ({ value: rate.value, label: `%${rate.value}` }))}
            />
            <Input
              id="vatRate"
              value={values.vatRate}
              onChange={(e) => {
                setVatTouched(true);
                set({ vatRate: e.target.value });
              }}
              inputMode="decimal"
              className="w-20"
              aria-label="Diğer KDV oranı"
              disabled={locked}
            />
          </div>
        </FormField>

        {preview && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm tabular-nums">
            Matrah {formatMoney(preview.netAmount, values.currency)} + KDV {formatMoney(preview.vatAmount, values.currency)} ={" "}
            <strong>{formatMoney(preview.totalAmount, values.currency)}</strong>
            {values.currency !== "TRY" && <> · TL karşılığı {formatMoney(preview.totalAmountTry)}</>}
          </p>
        )}
      </section>

      <FormField id="supplierId" label="Tedarikçi / taşeron" error={errors.supplierId}>
        <Combobox
          id="supplierId"
          options={supplierOptions}
          value={values.supplierId}
          onChange={(supplierId) => set({ supplierId })}
          placeholder="Tedarikçi seçin (isteğe bağlı)"
          searchPlaceholder="Firma adı veya vergi no"
          emptyText="Bulunamadı"
          clearable
          disabled={locked}
          onCreate={canCreateSupplier ? (name) => setNewSupplier({ name, taxNumber: "" }) : undefined}
          createLabel={(name) => `Yeni tedarikçi ekle: “${name}”`}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="date" label="Tarih" required error={errors.date}>
          <Input
            id="date"
            type="date"
            value={values.date}
            disabled={locked}
            onChange={(e) => {
              set({ date: e.target.value });
              if (values.currency !== "TRY") void loadRate(e.target.value, values.currency, true);
            }}
          />
        </FormField>
        {values.documentType !== "NONE" && (
          <FormField id="documentNo" label="Belge no" error={errors.documentNo}>
            <Input id="documentNo" value={values.documentNo} onChange={(e) => set({ documentNo: e.target.value })} disabled={locked} />
          </FormField>
        )}
      </div>

      <FormField id="documentType" label="Belge türü">
        <ChipGroup label="Belge türü" value={values.documentType} onChange={(documentType) => set({ documentType })} options={DOCUMENT_CHIPS} disabled={locked} />
      </FormField>

      <section className="grid gap-3 rounded-lg border p-3">
        <ChipGroup
          label="Ödeme durumu"
          value={values.paymentStatus}
          disabled={locked}
          onChange={(paymentStatus) => set({ paymentStatus, paymentMethod: paymentStatus === "PAID" ? (values.paymentMethod ?? "CASH") : values.paymentMethod })}
          options={[
            { value: "UNPAID", label: "Ödenmedi (borç)" },
            { value: "PAID", label: "Ödendi" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="paymentMethod" label="Ödeme şekli">
            <NativeSelect
              id="paymentMethod"
              value={values.paymentMethod ?? ""}
              disabled={locked}
              onChange={(e) => set({ paymentMethod: (e.target.value || null) as PaymentMethod | null })}
            >
              <option value="">—</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {paid ? (
            <FormField id="paidAt" label="Ödeme tarihi" error={errors.paidAt} hint="Boşsa harcama tarihi">
              <Input id="paidAt" type="date" value={values.paidAt} onChange={(e) => set({ paidAt: e.target.value })} disabled={locked} />
            </FormField>
          ) : (
            <FormField id="dueDate" label="Vade" error={errors.dueDate}>
              <Input id="dueDate" type="date" value={values.dueDate} onChange={(e) => set({ dueDate: e.target.value })} disabled={locked} />
            </FormField>
          )}
        </div>
      </section>

      <FormField id="description" label="Açıklama" error={errors.description}>
        <Textarea
          id="description"
          value={values.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="ör. 3. kat döşeme dökümü, C30 – 42 m³"
          maxLength={500}
        />
      </FormField>

      <details className="group rounded-lg border" open={advancedOpen}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium">
          Ayrıntılar: blok, kayıt türü, döviz
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t p-3 sm:grid-cols-2">
          <FormField id="blockId" label="Blok" hint="Boşsa ortak (site geneli)">
            <NativeSelect id="blockId" value={values.blockId ?? ""} onChange={(e) => set({ blockId: e.target.value || null })}>
              <option value="">Ortak / site geneli</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="kind" label="Kayıt türü" hint={isAdvance ? "Avans maliyete yazılmaz; malzeme teslim edildikçe (Faz 2) maliyet oluşur." : undefined}>
            <NativeSelect
              id="kind"
              value={values.kind}
              disabled={locked || mode === "edit"}
              onChange={(e) => set({ kind: e.target.value as ExpenseFormValues["kind"] })}
            >
              {Object.entries(EXPENSE_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="currency" label="Para birimi">
            <NativeSelect
              id="currency"
              value={values.currency}
              disabled={locked}
              onChange={(e) => {
                const currency = e.target.value as Currency;
                set({ currency, exchangeRate: currency === "TRY" ? "" : values.exchangeRate });
                setRateNote(null);
                if (currency !== "TRY") void loadRate(values.date, currency, true);
              }}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {CURRENCY_LABELS[currency]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {values.currency !== "TRY" && (
            <FormField id="exchangeRate" label="İşlem kuru (TL)" required error={errors.exchangeRate} hint={rateNote}>
              <div className="flex gap-2">
                <Input
                  id="exchangeRate"
                  value={values.exchangeRate}
                  onChange={(e) => set({ exchangeRate: e.target.value })}
                  inputMode="decimal"
                  disabled={locked}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="TCMB'den getir"
                  disabled={locked || pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await fetchTcmbAction(values.date);
                      if (!result.ok) setRateNote(result.error);
                      else await loadRate(values.date, values.currency, true);
                    })
                  }
                >
                  <RefreshCwIcon />
                </Button>
              </div>
            </FormField>
          )}
          {values.amountMode === "total" && (
            <div className="grid grid-cols-[1fr_6rem] gap-2 sm:col-span-2">
              <FormField id="quantityInfo" label="Miktar (bilgi)" error={errors.quantity}>
                <Input id="quantityInfo" value={values.quantity} onChange={(e) => set({ quantity: e.target.value })} inputMode="decimal" disabled={locked} />
              </FormField>
              <FormField id="unitInfo" label="Birim">
                <Input id="unitInfo" value={values.unit} onChange={(e) => set({ unit: e.target.value })} disabled={locked} />
              </FormField>
            </div>
          )}
        </div>
      </details>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-background p-3 md:static md:justify-end md:border-0 md:bg-transparent md:p-0">
        {mode === "create" && (
          <Button type="submit" variant="outline" size="lg" className="flex-1 md:flex-none" disabled={pending} onClick={() => setAnother(true)}>
            Kaydet ve yeni
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1 md:flex-none" disabled={pending} onClick={() => setAnother(false)}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
          Kaydet
        </Button>
      </div>

      <Dialog open={duplicates !== null} onOpenChange={(open) => !open && setDuplicates(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bu belge daha önce girilmiş olabilir</DialogTitle>
            <DialogDescription>Aynı tedarikçi ve aynı belge numarasıyla kayıt var:</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1 text-sm">
            {duplicates?.map((d) => (
              <li key={d.id}>
                {formatDateOnly(d.date)} · {d.project} · {formatMoney(d.total)}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicates(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => submit(true)} disabled={pending}>
              Yine de kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newSupplier !== null} onOpenChange={(open) => !open && setNewSupplier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni tedarikçi</DialogTitle>
            <DialogDescription>Ayrıntıları sonra Tedarikçiler ekranından tamamlayabilirsiniz.</DialogDescription>
          </DialogHeader>
          <FormError message={newSupplier?.error} />
          <FormField id="newSupplierName" label="Firma / kişi adı" required>
            <Input
              id="newSupplierName"
              value={newSupplier?.name ?? ""}
              onChange={(e) => setNewSupplier((s) => s && { ...s, name: e.target.value })}
            />
          </FormField>
          <FormField id="newSupplierTax" label="Vergi no / TC kimlik no">
            <Input
              id="newSupplierTax"
              value={newSupplier?.taxNumber ?? ""}
              onChange={(e) => setNewSupplier((s) => s && { ...s, taxNumber: e.target.value })}
              inputMode="numeric"
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSupplier(null)}>
              Vazgeç
            </Button>
            <Button onClick={createSupplier} disabled={pending}>
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
