"use client";

import { useState } from "react";
import { BanIcon, CalendarCogIcon, CheckIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { Decimal, formatMoney, formatNumber } from "@/lib/format";
import { addCollectionAction, cancelContractAction, deleteCollectionAction, setChequeStatusAction, updateContractInfoAction, updatePlanAction } from "../actions";
import { PlanEditor, type PlanRowInput } from "../plan-editor";

export function CollectionButton({ projectId, contractId, currency, today, suggestedAmount, rate, label = "Tahsilat gir", variant = "default" }: { projectId: string; contractId: string; currency: string; today: string; suggestedAmount: string | null; rate: string | null; label?: string; variant?: "default" | "outline" | "ghost" }) {
  const [open, setOpen] = useState(false);
  const blank = () => ({ date: today, amount: suggestedAmount ? formatNumber(suggestedAmount, 2) : "", exchangeRate: currency === "TRY" ? "1" : rate ? formatNumber(rate, 4) : "", method: "BANK_TRANSFER", documentNo: "", chequeDueDate: "", bank: "", note: "" });
  const [form, setForm] = useState(blank);
  const { run, error, fieldErrors, pending } = useAction();
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const paper = form.method === "CHEQUE" || form.method === "PROMISSORY_NOTE";
  return (
    <>
      <Button
        size="sm"
        variant={variant}
        onClick={() => {
          setForm(blank());
          setOpen(true);
        }}
      >
        <PlusIcon />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tahsilat</DialogTitle>
            <DialogDescription>Tahsilat en eski vadeli taksitten başlayarak dağıtılır (kısmi ödeme olabilir). Çek / senet tahsil edildi işaretlenince sayılır.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="co-date" label="Tarih" required error={fieldErrors.date}>
              <Input id="co-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </FormField>
            <FormField id="co-amount" label={`Tutar (${currency})`} required error={fieldErrors.amount}>
              <Input id="co-amount" inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
            </FormField>
            {currency !== "TRY" && (
              <FormField id="co-rate" label={`Kur (1 ${currency} = TL)`} required error={fieldErrors.exchangeRate}>
                <Input id="co-rate" inputMode="decimal" value={form.exchangeRate} onChange={(e) => set({ exchangeRate: e.target.value })} />
              </FormField>
            )}
            <FormField id="co-method" label="Ödeme şekli">
              <NativeSelect id="co-method" value={form.method} onChange={(e) => set({ method: e.target.value })}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="co-doc" label={paper ? "Çek / senet no" : "Dekont / makbuz no"}>
              <Input id="co-doc" value={form.documentNo} onChange={(e) => set({ documentNo: e.target.value })} />
            </FormField>
            {paper && (
              <>
                <FormField id="co-due" label="Vadesi" error={fieldErrors.chequeDueDate}>
                  <Input id="co-due" type="date" value={form.chequeDueDate} onChange={(e) => set({ chequeDueDate: e.target.value })} />
                </FormField>
                <FormField id="co-bank" label="Banka">
                  <Input id="co-bank" value={form.bank} onChange={(e) => set({ bank: e.target.value })} />
                </FormField>
              </>
            )}
            <FormField id="co-note" label="Not" className="sm:col-span-2">
              <Input id="co-note" value={form.note} onChange={(e) => set({ note: e.target.value })} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => run(() => addCollectionAction(projectId, contractId, form), () => setOpen(false))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ChequeActions({ projectId, collectionId, status }: { projectId: string; collectionId: string; status: "PENDING" | "CLEARED" | "BOUNCED" }) {
  const { run, error, pending } = useAction();
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {status !== "CLEARED" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setChequeStatusAction(projectId, collectionId, "CLEARED"))}>
          <CheckIcon />
          Tahsil edildi
        </Button>
      )}
      {status === "PENDING" && (
        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => confirm("Karşılıksız olarak işaretlensin mi? Tutar tahsilattan düşülür.") && run(() => setChequeStatusAction(projectId, collectionId, "BOUNCED"))}>
          <XIcon />
          Karşılıksız
        </Button>
      )}
      {status !== "PENDING" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setChequeStatusAction(projectId, collectionId, "PENDING"))}>
          Portföye al
        </Button>
      )}
      <FormError message={error} />
    </span>
  );
}

export function DeleteCollectionButton({ projectId, collectionId }: { projectId: string; collectionId: string }) {
  const { run, error, pending } = useAction();
  return (
    <>
      <Button size="icon" variant="ghost" className="text-destructive" aria-label="Tahsilatı sil" disabled={pending} onClick={() => confirm("Tahsilat silinsin mi?") && run(() => deleteCollectionAction(projectId, collectionId))}>
        <Trash2Icon />
      </Button>
      <FormError message={error} />
    </>
  );
}

export function PlanEditButton({ projectId, contractId, rows, total, currency, startDate }: { projectId: string; contractId: string; rows: PlanRowInput[]; total: string; currency: string; startDate: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(rows);
  const { run, error, pending } = useAction();
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setPlan(rows);
          setOpen(true);
        }}
      >
        <CalendarCogIcon />
        Planı düzenle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ödeme planını düzenle</DialogTitle>
            <DialogDescription>Toplam satış tutarına eşit kalmalı. Yapılan tahsilatlar yeni plana vade sırasıyla yeniden dağıtılır.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <PlanEditor rows={plan} onChange={setPlan} total={new Decimal(total)} currency={currency} startDate={startDate} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => run(() => updatePlanAction(projectId, contractId, plan), () => setOpen(false))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ContractInfoButton({ projectId, contractId, info }: { projectId: string; contractId: string; info: { contractNo: string; agent: string; commissionAmount: string; notes: string } }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(info);
  const { run, error, fieldErrors, pending } = useAction();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PencilIcon />
        Bilgileri düzenle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sözleşme bilgileri</DialogTitle>
            <DialogDescription>Fiyat değişikliği için satışı iptal edip yeniden girin.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="ci-no" label="Sözleşme no">
              <Input id="ci-no" value={form.contractNo} onChange={(e) => setForm((f) => ({ ...f, contractNo: e.target.value }))} />
            </FormField>
            <FormField id="ci-agent" label="Emlakçı">
              <Input id="ci-agent" value={form.agent} onChange={(e) => setForm((f) => ({ ...f, agent: e.target.value }))} />
            </FormField>
            <FormField id="ci-comm" label="Komisyon (TL)" error={fieldErrors.commissionAmount}>
              <Input id="ci-comm" inputMode="decimal" value={form.commissionAmount} onChange={(e) => setForm((f) => ({ ...f, commissionAmount: e.target.value }))} />
            </FormField>
            <FormField id="ci-notes" label="Not">
              <Input id="ci-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => run(() => updateContractInfoAction(projectId, contractId, form), () => setOpen(false))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CancelContractButton({ projectId, contractId, collected }: { projectId: string; contractId: string; collected: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, error, fieldErrors, pending } = useAction();
  return (
    <>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}>
        <BanIcon />
        Satışı iptal et
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Satışı iptal et</DialogTitle>
            <DialogDescription>
              Bölüm yeniden satışa açılır ve fiyat kilidi kalkar. Sözleşme ve tahsilatlar kayıtta kalır.
              {Number(collected) > 0 && ` Tahsil edilen ${formatMoney(collected)} için iade ayrıca yapılmalı.`}
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <FormField id="cc-reason" label="İptal nedeni" required error={fieldErrors._}>
            <Input id="cc-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => run(() => cancelContractAction(projectId, contractId, reason), () => setOpen(false))}>
              İptal et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
