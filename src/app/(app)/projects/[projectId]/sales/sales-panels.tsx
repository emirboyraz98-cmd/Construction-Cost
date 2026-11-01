"use client";

import Link from "next/link";
import { useState } from "react";
import { BookmarkIcon, HandshakeIcon, KeyRoundIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { FormError, FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { dateToDateInput, formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { SALE_STATUS_LABELS, SALE_STATUS_STYLES } from "@/lib/sales/labels";
import type { UnitSaleStatus } from "@/lib/sales/sales";
import { cn } from "@/lib/utils";
import { cancelReservationAction, createReservationAction, deleteCustomerAction, saveCustomerAction, setHandoverAction } from "./actions";

export function SaleStatusBadge({ status }: { status: UnitSaleStatus }) {
  return (
    <Badge variant="outline" className={SALE_STATUS_STYLES[status]}>
      {SALE_STATUS_LABELS[status]}
    </Badge>
  );
}

export type CustomerView = {
  id: string;
  name: string;
  identityNo: string | null;
  taxOffice: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

const emptyCustomer = (name = ""): Omit<CustomerView, "id"> => ({ name, identityNo: "", taxOffice: "", phone: "", email: "", address: "", notes: "" });

export function CustomerDialog({
  projectId,
  customer,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  customer: CustomerView | Omit<CustomerView, "id"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string, name: string) => void;
}) {
  const [form, setForm] = useState(customer ?? emptyCustomer());
  const { run, error, fieldErrors, pending } = useAction();
  const existingId = customer && "id" in customer ? customer.id : null;
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingId ? "Müşteriyi düzenle" : "Yeni müşteri"}</DialogTitle>
          <DialogDescription>Kimlik ve iletişim bilgileri yalnızca satış yetkisi olanlara görünür (KVKK).</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="cu-name" label="Ad soyad / unvan" required error={fieldErrors.name} className="sm:col-span-2">
            <Input id="cu-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </FormField>
          <FormField id="cu-id" label="T.C. kimlik / vergi no" error={fieldErrors.identityNo}>
            <Input id="cu-id" inputMode="numeric" value={form.identityNo ?? ""} onChange={(e) => set("identityNo", e.target.value)} />
          </FormField>
          <FormField id="cu-tax" label="Vergi dairesi">
            <Input id="cu-tax" value={form.taxOffice ?? ""} onChange={(e) => set("taxOffice", e.target.value)} />
          </FormField>
          <FormField id="cu-phone" label="Telefon">
            <Input id="cu-phone" type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </FormField>
          <FormField id="cu-email" label="E-posta">
            <Input id="cu-email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </FormField>
          <FormField id="cu-address" label="Adres" className="sm:col-span-2">
            <Textarea id="cu-address" rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </FormField>
          <FormField id="cu-notes" label="Not" className="sm:col-span-2">
            <Input id="cu-notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => saveCustomerAction(projectId, existingId, form),
                (r) => {
                  onSaved?.(r.id, form.name);
                  onOpenChange(false);
                },
              )
            }
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Müşteri seçimi + listede yoksa yeni müşteri. */
export function CustomerPicker({ projectId, customers, value, onChange, invalid }: { projectId: string; customers: { id: string; name: string; phone: string | null }[]; value: string | null; onChange: (id: string | null) => void; invalid?: boolean }) {
  const [creating, setCreating] = useState<string | null>(null);
  const [extra, setExtra] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const options = [...customers, ...extra.filter((e) => !customers.some((c) => c.id === e.id))].map((c) => ({ value: c.id, label: c.name, hint: c.phone }));
  return (
    <>
      <Combobox
        id="customer"
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Müşteri seçin…"
        searchPlaceholder="Ad veya telefon…"
        createLabel={(q) => `+ Yeni müşteri: ${q}`}
        onCreate={(q) => setCreating(q)}
        invalid={invalid}
      />
      {creating !== null && (
        <CustomerDialog
          projectId={projectId}
          customer={emptyCustomer(creating)}
          open
          onOpenChange={(o) => !o && setCreating(null)}
          onSaved={(id, name) => {
            setExtra((e) => [...e, { id, name, phone: null }]);
            onChange(id);
          }}
        />
      )}
    </>
  );
}

export function CustomerTable({ projectId, customers, canManage }: { projectId: string; customers: (CustomerView & { units: string[]; contractCount: number; reservationCount: number })[]; canManage: boolean }) {
  const [editing, setEditing] = useState<CustomerView | null | "new">(null);
  const { run, error } = useAction();
  return (
    <div className="grid grid-cols-1 gap-3">
      {canManage && (
        <div>
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            Yeni müşteri
          </Button>
        </div>
      )}
      <FormError message={error} />
      {customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz müşteri yok.</p>
      ) : (
        <Card className="gap-0 overflow-x-auto py-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Müşteri</th>
                <th className="px-2 py-2 font-medium">İletişim</th>
                <th className="px-2 py-2 font-medium">Kimlik / vergi no</th>
                <th className="px-2 py-2 font-medium">Bölüm</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-4 py-2 font-medium">
                    {c.name}
                    {c.notes && <span className="block text-xs font-normal text-muted-foreground">{c.notes}</span>}
                  </td>
                  <td className="px-2 py-2">
                    {c.phone && <a href={`tel:${c.phone}`} className="block hover:underline">{c.phone}</a>}
                    {c.email && <span className="block text-xs text-muted-foreground">{c.email}</span>}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{c.identityNo ?? "—"}</td>
                  <td className="px-2 py-2">{c.units.length ? c.units.join(", ") : c.reservationCount ? "Rezervasyon" : "—"}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" aria-label={`${c.name} düzenle`} onClick={() => setEditing(c)}>
                        <PencilIcon />
                      </Button>
                      {c.contractCount === 0 && c.reservationCount === 0 && (
                        <Button size="icon" variant="ghost" className="text-destructive" aria-label={`${c.name} sil`} onClick={() => confirm(`${c.name} silinsin mi?`) && run(() => deleteCustomerAction(projectId, c.id))}>
                          <Trash2Icon />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {editing !== null && <CustomerDialog projectId={projectId} customer={editing === "new" ? null : editing} open onOpenChange={(o) => !o && setEditing(null)} />}
    </div>
  );
}

export type SalesRowView = {
  id: string;
  label: string;
  detail: string;
  grossArea: string;
  status: UnitSaleStatus;
  listPrice: string | null;
  listVatRate: string | null;
  landowner: string | null;
  handoverDate: string | null;
  contract: { id: string; customer: string; salePrice: string; currency: string; total: string; collected: string; remaining: string; overdue: string; date: string } | null;
  reservation: { id: string; customer: string; expiresAt: string } | null;
};

const FILTERS: { key: UnitSaleStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tümü" },
  { key: "AVAILABLE", label: "Boş" },
  { key: "RESERVED", label: "Rezerve" },
  { key: "SOLD", label: "Satıldı" },
  { key: "LANDOWNER", label: "Arsa sahibi" },
];

export function SalesTable({ projectId, rows, customers, canManage, today }: { projectId: string; rows: SalesRowView[]; customers: { id: string; name: string; phone: string | null }[]; canManage: boolean; today: string }) {
  const [filter, setFilter] = useState<UnitSaleStatus | "ALL">("ALL");
  const [reserveFor, setReserveFor] = useState<SalesRowView | null>(null);
  const [handoverFor, setHandoverFor] = useState<SalesRowView | null>(null);
  const visible = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
            {f.label} <span className="tabular-nums opacity-70">{f.key === "ALL" ? rows.length : rows.filter((r) => r.status === f.key).length}</span>
          </Button>
        ))}
      </div>
      <Card className="gap-0 overflow-x-auto py-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Bölüm</th>
              <th className="px-2 py-2 font-medium">Durum</th>
              <th className="px-2 py-2 text-right font-medium">Liste fiyatı</th>
              <th className="px-2 py-2 font-medium">Müşteri</th>
              <th className="px-2 py-2 text-right font-medium">Satış (KDV hariç)</th>
              <th className="px-2 py-2 text-right font-medium">Tahsil / kalan</th>
              <th className="px-4 py-2 text-right font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-4 py-2">
                  <span className="font-medium">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.detail} · {formatNumber(r.grossArea, 2)} m²
                  </span>
                </td>
                <td className="px-2 py-2">
                  <SaleStatusBadge status={r.status} />
                  {r.handoverDate && <span className="block text-[11px] text-muted-foreground">Teslim {formatDateOnly(r.handoverDate)}</span>}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.status === "LANDOWNER" ? "—" : r.listPrice ? formatMoney(r.listPrice) : <span className="text-xs text-muted-foreground">Liste yok</span>}</td>
                <td className="px-2 py-2">
                  {r.contract ? (
                    <Link href={`/projects/${projectId}/sales/${r.contract.id}`} className="hover:underline">
                      {r.contract.customer}
                    </Link>
                  ) : r.reservation ? (
                    <>
                      {r.reservation.customer}
                      <span className="block text-[11px] text-amber-800">Rezervasyon {formatDateOnly(r.reservation.expiresAt)} tarihine kadar</span>
                    </>
                  ) : r.landowner ? (
                    <span className="text-muted-foreground">{r.landowner}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.contract ? formatMoney(r.contract.salePrice, r.contract.currency) : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {r.contract ? (
                    <>
                      {formatMoney(r.contract.collected, r.contract.currency)}
                      <span className={cn("block text-xs", Number(r.contract.overdue) > 0 ? "text-destructive" : "text-muted-foreground")}>
                        {Number(r.contract.overdue) > 0 ? `${formatMoney(r.contract.overdue, r.contract.currency)} gecikmiş` : `kalan ${formatMoney(r.contract.remaining, r.contract.currency)}`}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {canManage && (r.status === "AVAILABLE" || r.status === "RESERVED") && (
                    <span className="inline-flex gap-1">
                      {r.status === "AVAILABLE" && (
                        <Button size="sm" variant="outline" onClick={() => setReserveFor(r)}>
                          <BookmarkIcon />
                          Rezerve
                        </Button>
                      )}
                      <Button size="sm" asChild>
                        <Link href={`/projects/${projectId}/sales/new?bolum=${r.id}`}>
                          <HandshakeIcon />
                          Sat
                        </Link>
                      </Button>
                    </span>
                  )}
                  {canManage && (r.status === "SOLD" || r.status === "LANDOWNER") && (
                    <Button size="sm" variant="ghost" onClick={() => setHandoverFor(r)}>
                      <KeyRoundIcon />
                      Teslim
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {reserveFor && <ReserveDialog projectId={projectId} row={reserveFor} customers={customers} today={today} onClose={() => setReserveFor(null)} />}
      {handoverFor && <HandoverDialog projectId={projectId} row={handoverFor} today={today} onClose={() => setHandoverFor(null)} />}
    </div>
  );
}

function ReserveDialog({ projectId, row, customers, today, onClose }: { projectId: string; row: SalesRowView; customers: { id: string; name: string; phone: string | null }[]; today: string; onClose: () => void }) {
  const inWeek = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ customerId: null as string | null, startDate: today, expiresAt: inWeek, deposit: "", quotedPrice: row.listPrice ? formatNumber(row.listPrice, 2) : "", note: "" });
  const { run, error, fieldErrors, pending } = useAction();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rezervasyon – {row.label}</DialogTitle>
          <DialogDescription>Süre dolunca rezervasyon kendiliğinden düşer ve bölüm yeniden boş görünür.</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="customer" label="Müşteri" required error={fieldErrors.customerId} className="sm:col-span-2">
            <CustomerPicker projectId={projectId} customers={customers} value={form.customerId} onChange={(v) => setForm((f) => ({ ...f, customerId: v }))} invalid={Boolean(fieldErrors.customerId)} />
          </FormField>
          <FormField id="rs-start" label="Başlangıç" error={fieldErrors.startDate}>
            <Input id="rs-start" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </FormField>
          <FormField id="rs-end" label="Bitiş (dahil)" error={fieldErrors.expiresAt}>
            <Input id="rs-end" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
          </FormField>
          <FormField id="rs-deposit" label="Kapora (TL)" error={fieldErrors.deposit}>
            <Input id="rs-deposit" inputMode="decimal" value={form.deposit} onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value }))} />
          </FormField>
          <FormField id="rs-price" label="Teklif fiyatı (KDV hariç)" error={fieldErrors.quotedPrice}>
            <Input id="rs-price" inputMode="decimal" value={form.quotedPrice} onChange={(e) => setForm((f) => ({ ...f, quotedPrice: e.target.value }))} />
          </FormField>
          <FormField id="rs-note" label="Not" className="sm:col-span-2">
            <Input id="rs-note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button disabled={pending} onClick={() => run(() => createReservationAction(projectId, { ...form, unitId: row.id, customerId: form.customerId ?? "" }), onClose)}>
            Rezerve et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HandoverDialog({ projectId, row, today, onClose }: { projectId: string; row: SalesRowView; today: string; onClose: () => void }) {
  const [date, setDate] = useState(row.handoverDate ? dateToDateInput(row.handoverDate) : today);
  const { run, error, pending } = useAction();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Teslim – {row.label}</DialogTitle>
          <DialogDescription>Anahtar teslim tarihi. Boş bırakılırsa teslim kaydı silinir.</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <FormField id="ho-date" label="Teslim tarihi">
          <Input id="ho-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button disabled={pending} onClick={() => run(() => setHandoverAction(projectId, row.id, date), onClose)}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelReservationButton({ projectId, reservationId, label }: { projectId: string; reservationId: string; label: string }) {
  const { run, error, pending } = useAction();
  return (
    <>
      <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => confirm(`${label} rezervasyonu iptal edilsin mi?`) && run(() => cancelReservationAction(projectId, reservationId))}>
        <XIcon />
        İptal
      </Button>
      <FormError message={error} />
    </>
  );
}
