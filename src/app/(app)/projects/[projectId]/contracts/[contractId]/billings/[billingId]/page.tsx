import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import { PaymentBadge } from "@/components/expenses/badges";
import { InfoList } from "@/components/info-list";
import { PageHeader } from "@/components/page-header";
import { BillingStatusBadge, DocumentGallery } from "@/components/purchasing/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { dateToDateInput, Decimal, formatDateOnly, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { getBilling } from "@/server/contracts";
import { BillingActions } from "./billing-actions";

export const metadata: Metadata = { title: "Hakediş" };

export default async function BillingPage({ params }: PageProps<"/projects/[projectId]/contracts/[contractId]/billings/[billingId]">) {
  const { projectId, contractId, billingId } = await params;
  const detail = await getBilling(projectId, billingId);
  if (!detail || detail.billing.contractId !== contractId) notFound();
  const { billing: b, perms } = detail;
  const money = (v: { toString(): string } | null) => (v == null ? "—" : formatMoney(v));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href={`/projects/${projectId}/contracts/${contractId}`}>
          <ArrowLeftIcon />
          {b.contract.no} {b.contract.title}
        </Link>
      </Button>
      <PageHeader
        title={`${b.seq}. hakediş${perms.amounts ? ` · ${money(b.payableAmount)}` : ""}`}
        description={`${b.contract.supplier.name} · ${formatDateOnly(b.date)}`}
        actions={
          <Button asChild variant="outline">
            <a href={`/print/projects/${projectId}/billings/${b.id}`} target="_blank" rel="noopener">
              <PrinterIcon />
              PDF / yazdır
            </a>
          </Button>
        }
      >
        <div className="mt-2 flex flex-wrap gap-1.5">
          <BillingStatusBadge status={b.status} />
          {b.status === "APPROVED" && <PaymentBadge status={b.paymentStatus} />}
        </div>
      </PageHeader>

      <div className="grid max-w-4xl grid-cols-1 gap-4">
        {b.rejectionNote && b.status === "DRAFT" && (
          <Alert variant="destructive">
            <AlertTitle>Geri gönderildi</AlertTitle>
            <AlertDescription>{b.rejectionNote}</AlertDescription>
          </Alert>
        )}
        <BillingActions
          projectId={projectId}
          contractId={contractId}
          billingId={b.id}
          status={b.status}
          paymentStatus={b.paymentStatus}
          canEdit={detail.canEdit}
          canApprove={perms.approve}
          canPay={perms.pay}
          canPrepare={perms.prepare}
          isLatest={detail.isLatest}
          today={dateToDateInput(new Date())}
        />

        <Card>
          <CardHeader>
            <CardTitle>Metraj</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">İş kalemi</TableHead>
                  <TableHead className="text-right">Önceki</TableHead>
                  <TableHead className="text-right">Kümülatif</TableHead>
                  <TableHead className="text-right">Bu dönem</TableHead>
                  {perms.amounts && <TableHead className="pr-5 text-right">Tutar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-5">
                      <span className="font-medium">{l.contractItem.description}</span>
                      <span className="block text-xs text-muted-foreground">
                        {l.contractItem.costItem.code} {l.contractItem.costItem.name}
                        {l.contractItem.unitPrice && ` · ${formatMoney(l.contractItem.unitPrice)} / ${l.contractItem.unit}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(l.previousQuantity, 4)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(l.cumulativeQuantity, 4)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(new Decimal(l.cumulativeQuantity.toString()).minus(l.previousQuantity.toString()), 4)} {l.contractItem.unit}
                    </TableCell>
                    {perms.amounts && <TableCell className="pr-5 text-right tabular-nums">{money(l.amount)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {perms.amounts && (
          <Card>
            <CardHeader>
              <CardTitle>Hesap</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm tabular-nums">
                <dt>Bu dönem brüt (KDV hariç)</dt>
                <dd className="text-right font-medium">{money(b.grossAmount)}</dd>
                <dt>+ KDV (%{formatNumber(b.vatRate)})</dt>
                <dd className="text-right">{money(b.vatAmount)}</dd>
                <dt>− KDV tevkifatı</dt>
                <dd className="text-right">{money(b.vatWithheld)}</dd>
                <dt>− Teminat</dt>
                <dd className="text-right">{money(b.retention)}</dd>
                <dt>− Avans mahsubu</dt>
                <dd className="text-right">{money(b.advanceOffset)}</dd>
                <dt>− Malzeme mahsubu</dt>
                <dd className="text-right">{money(b.materialOffset)}</dd>
                <dt>− Diğer{b.otherDeductionNote ? ` (${b.otherDeductionNote})` : ""}</dt>
                <dd className="text-right">{money(b.otherDeductions)}</dd>
                <dt className="border-t pt-1.5 font-semibold">Net ödenecek</dt>
                <dd className="border-t pt-1.5 text-right text-base font-semibold">{money(b.payableAmount)}</dd>
              </dl>
              {b.expenses.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Maliyete yazılan: {b.expenses.map((e) => `${e.costItem?.code ?? ""} ${formatMoney(e.netAmountTry)}`).join(" · ")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              items={[
                { label: "Dönem", value: b.periodStart || b.periodEnd ? `${formatDateOnly(b.periodStart)} – ${formatDateOnly(b.periodEnd)}` : null },
                { label: "Ödeme vadesi", value: b.dueDate ? formatDateOnly(b.dueDate) : null },
                ...(b.paidAt ? [{ label: "Ödendi", value: `${formatDateOnly(b.paidAt)}${b.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[b.paymentMethod]}` : ""}` }] : []),
                { label: "Hazırlayan", value: `${b.createdBy.name} · ${formatDateTime(b.createdAt)}` },
                { label: "Onaylayan", value: b.approvedBy ? `${b.approvedBy.name} · ${formatDateTime(b.approvedAt)}` : null },
                { label: "Not", value: b.notes },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Belgeler</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentGallery documents={b.documents} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
