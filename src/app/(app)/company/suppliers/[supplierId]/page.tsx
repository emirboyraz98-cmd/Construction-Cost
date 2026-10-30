import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { ApprovalBadge, PaymentOrKindBadge } from "@/components/expenses/badges";
import { InfoList } from "@/components/info-list";
import { ConnectionStatusBadge, ContractStatusBadge } from "@/components/purchasing/shared";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability } from "@/lib/auth/roles";
import { DOCUMENT_TYPE_LABELS, EXPENSE_KIND_LABELS, SUPPLIER_KIND_LABELS } from "@/lib/expenses/labels";
import { dueBucket } from "@/lib/expenses/payables";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { getAccess } from "@/server/access";
import { getSupplier } from "@/server/suppliers";

export const metadata: Metadata = { title: "Tedarikçi" };

export default async function SupplierPage({ params }: PageProps<"/company/suppliers/[supplierId]">) {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "supplier.view")) notFound();
  const { supplierId } = await params;
  const data = await getSupplier(supplierId);
  if (!data) notFound();
  const { supplier, balance, expenses, connections, contracts } = data;
  const today = new Date();

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/company/suppliers">
          <ArrowLeftIcon />
          Tedarikçiler
        </Link>
      </Button>
      <PageHeader
        title={supplier.name}
        description={SUPPLIER_KIND_LABELS[supplier.kind]}
        actions={
          hasCapability(user.role, "supplier.manage") && (
            <Button asChild variant="outline">
              <Link href={`/company/suppliers/${supplier.id}/edit`}>
                <PencilIcon />
                Düzenle
              </Link>
            </Button>
          )
        }
      >
        {!supplier.active && <Badge variant="outline" className="mt-2">Pasif</Badge>}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardContent>
            <InfoList
              items={[
                { label: "Vergi / TC no", value: supplier.taxNumber },
                { label: "Vergi dairesi", value: supplier.taxOffice },
                { label: "Telefon", value: supplier.phone },
                { label: "E-posta", value: supplier.email },
                { label: "IBAN", value: supplier.iban },
                { label: "Adres", value: supplier.address },
                { label: "Notlar", value: supplier.notes },
              ]}
            />
          </CardContent>
        </Card>

        {balance !== null || expenses.length > 0 ? (
          <>
            <Card className="py-4">
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(
                  [
                    ["Toplam (KDV dahil)", balance?.invoiced],
                    ["Ödenen", balance?.paid],
                    ["Ödenmemiş", balance?.unpaid],
                    ["Verilen avans", balance?.advances],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold tabular-nums">{formatMoney(value ?? 0)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            {(connections.length > 0 || contracts.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Bağlantılar ve taşeron sözleşmeleri</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-1.5 text-sm">
                    {connections.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/company/connections/${c.id}`} className="hover:underline">
                          Bağlantı {c.no} · {formatDateOnly(c.date)}
                        </Link>
                        <ConnectionStatusBadge status={c.status} />
                      </li>
                    ))}
                    {contracts.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/projects/${c.projectId}/contracts/${c.id}`} className="hover:underline">
                          Sözleşme {c.no} {c.title} · {c.project.name}
                        </Link>
                        <ContractStatusBadge status={c.status} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            <Card className="py-0">
              <CardHeader className="pt-5">
                <CardTitle>Hareketler</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Tarih</TableHead>
                    <TableHead>Proje</TableHead>
                    <TableHead>Kalem</TableHead>
                    <TableHead>Belge</TableHead>
                    <TableHead className="text-right">Tutar (TL)</TableHead>
                    <TableHead className="pr-4">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-4">
                        <Link href={`/projects/${e.projectId}/expenses/${e.id}`} className="hover:underline">
                          {formatDateOnly(e.date)}
                        </Link>
                      </TableCell>
                      <TableCell>{e.project.name}</TableCell>
                      <TableCell className="max-w-56 truncate">
                        {e.costItem ? `${e.costItem.code} ${e.costItem.name}` : e.kind === "ADVANCE" ? "Avans" : "—"}
                        {e.kind !== "EXPENSE" && <span className="block text-xs text-muted-foreground">{EXPENSE_KIND_LABELS[e.kind]}</span>}
                      </TableCell>
                      <TableCell>
                        {DOCUMENT_TYPE_LABELS[e.documentType]}
                        {e.documentNo && <span className="block text-xs text-muted-foreground">{e.documentNo}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(e.totalAmountTry)}</TableCell>
                      <TableCell className="pr-4">
                        <span className="flex flex-wrap gap-1">
                          <ApprovalBadge status={e.approvalStatus} />
                          <PaymentOrKindBadge kind={e.kind} status={e.paymentStatus} overdue={e.paymentStatus === "UNPAID" && dueBucket(e.dueDate, today) === "overdue"} />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                        Bu tedarikçiye ait harcama yok.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
