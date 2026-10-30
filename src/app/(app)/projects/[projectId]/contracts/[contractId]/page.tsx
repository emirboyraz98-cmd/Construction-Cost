import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";
import { PaymentBadge } from "@/components/expenses/badges";
import { InfoList } from "@/components/info-list";
import { PageHeader } from "@/components/page-header";
import { BillingStatusBadge, ContractStatusBadge, DocumentGallery, Figure, Meter } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SUPPLY_METHOD_LABELS } from "@/lib/connections/labels";
import { Decimal, formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { getContract, linkableContractAdvances } from "@/server/contracts";
import { ContractAdvances, ContractStatusSelect } from "./contract-panels";

export const metadata: Metadata = { title: "Taşeron sözleşmesi" };

export default async function ContractPage({ params }: PageProps<"/projects/[projectId]/contracts/[contractId]">) {
  const { projectId, contractId } = await params;
  const detail = await getContract(projectId, contractId);
  if (!detail) notFound();
  const { contract: c, perms, progress, advance, totals } = detail;
  const linkable = perms.manage ? await linkableContractAdvances(projectId, contractId) : [];
  const open = c.billings.find((b) => b.status !== "APPROVED");
  const base = `/projects/${projectId}/contracts/${c.id}`;

  return (
    <>
      <PageHeader
        title={`${c.no} · ${c.title}`}
        description={`${c.supplier.name} · ${SUPPLY_METHOD_LABELS[c.supplyMethod]}`}
        actions={
          <>
            {perms.prepare && c.status === "ACTIVE" && (
              <Button asChild>
                <Link href={open ? `${base}/billings/${open.id}` : `${base}/billings/new`}>
                  <PlusIcon />
                  {open ? `${open.seq}. hakedişe git` : "Hakediş hazırla"}
                </Link>
              </Button>
            )}
            {perms.manage && (
              <Button asChild variant="outline">
                <Link href={`${base}/edit`}>
                  <PencilIcon />
                  Düzenle
                </Link>
              </Button>
            )}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ContractStatusBadge status={c.status} />
          {perms.manage && <ContractStatusSelect projectId={projectId} contractId={c.id} status={c.status} />}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="İlerleme" value={`%${formatNumber(progress.percent, 1)}`} note="Onaylı hakedişlere göre" />
            {"contractAmount" in progress && totals && advance && (
              <>
                <Figure label="Sözleşme tutarı (KDV hariç)" value={formatMoney(progress.contractAmount)} />
                <Figure label="Yapılan iş (brüt)" value={formatMoney(totals.gross)} />
                <Figure label="Net ödenecek / ödenmemiş" value={formatMoney(totals.payable)} note={`Ödenmemiş ${formatMoney(totals.unpaid)}`} />
                <Figure label="Açık avans" value={formatMoney(advance.open)} note={`Ödenen ${formatMoney(advance.paid)} − mahsup ${formatMoney(advance.offset)}`} />
                <Figure label="Teminat bakiyesi" value={formatMoney(advance.retention)} note="Hakedişlerden kesilen" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Birim fiyatlar ve ilerleme</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">İş kalemi</TableHead>
                  <TableHead>Maliyet kalemi</TableHead>
                  <TableHead className="text-right">Sözleşme</TableHead>
                  <TableHead className="text-right">Yapılan</TableHead>
                  {perms.amounts && <TableHead className="text-right">Birim fiyat</TableHead>}
                  <TableHead className="pr-5">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.items.map((item) => {
                  const pct = new Decimal(item.quantity.toString()).isZero() ? 0 : item.done.div(item.quantity.toString()).times(100).toNumber();
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="pl-5 font-medium">{item.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.costItem.code} {item.costItem.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.quantity, 4)} {item.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(item.done, 4)}</TableCell>
                      {perms.amounts && <TableCell className="text-right tabular-nums">{item.unitPrice ? formatMoney(item.unitPrice) : "—"}</TableCell>}
                      <TableCell className="w-28 pr-5">
                        <Meter value={pct} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hakedişler</CardTitle>
            <CardDescription>Onaylanan hakedişin brütü (malzeme mahsubu düşülerek) maliyete yazılır; net ödeme vade listesine girer.</CardDescription>
          </CardHeader>
          <CardContent>
            {c.billings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz hakediş yok.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {[...c.billings].reverse().map((b) => (
                  <li key={b.id}>
                    <Link href={`${base}/billings/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 hover:bg-muted/50">
                      <span>
                        <span className="font-medium">{b.seq}. hakediş</span> · {formatDateOnly(b.date)}
                        {b.periodStart && b.periodEnd && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({formatDateOnly(b.periodStart)} – {formatDateOnly(b.periodEnd)})
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <BillingStatusBadge status={b.status} />
                        {"payableAmount" in b && (
                          <>
                            {b.status === "APPROVED" && <PaymentBadge status={b.paymentStatus} />}
                            <span className="tabular-nums">{formatMoney(b.payableAmount)}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {advance && (
          <Card>
            <CardHeader>
              <CardTitle>Sözleşme avansları</CardTitle>
            </CardHeader>
            <CardContent>
              <ContractAdvances
                projectId={projectId}
                contractId={c.id}
                canManage={perms.manage}
                linked={advance.advances.map((a) => ({ id: a.id, date: a.date.toISOString(), amount: a.totalAmountTry.toString(), documentNo: a.documentNo, paymentStatus: a.paymentStatus }))}
                linkable={linkable.map((a) => ({ id: a.id, date: a.date.toISOString(), amount: a.totalAmountTry.toString(), documentNo: a.documentNo, paymentStatus: a.paymentStatus }))}
              />
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
                { label: "Sözleşme tarihi", value: formatDateOnly(c.date) },
                { label: "Süre", value: c.startDate || c.endDate ? `${formatDateOnly(c.startDate)} – ${formatDateOnly(c.endDate)}` : null },
                ...(perms.amounts
                  ? [
                      { label: "KDV", value: `%${formatNumber(c.vatRate)}` },
                      { label: "KDV tevkifatı", value: `%${formatNumber(c.vatWithholdingRate)} (KDV'nin)` },
                      { label: "Teminat kesintisi", value: `%${formatNumber(c.retentionRate)}` },
                      { label: "Avans mahsup oranı", value: `%${formatNumber(c.advanceOffsetRate)}` },
                    ]
                  : []),
                { label: "Kapsam", value: c.scope },
                { label: "Notlar", value: c.notes },
                { label: "Giren", value: c.createdBy.name },
              ]}
            />
          </CardContent>
        </Card>

        {perms.amounts && (
          <Card>
            <CardHeader>
              <CardTitle>Sözleşme belgesi</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentGallery documents={c.documents} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
