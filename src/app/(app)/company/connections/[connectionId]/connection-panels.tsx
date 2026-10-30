"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckIcon, LinkIcon, PencilIcon, PlusIcon, SplitIcon, Trash2Icon, UnlinkIcon, WalletIcon } from "lucide-react";
import { FilePicker } from "@/components/expenses/file-picker";
import { FormError, FormField } from "@/components/form-field";
import { PaymentBadge } from "@/components/expenses/badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ConnectionStatus, Currency, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import type { ActionFailure } from "@/lib/action-result";
import { CONNECTION_STATUS_LABELS } from "@/lib/connections/labels";
import { roundMoney } from "@/lib/expenses/amounts";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { toFormData } from "@/lib/form-data";
import { Decimal, formatDateOnly, formatMoney, formatNumber, parseDecimalInput } from "@/lib/format";
import {
  createInvoiceAction,
  deleteConnectionAction,
  deleteInvoiceAction,
  deletePaymentAction,
  linkAdvanceAction,
  saveAllocationsAction,
  savePaymentAction,
  setConnectionStatusAction,
  setPaymentPaidAction,
} from "../actions";

const num = (text: string) => {
  const parsed = parseDecimalInput(text);
  return parsed.ok && parsed.value ? parsed.value : new Decimal(0);
};

/** Ortak: işlem çalıştır, hata göster, sayfayı yenile. */
function useRun() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  function run<T extends { ok: true } | ActionFailure>(action: () => Promise<T>, onDone?: (result: T & { ok: true }) => void) {
    startTransition(async () => {
      setError(undefined);
      setFieldErrors({});
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      onDone?.(result as T & { ok: true });
      router.refresh();
    });
  }
  return { run, error, fieldErrors, pending, setError };
}

// ---------------------------------------------------------------------------
// Durum ve silme
// ---------------------------------------------------------------------------

export function ConnectionActions({ connectionId, status }: { connectionId: string; status: ConnectionStatus }) {
  const router = useRouter();
  const { run, error, pending } = useRun();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Durum"
          className="w-40"
          value={status}
          disabled={pending}
          onChange={(e) => run(() => setConnectionStatusAction(connectionId, e.target.value))}
        >
          {Object.entries(CONNECTION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)} disabled={pending}>
          <Trash2Icon />
          Sil
        </Button>
      </div>
      <FormError message={error} />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bağlantıyı sil</DialogTitle>
            <DialogDescription>Yalnızca çekişi, ödenmiş ödemesi, faturası ve bağlı avansı olmayan bağlantı silinir. Diğerlerinde durumu “İptal” yapın.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Vazgeç
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => run(() => deleteConnectionAction(connectionId), () => router.push("/company/connections"))}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proje tahsisi
// ---------------------------------------------------------------------------

export function AllocationButton({
  item,
  projects,
}: {
  item: { id: string; description: string; unit: string; total: string; allocations: { projectId: string; quantity: string; drawn: string }[] };
  projects: { id: string; name: string }[];
}) {
  const initial = Object.fromEntries(item.allocations.map((a) => [a.projectId, formatNumber(a.quantity, 4)]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const { run, error, pending } = useRun();
  const drawn = new Map(item.allocations.map((a) => [a.projectId, a.drawn]));
  const sum = Object.values(values).reduce((s, v) => s.plus(num(v)), new Decimal(0));
  const pool = new Decimal(item.total).minus(sum);
  const known = new Set(projects.map((p) => p.id));
  const hidden = item.allocations.filter((a) => !known.has(a.projectId));

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setValues(initial); setOpen(true); }}>
        <SplitIcon />
        Tahsis
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proje tahsisi</DialogTitle>
            <DialogDescription>
              {item.description}: toplam {formatNumber(item.total, 4)} {item.unit}. Tahsis edilmeyen miktar “atanmamış – şirket geneli” havuzda kalır. Bir projenin payını azaltıp diğerine ekleyerek aktarım yapılır.
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <ul className="grid gap-2">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <label htmlFor={`alloc-${p.id}`} className="min-w-0 flex-1 truncate text-sm">
                  {p.name}
                  {drawn.get(p.id) && new Decimal(drawn.get(p.id)!).gt(0) && (
                    <span className="block text-xs text-muted-foreground">çekilen {formatNumber(drawn.get(p.id)!, 4)} {item.unit}</span>
                  )}
                </label>
                <Input
                  id={`alloc-${p.id}`}
                  className="w-32"
                  inputMode="decimal"
                  placeholder="0"
                  value={values[p.id] ?? ""}
                  onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
                />
                <span className="w-10 text-xs text-muted-foreground">{item.unit}</span>
              </li>
            ))}
            {hidden.length > 0 && <li className="text-xs text-muted-foreground">Erişiminiz olmayan projelerin tahsisleri korunur.</li>}
          </ul>
          <p className={pool.isNegative() ? "text-sm text-destructive" : "text-sm"}>
            Havuzda kalan: <strong className="tabular-nums">{formatNumber(pool, 4)} {item.unit}</strong>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveAllocationsAction({
                      itemId: item.id,
                      allocations: [
                        ...Object.entries(values).filter(([, v]) => v.trim()).map(([projectId, quantity]) => ({ projectId, quantity })),
                        ...hidden.map((a) => ({ projectId: a.projectId, quantity: formatNumber(a.quantity, 4) })),
                      ],
                    }),
                  () => setOpen(false),
                )
              }
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Ödeme planı
// ---------------------------------------------------------------------------

