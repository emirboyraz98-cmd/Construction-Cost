import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { FLOOR_LABEL, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { dateToDateInput, formatDateOnly, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { CHEQUE_STATUS_LABELS, INSTALLMENT_KIND_LABELS, INSTALLMENT_STATE_LABELS, INSTALLMENT_STATE_STYLES } from "@/lib/sales/labels";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { getContract } from "@/server/sales";
import { CancelContractButton, ChequeActions, CollectionButton, ContractInfoButton, DeleteCollectionButton, PlanEditButton } from "./contract-panels";

export const metadata: Metadata = { title: "Satış sözleşmesi" };

export default async function ContractPage({ params }: PageProps<"/projects/[projectId]/sales/[contractId]">) {
  const { projectId, contractId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "sales.view")) return <NoAccess text="Bu projenin satışlarını görme yetkiniz yok." />;
  const data = await getContract(projectId, contractId);
  if (!data) notFound();
  const { contract: c, state } = data;
  const cur = c.currency;
  const today = dateToDateInput(new Date());
  const unit = c.unit;
  const cancelled = c.status === "CANCELLED";

  return (
    <>
      <PageHeader
        title={`${unit.block.name} No ${unit.doorNo} · ${c.customer.name}`}
        description={`${[FLOOR_LABEL(unit.floor), USAGE_TYPE_LABELS[unit.usageType], unit.layout, `${formatNumber(unit.grossArea, 2)} m² brüt`].filter(Boolean).join(" · ")} · sözleşme ${formatDateOnly(c.date)}${c.contractNo ? ` · No ${c.contractNo}` : ""}`}
        actions={
          data.canManage && (
            <div className="flex flex-wrap gap-2">
              <ContractInfoButton projectId={projectId} contractId={c.id} info={{ contractNo: c.contractNo ?? "", agent: c.agent ?? "", commissionAmount: c.commissionAmount ? formatNumber(c.commissionAmount, 2) : "", notes: c.notes ?? "" }} />
              <CancelContractButton projectId={projectId} contractId={c.id} collected={state.collectedTry.toString()} />
            </div>
          )
        }
      >
        {cancelled && (
          <Badge variant="outline" className="mt-2 border-red-300 bg-red-50 text-red-700">
            İptal edildi {c.cancelledAt ? formatDateOnly(c.cancelledAt) : ""}
            {c.cancelReason ? ` · ${c.cancelReason}` : ""}
          </Badge>
        )}
      </PageHeader>
      <div className="grid grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="Liste fiyatı" value={formatMoney(c.listPrice, cur)} note={Number(c.discount) > 0 ? `İndirim ${formatMoney(c.discount, cur)}` : undefined} />
            <Figure label="Satış fiyatı (KDV hariç)" value={formatMoney(c.salePrice, cur)} note={cur !== "TRY" ? `${formatMoney(c.salePriceTry)} · kur ${formatNumber(c.exchangeRate, 4)}` : undefined} />
            <Figure label={`KDV %${formatNumber(c.vatRate, 2)}`} value={formatMoney(c.vatAmount, cur)} note={`Toplam ${formatMoney(c.totalAmount, cur)}`} />
            <Figure label="Tahsil edilen" value={formatMoney(state.collected, cur)} note={state.pendingCheques.gt(0) ? `+ ${formatMoney(state.pendingCheques, cur)} çek / senet portföyde` : undefined} />
            <Figure label="Kalan" value={formatMoney(state.remaining, cur)} tone={state.overdue.gt(0) ? "danger" : undefined} note={state.overdue.gt(0) ? `${formatMoney(state.overdue, cur)} gecikmiş` : state.nextDue ? `Sıradaki ${formatDateOnly(state.nextDue.dueDate)}` : "Tamamı ödendi"} />
            <Figure label="Emlakçı / komisyon" value={c.commissionAmount ? formatMoney(c.commissionAmount) : "—"} note={c.agent ?? undefined} />
          </CardContent>
        </Card>
        {state.planMismatch && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Ödeme planı toplamı satış tutarıyla eşleşmiyor; planı düzenleyin.</p>}
        {state.overpaid.gt(0) && <p className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">Fazla tahsilat: {formatMoney(state.overpaid, cur)}.</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="gap-0 pb-0 lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle>Ödeme planı</CardTitle>
              <CardDescription>Tutarlar KDV dahil, {cur}. Tahsilatlar en eski vadeden başlayarak dağıtılır.</CardDescription>
              {data.canManage && (
                <CardAction>
                  <PlanEditButton
                    projectId={projectId}
                    contractId={c.id}
                    total={c.totalAmount.toString()}
                    currency={cur}
                    startDate={dateToDateInput(c.date)}
                    rows={c.installments.map((i) => ({ dueDate: dateToDateInput(i.dueDate), amount: formatNumber(i.amount, 2), kind: i.kind, note: i.note ?? "" }))}
                  />
                </CardAction>
              )}
            </CardHeader>
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Vade</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead className="text-right">Ödenen</TableHead>
                    <TableHead className="text-right">Kalan</TableHead>
                    <TableHead className="pr-4">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 tabular-nums">{formatDateOnly(r.dueDate)}</TableCell>
                      <TableCell>
                        {INSTALLMENT_KIND_LABELS[r.kind]}
                        {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.amount, cur)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.paid.gt(0) ? formatMoney(r.paid, cur) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.remaining.gt(0) ? formatMoney(r.remaining, cur) : "—"}</TableCell>
                      <TableCell className="pr-4">
                        <Badge variant="outline" className={INSTALLMENT_STATE_STYLES[r.state]}>
                          {INSTALLMENT_STATE_LABELS[r.state]}
                          {r.daysOverdue > 0 && ` · ${r.daysOverdue} gün`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Müşteri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              <p className="font-medium">{c.customer.name}</p>
              {c.customer.identityNo && <p className="text-muted-foreground">Kimlik / vergi no: {c.customer.identityNo}</p>}
              {c.customer.phone && (
                <a href={`tel:${c.customer.phone}`} className="hover:underline">
                  {c.customer.phone}
                </a>
              )}
              {c.customer.email && <p>{c.customer.email}</p>}
              {c.customer.address && <p className="text-muted-foreground">{c.customer.address}</p>}
              {unit.handoverDate && <p className="mt-2">Teslim: {formatDateOnly(unit.handoverDate)}</p>}
              {c.notes && <p className="mt-2 text-muted-foreground">{c.notes}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                Giren: {c.createdBy?.name ?? "—"} · {formatDateTime(c.createdAt)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Tahsilatlar</CardTitle>
            {data.canCollect && (
              <CardAction>
                <CollectionButton projectId={projectId} contractId={c.id} currency={cur} today={today} suggestedAmount={state.nextDue?.remaining.toString() ?? null} rate={cur === "TRY" ? null : c.exchangeRate.toString()} />
              </CardAction>
            )}
          </CardHeader>
          {c.collections.length === 0 ? (
            <CardContent className="pb-6 text-sm text-muted-foreground">Henüz tahsilat yok.</CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Tarih</TableHead>
                    <TableHead>Şekil</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.collections.map((x) => (
                    <TableRow key={x.id} className={cn(x.chequeStatus === "BOUNCED" && "text-muted-foreground line-through")}>
                      <TableCell className="pl-4 tabular-nums">{formatDateOnly(x.date)}</TableCell>
                      <TableCell>
                        {PAYMENT_METHOD_LABELS[x.method]}
                        <span className="block text-xs text-muted-foreground">
                          {[x.documentNo && `No ${x.documentNo}`, x.bank, x.chequeDueDate && `vade ${formatDateOnly(x.chequeDueDate)}`, x.note, x.createdBy?.name].filter(Boolean).join(" · ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(x.amount, cur)}
                        {cur !== "TRY" && <span className="block text-xs text-muted-foreground">{formatMoney(x.amountTry)}</span>}
                      </TableCell>
                      <TableCell>{x.chequeStatus ? CHEQUE_STATUS_LABELS[x.chequeStatus] : "Tahsil edildi"}</TableCell>
                      <TableCell className="pr-4 text-right whitespace-nowrap">
                        {data.canCollect && x.chequeStatus && <ChequeActions projectId={projectId} collectionId={x.id} status={x.chequeStatus} />}
                        {data.canCollect && <DeleteCollectionButton projectId={projectId} collectionId={x.id} />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
