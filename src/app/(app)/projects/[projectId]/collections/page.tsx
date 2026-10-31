import { MoreFigures } from "@/components/more-figures";
import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { dateToDateInput, formatDateOnly, formatMoney } from "@/lib/format";
import { CHEQUE_STATUS_LABELS, INSTALLMENT_KIND_LABELS, INSTALLMENT_STATE_LABELS, INSTALLMENT_STATE_STYLES } from "@/lib/sales/labels";
import { getAccess } from "@/server/access";
import { getCollections } from "@/server/sales";
import { ChequeActions, CollectionButton } from "../sales/[contractId]/contract-panels";

export const metadata: Metadata = { title: "Tahsilatlar" };

type Item = Awaited<ReturnType<typeof getCollections>>["overdue"][number];

function InstallmentTable({ projectId, items, canCollect, today, empty }: { projectId: string; items: Item[]; canCollect: boolean; today: string; empty: string }) {
  if (items.length === 0) return <CardContent className="pb-6 text-sm text-muted-foreground">{empty}</CardContent>;
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Vade</TableHead>
            <TableHead>Bölüm / müşteri</TableHead>
            <TableHead>Tür</TableHead>
            <TableHead className="text-right">Kalan</TableHead>
            <TableHead>Durum</TableHead>
            {canCollect && <TableHead className="pr-4" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(({ contract: c, installment: i }) => (
            <TableRow key={i.id}>
              <TableCell className="pl-4 tabular-nums">{formatDateOnly(i.dueDate)}</TableCell>
              <TableCell>
                <Link href={`/projects/${projectId}/sales/${c.id}`} className="hover:underline">
                  {c.unit.block.name} No {c.unit.doorNo} · {c.customer.name}
                </Link>
                {c.customer.phone && (
                  <a href={`tel:${c.customer.phone}`} className="block text-xs text-muted-foreground hover:underline">
                    {c.customer.phone}
                  </a>
                )}
              </TableCell>
              <TableCell>
                {INSTALLMENT_KIND_LABELS[i.kind]}
                {i.note && <span className="block text-xs text-muted-foreground">{i.note}</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(i.remaining, c.currency)}
                {i.paid.gt(0) && <span className="block text-xs text-muted-foreground">{formatMoney(i.amount, c.currency)} üzerinden</span>}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={INSTALLMENT_STATE_STYLES[i.state]}>
                  {INSTALLMENT_STATE_LABELS[i.state]}
                  {i.daysOverdue > 0 && ` · ${i.daysOverdue} gün`}
                </Badge>
              </TableCell>
              {canCollect && (
                <TableCell className="pr-4 text-right">
                  <CollectionButton projectId={projectId} contractId={c.id} currency={c.currency} today={today} suggestedAmount={i.remaining.toString()} rate={c.currency === "TRY" ? null : c.exchangeRate.toString()} label="Tahsil et" variant="outline" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function CollectionsPage({ params }: PageProps<"/projects/[projectId]/collections">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "sales.view")) return <NoAccess text="Bu projenin tahsilatlarını görme yetkiniz yok." />;
  const data = await getCollections(projectId);
  const s = data.summary;
  const today = dateToDateInput(new Date());
  return (
    <>
      <PageHeader
        title="Tahsilatlar"
        description="Müşteri taksitleri: geciken, yaklaşan ve portföydeki çek / senetler."
        actions={
          <Button asChild variant="outline">
            <a href={`/api/projects/${projectId}/collections/export`}>
              <DownloadIcon />
              Excel
            </a>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Tahsil edilen" value={formatMoney(s.collectedTry)} />
            <Figure label="Kalan alacak" value={formatMoney(s.remainingTry)} />
            <Figure label="Geciken" value={formatMoney(s.overdueTry)} tone={s.overdueTry.gt(0) ? "danger" : undefined} note={`${data.overdue.length} taksit`} />
            <Figure label="30 gün içinde" value={formatMoney(s.upcomingTry)} note={`${data.upcoming.length} taksit`} />
            <MoreFigures>
            <Figure label="Aktif sözleşme" value={String(s.contracts)} />
            <Figure label="Portföydeki çek / senet" value={formatMoney(s.chequesTry)} note={`${data.cheques.length} adet`} />
            </MoreFigures>
          </CardContent>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Geciken taksitler</CardTitle>
          </CardHeader>
          <InstallmentTable projectId={projectId} items={data.overdue} canCollect={data.canCollect} today={today} empty="Geciken taksit yok." />
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Yaklaşan taksitler (30 gün)</CardTitle>
          </CardHeader>
          <InstallmentTable projectId={projectId} items={data.upcoming} canCollect={data.canCollect} today={today} empty="30 gün içinde vadesi gelen taksit yok." />
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Portföydeki çek / senetler</CardTitle>
            <CardDescription>Tahsil edildi işaretlenene kadar tahsilata sayılmaz.</CardDescription>
          </CardHeader>
          {data.cheques.length === 0 ? (
            <CardContent className="pb-6 text-sm text-muted-foreground">Portföyde çek / senet yok.</CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Vade</TableHead>
                    <TableHead>Bölüm / müşteri</TableHead>
                    <TableHead>Çek / senet</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    {data.canCollect && <TableHead className="pr-4" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.cheques.map(({ contract: c, collection: x }) => (
                    <TableRow key={x.id}>
                      <TableCell className="pl-4 tabular-nums">{x.chequeDueDate ? formatDateOnly(x.chequeDueDate) : "—"}</TableCell>
                      <TableCell>
                        <Link href={`/projects/${projectId}/sales/${c.id}`} className="hover:underline">
                          {c.unit.block.name} No {c.unit.doorNo} · {c.customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {PAYMENT_METHOD_LABELS[x.method]} {x.documentNo ? `No ${x.documentNo}` : ""}
                        {x.bank && <span className="block text-xs text-muted-foreground">{x.bank}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(x.amount, c.currency)}</TableCell>
                      {data.canCollect && (
                        <TableCell className="pr-4 text-right whitespace-nowrap">
                          <ChequeActions projectId={projectId} collectionId={x.id} status={x.chequeStatus!} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Son tahsilatlar</CardTitle>
          </CardHeader>
          {data.recent.length === 0 ? (
            <CardContent className="pb-6 text-sm text-muted-foreground">Henüz tahsilat yok.</CardContent>
          ) : (
            <ul className="grid grid-cols-1 divide-y text-sm">
              {data.recent.map(({ contract: c, collection: x }) => (
                <li key={x.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span className="min-w-0">
                    <span className="tabular-nums">{formatDateOnly(x.date)}</span> ·{" "}
                    <Link href={`/projects/${projectId}/sales/${c.id}`} className="hover:underline">
                      {c.unit.block.name} No {c.unit.doorNo} · {c.customer.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[x.method]}
                      {x.chequeStatus ? ` · ${CHEQUE_STATUS_LABELS[x.chequeStatus]}` : ""}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatMoney(x.amount, c.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