export type PaymentView = {
  id: string;
  dueDate: string;
  amount: string;
  amountTry: string;
  description: string | null;
  paymentMethod: PaymentMethod | null;
  instrumentNo: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  overdue: boolean;
};

type PaymentFormState = { id: string | null; dueDate: string; amount: string; description: string; paymentMethod: string; instrumentNo: string };

export function PaymentsPanel({
  connectionId,
  currency,
  payments,
  canManage,
  today,
}: {
  connectionId: string;
  currency: Currency;
  payments: PaymentView[];
  canManage: boolean;
  today: string;
}) {
  const [form, setForm] = useState<PaymentFormState | null>(null);
  const [paying, setPaying] = useState<PaymentView | null>(null);
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [rate, setRate] = useState("");
  const { run, error, fieldErrors, pending } = useRun();
  const fx = currency !== "TRY";

  return (
    <div className="grid gap-3">
      <FormError message={!form && !paying ? error : undefined} />
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ödeme planı girilmemiş.</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
              <span className="min-w-0">
                <span className="font-medium">{formatDateOnly(p.dueDate)}</span>
                {p.description && <span className="text-muted-foreground"> · {p.description}</span>}
                <span className="block text-xs text-muted-foreground">
                  {p.paymentMethod ? PAYMENT_METHOD_LABELS[p.paymentMethod] : "Ödeme şekli belirtilmemiş"}
                  {p.instrumentNo && ` · ${p.instrumentNo}`}
                  {p.paidAt && ` · ödendi ${formatDateOnly(p.paidAt)}`}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <PaymentBadge status={p.paymentStatus} overdue={p.overdue} />
                <span className="text-right tabular-nums">
                  {formatMoney(p.amount, currency)}
                  {fx && <span className="block text-xs text-muted-foreground">{formatMoney(p.amountTry)}{p.paymentStatus === "UNPAID" && " (tahmini)"}</span>}
                </span>
                {canManage &&
                  (p.paymentStatus === "UNPAID" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setPaying(p); setRate(""); }}>
                        <WalletIcon />
                        Ödendi
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Düzenle"
                        onClick={() =>
                          setForm({
                            id: p.id,
                            dueDate: p.dueDate.slice(0, 10),
                            amount: formatNumber(p.amount, 2),
                            description: p.description ?? "",
                            paymentMethod: p.paymentMethod ?? "",
                            instrumentNo: p.instrumentNo ?? "",
                          })
                        }
                      >
                        <PencilIcon />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Sil" disabled={pending} onClick={() => run(() => deletePaymentAction(p.id))}>
                        <Trash2Icon />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setPaymentPaidAction([p.id], null))}>
                      Ödenmedi yap
                    </Button>
                  ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => setForm({ id: null, dueDate: today, amount: "", description: "", paymentMethod: "", instrumentNo: "" })}
        >
          <PlusIcon />
          Ödeme ekle
        </Button>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Ödemeyi düzenle" : "Ödeme ekle"}</DialogTitle>
            <DialogDescription>Tutar KDV dahil, bağlantının para biriminde.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="p-due" label="Vade" required error={fieldErrors.dueDate}>
                <Input id="p-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </FormField>
              <FormField id="p-amount" label="Tutar" required error={fieldErrors.amount}>
                <Input id="p-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </FormField>
              <FormField id="p-desc" label="Açıklama" className="sm:col-span-2">
                <Input id="p-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </FormField>
              <FormField id="p-method" label="Ödeme şekli">
                <NativeSelect id="p-method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="">—</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="p-no" label="Çek / senet no">
                <Input id="p-no" value={form.instrumentNo} onChange={(e) => setForm({ ...form, instrumentNo: e.target.value })} />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                form &&
                run(
                  () => savePaymentAction(connectionId, form.id, { ...form, paymentMethod: form.paymentMethod || null }),
                  () => setForm(null),
                )
              }
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paying !== null} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödendi olarak işaretle</DialogTitle>
            <DialogDescription>{paying && `${formatDateOnly(paying.dueDate)} · ${formatMoney(paying.amount, currency)}`}</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="paidAt" label="Ödeme tarihi">
              <Input id="paidAt" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </FormField>
            <FormField id="method" label="Ödeme şekli">
              <NativeSelect id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {fx && (
              <FormField id="rate" label="Ödeme kuru" hint="Boşsa ödeme günündeki TCMB döviz alış kuru." className="sm:col-span-2">
                <Input id="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                paying && run(() => setPaymentPaidAction([paying.id], { paidAt, paymentMethod: method, exchangeRate: rate }), () => setPaying(null))
              }
            >
              <CheckIcon />
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Faturalar
// ---------------------------------------------------------------------------

export type InvoiceView = {
  id: string;
  date: string;
  documentNo: string;
  totalAmount: string;
  totalAmountTry: string;
  warnings: string[];
  lines: { description: string; quantity: string; unit: string; unitPrice: string }[];
  documents: { id: string; fileName: string }[];
};

type ItemOption = { id: string; description: string; unit: string; unitPrice: string; vatRate: string };

export function InvoicesPanel({
  connectionId,
  currency,
  invoices,
  items,
  canManage,
  today,
}: {
  connectionId: string;
  currency: Currency;
  invoices: InvoiceView[];
  items: ItemOption[];
  canManage: boolean;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [documentNo, setDocumentNo] = useState("");
  const [rate, setRate] = useState("");
  const [lines, setLines] = useState<{ itemId: string; quantity: string; unitPrice: string; vatRate: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saved, setSaved] = useState<string[] | null>(null);
  const { run, error, fieldErrors, pending } = useRun();
  const fx = currency !== "TRY";
  const lineFor = (item: ItemOption) => ({ itemId: item.id, quantity: "", unitPrice: formatNumber(item.unitPrice, 4), vatRate: item.vatRate });
  const total = lines.reduce((s, l) => {
    const net = roundMoney(num(l.quantity).times(num(l.unitPrice)));
    return s.plus(net).plus(roundMoney(net.times(num(l.vatRate)).div(100)));
  }, new Decimal(0));

  return (
    <div className="grid gap-3">
      {saved && (
        <div className={saved.length ? "rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" : "text-sm text-emerald-700"}>
          {saved.length ? (
            <>
              <p className="font-medium">Fatura kaydedildi; bağlantıyla farklar:</p>
              <ul className="list-disc pl-5">
                {saved.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </>
          ) : (
            "Fatura kaydedildi; bağlantı fiyat ve miktarıyla uyumlu."
          )}
        </div>
      )}
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bağlantıya fatura eklenmemiş.</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {invoices.map((inv) => (
            <li key={inv.id} className="grid gap-1 rounded-lg border p-2.5">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {formatDateOnly(inv.date)} · {inv.documentNo}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-right tabular-nums">
                    {formatMoney(inv.totalAmount, currency)}
                    {fx && <span className="block text-xs text-muted-foreground">{formatMoney(inv.totalAmountTry)}</span>}
                  </span>
                  {canManage && (
                    <Button size="icon" variant="ghost" aria-label="Faturayı sil" disabled={pending} onClick={() => run(() => deleteInvoiceAction(inv.id))}>
                      <Trash2Icon />
                    </Button>
                  )}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {inv.lines.map((l) => `${l.description} ${formatNumber(l.quantity, 4)} ${l.unit} × ${formatNumber(l.unitPrice, 4)}`).join(" · ")}
              </span>
              {inv.documents.map((d) => (
                <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="text-xs hover:underline">
                  {d.fileName}
                </a>
              ))}
              {inv.warnings.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-amber-800">
                  {inv.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => {
            setLines(items.length === 1 ? [lineFor(items[0])] : []);
            setDocumentNo("");
            setFiles([]);
            setSaved(null);
            setOpen(true);
          }}
        >
          <PlusIcon />
          Fatura ekle
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bağlantıya fatura ekle</DialogTitle>
            <DialogDescription>
              Maliyet çekişte oluştuğu için fatura maliyete tekrar yazılmaz; miktar ve fiyat bağlantıyla karşılaştırılır ve muhasebeci paketine girer.
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField id="inv-date" label="Fatura tarihi" required error={fieldErrors.date}>
              <Input id="inv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField id="inv-no" label="Fatura no" required error={fieldErrors.documentNo}>
              <Input id="inv-no" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
            </FormField>
            {fx && (
              <FormField id="inv-rate" label="Kur" hint="Boşsa fatura günündeki TCMB kuru.">
                <Input id="inv-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              </FormField>
            )}
          </div>
          <div className="grid gap-2">
            {lines.map((line, index) => {
              const item = items.find((i) => i.id === line.itemId)!;
              const update = (patch: Partial<typeof line>) => setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
              return (
                <div key={index} className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-[1fr_7rem_8rem_auto]">
                  <span className="self-center text-sm">{item.description}</span>
                  <Input aria-label="Miktar" inputMode="decimal" placeholder={`Miktar (${item.unit})`} value={line.quantity} onChange={(e) => update({ quantity: e.target.value })} />
                  <Input aria-label="Birim fiyat" inputMode="decimal" value={line.unitPrice} onChange={(e) => update({ unitPrice: e.target.value })} />
                  <Button type="button" size="icon" variant="ghost" aria-label="Satırı sil" onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                    <Trash2Icon />
                  </Button>
                </div>
              );
            })}
            {fieldErrors.lines && <p className="text-xs text-destructive">{fieldErrors.lines}</p>}
            <div className="flex flex-wrap gap-2">
              {items
                .filter((item) => !lines.some((l) => l.itemId === item.id))
                .map((item) => (
                  <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => setLines([...lines, lineFor(item)])}>
                    <PlusIcon />
                    {item.description}
                  </Button>
                ))}
            </div>
            <p className="text-sm">
              Toplam (KDV dahil): <strong className="tabular-nums">{formatMoney(total, currency)}</strong>
            </p>
          </div>
          <FilePicker files={files} onChange={setFiles} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending || lines.length === 0}
              onClick={() =>
                run(
                  () => createInvoiceAction(connectionId, toFormData({ date, documentNo, exchangeRate: rate, lines }, files)),
                  (result) => {
                    setSaved(result.warnings);
                    setOpen(false);
                  },
                )
              }
            >
              Kaydet ve karşılaştır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avans bağlama
// ---------------------------------------------------------------------------

export type AdvanceView = {
  id: string;
  date: string;
  project: string;
  amount: string;
  documentNo: string | null;
  paymentStatus: PaymentStatus;
  href: string | null;
};

export function AdvancesPanel({
  connectionId,
  currency,
  linked,
  linkable,
  canManage,
}: {
  connectionId: string;
  currency: Currency;
  linked: AdvanceView[];
  linkable: AdvanceView[];
  canManage: boolean;
}) {
  const { run, error, pending } = useRun();
  const row = (a: AdvanceView, action: React.ReactNode) => (
    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
      <span className="min-w-0">
        {a.href ? (
          <a href={a.href} className="font-medium hover:underline">
            {formatDateOnly(a.date)} · {a.project}
          </a>
        ) : (
          <span className="font-medium">
            {formatDateOnly(a.date)} · {a.project}
          </span>
        )}
        {a.documentNo && <span className="text-muted-foreground"> · {a.documentNo}</span>}
      </span>
      <span className="flex items-center gap-2">
        <PaymentBadge status={a.paymentStatus} />
        <span className="tabular-nums">{formatMoney(a.amount, currency)}</span>
        {action}
      </span>
    </li>
  );
  return (
    <div className="grid gap-3">
      <FormError message={error} />
      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bağlı avans yok. Harcamalar ekranında “Avans” olarak girilen ödemeler buraya bağlanabilir.</p>
      ) : (
        <ul className="grid gap-2">
          {linked.map((a) =>
            row(
              a,
              canManage && (
                <Button size="icon" variant="ghost" aria-label="Bağlantıyı kaldır" disabled={pending} onClick={() => run(() => linkAdvanceAction(a.id, null))}>
                  <UnlinkIcon />
                </Button>
              ),
            ),
          )}
        </ul>
      )}
      {canManage && linkable.length > 0 && (
        <>
          <p className="text-sm font-medium">Bağlanabilecek avanslar (aynı tedarikçi ve para birimi)</p>
          <ul className="grid gap-2">
            {linkable.map((a) =>
              row(
                a,
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => linkAdvanceAction(a.id, connectionId))}>
                  <LinkIcon />
                  Bağla
                </Button>,
              ),
            )}
          </ul>
        </>
      )}
    </div>
  );
}
