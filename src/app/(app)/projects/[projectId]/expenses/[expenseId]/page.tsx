import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import { ApprovalBadge, PaymentBadge } from "@/components/expenses/badges";
import { InfoList } from "@/components/info-list";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import {
  CURRENCY_LABELS,
  DOCUMENT_TYPE_LABELS,
  EXPENSE_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/expenses/labels";
import { dueBucket } from "@/lib/expenses/payables";
import { dateToDateInput, Decimal, formatDateOnly, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { getExpense } from "@/server/expenses";
import { ExpenseActions } from "./expense-actions";

export const metadata: Metadata = { title: "Harcama" };

const percent = (ratio: { toString(): string } | null) => formatNumber(new Decimal(ratio?.toString() ?? 0).times(100), 2);

export default async function ExpenseDetailPage({ params }: PageProps<"/projects/[projectId]/expenses/[expenseId]">) {
  const { projectId, expenseId } = await params;
  const detail = await getExpense(projectId, expenseId);
  if (!detail) notFound();
  const { expense, siblings } = detail;
  const foreign = expense.currency !== "TRY";
  const overdue = expense.paymentStatus === "UNPAID" && dueBucket(expense.dueDate, new Date()) === "overdue";

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href={`/projects/${projectId}/expenses`}>
          <ArrowLeftIcon />
          Harcamalar
        </Link>
      </Button>
      <PageHeader
        title={formatMoney(expense.totalAmountTry)}
        description={
          expense.costItem ? `${expense.costItem.code} ${expense.costItem.name}` : EXPENSE_KIND_LABELS[expense.kind]
        }
      >
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ApprovalBadge status={expense.approvalStatus} />
          <PaymentBadge status={expense.paymentStatus} overdue={overdue} />
          {expense.kind === "ADVANCE" && <Badge variant="secondary">Avans</Badge>}
          {expense.splitGroupId && <Badge variant="secondary">Ortak fatura</Badge>}
        </div>
      </PageHeader>

      <div className="grid max-w-4xl gap-4">
        {expense.approvalStatus === "REJECTED" && (
          <Alert variant="destructive">
            <AlertTitle>Reddedildi</AlertTitle>
            <AlertDescription>
              {expense.approvalNote ?? "Neden belirtilmemiş."} {detail.canModify && "Kaydı düzeltip kaydedince yeniden onaya gider."}
            </AlertDescription>
          </Alert>
        )}

        <ExpenseActions
          projectId={projectId}
          expenseId={expense.id}
          approvalStatus={expense.approvalStatus}
          paymentStatus={expense.paymentStatus}
          canModify={detail.canModify}
          canApprove={detail.canApprove}
          canManage={detail.canManage}
          canCopy={hasCapability(detail.role, "expense.create")}
          isSplit={Boolean(expense.splitGroupId)}
          today={dateToDateInput(new Date())}
        />

        <Card>
          <CardHeader>
            <CardTitle>Tutar</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              items={[
                { label: "Matrah (KDV hariç)", value: formatMoney(expense.netAmount, expense.currency) },
                { label: `KDV (%${formatNumber(expense.vatRate)})`, value: formatMoney(expense.vatAmount, expense.currency) },
                { label: "Toplam", value: formatMoney(expense.totalAmount, expense.currency) },
                ...(foreign
                  ? [
                      { label: "İşlem kuru", value: `1 ${CURRENCY_LABELS[expense.currency]} = ${formatNumber(expense.exchangeRate, 4)} TL` },
                      { label: "Matrah (TL)", value: formatMoney(expense.netAmountTry) },
                      { label: "Toplam (TL)", value: formatMoney(expense.totalAmountTry) },
                    ]
                  : []),
                ...(expense.quantity
                  ? [
                      {
                        label: "Miktar",
                        value: `${formatNumber(expense.quantity, 4)} ${expense.unit ?? ""}`,
                        hint: expense.unitPrice ? `Birim fiyat ${formatMoney(expense.unitPrice, expense.currency)} (KDV hariç)` : undefined,
                      },
                    ]
                  : []),
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              items={[
                { label: "Tarih", value: formatDateOnly(expense.date) },
                {
                  label: "Tedarikçi",
                  value: expense.supplier ? (
                    <Link href={`/company/suppliers/${expense.supplier.id}`} className="underline">
                      {expense.supplier.name}
                    </Link>
                  ) : null,
                  hint: expense.supplier?.taxNumber ? `Vergi no ${expense.supplier.taxNumber}` : undefined,
                },
                { label: "Belge", value: `${DOCUMENT_TYPE_LABELS[expense.documentType]}${expense.documentNo ? ` · ${expense.documentNo}` : ""}` },
                { label: "Blok", value: expense.block?.name ?? "Ortak / site geneli" },
                { label: "Kayıt türü", value: EXPENSE_KIND_LABELS[expense.kind] },
                {
                  label: expense.paymentStatus === "PAID" ? "Ödeme" : "Vade",
                  value:
                    expense.paymentStatus === "PAID"
                      ? `${formatDateOnly(expense.paidAt)}${expense.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[expense.paymentMethod]}` : ""}`
                      : expense.dueDate
                        ? formatDateOnly(expense.dueDate)
                        : null,
                },
                { label: "Açıklama", value: expense.description },
                { label: "Giren", value: `${expense.createdBy.name} · ${formatDateTime(expense.createdAt)}` },
                {
                  label: "Onaylayan",
                  value: expense.approvedBy ? `${expense.approvedBy.name} · ${formatDateTime(expense.approvedAt)}` : null,
                },
                ...(expense.import
                  ? [{ label: "Toplu giriş", value: `${expense.import.fileName ?? "Tablo modu"} · ${formatDateTime(expense.import.createdAt)}` }]
                  : []),
              ]}
            />
          </CardContent>
        </Card>

        {expense.splitGroupId && (
          <Card>
            <CardHeader>
              <CardTitle>Projelere bölünmüş fatura</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              <p>
                Bu proje payı: %{percent(expense.splitRatio)} ·{" "}
                {formatMoney(expense.totalAmountTry)}
              </p>
              {siblings.map((s) => (
                <p key={s.id} className="text-muted-foreground">
                  {s.visible ? s.project.name : "Başka bir proje"} · %{percent(s.splitRatio)} ·{" "}
                  {formatMoney(s.totalAmountTry)}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Belgeler ({expense.documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {expense.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belge eklenmemiş.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {expense.documents.map((doc) => (
                  <li key={doc.id}>
                    <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" className="block">
                      {doc.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- yetki kontrollü belge adresi
                        <img src={`/api/documents/${doc.id}`} alt={doc.fileName} className="aspect-[3/4] w-full rounded-md border object-cover" />
                      ) : (
                        <span className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-md border bg-muted text-sm">
                          <FileTextIcon className="size-8" />
                          PDF
                        </span>
                      )}
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{doc.fileName}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
