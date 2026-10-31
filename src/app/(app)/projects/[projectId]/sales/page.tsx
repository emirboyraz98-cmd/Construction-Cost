import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGridIcon, ListIcon, UsersIcon } from "lucide-react";
import { FloorPlan, groupPlan } from "@/components/floor-plan";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { FLOOR_LABEL, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { dateToDateInput, formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { SALE_STATUS_LABELS, SALE_STATUS_STYLES } from "@/lib/sales/labels";
import { getAccess } from "@/server/access";
import { getSalesOverview, listCustomers } from "@/server/sales";
import { CancelReservationButton, SalesTable, type SalesRowView } from "./sales-panels";

export const metadata: Metadata = { title: "Satışlar" };

export default async function SalesPage({ params, searchParams }: PageProps<"/projects/[projectId]/sales">) {
  const { projectId } = await params;
  const planView = (await searchParams).gorunum === "plan";
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "sales.view")) return <NoAccess text="Bu projenin satışlarını görme yetkiniz yok." />;
  const [data, { customers }] = await Promise.all([getSalesOverview(projectId), listCustomers(projectId)]);
  const s = data.summary;
  const rows: SalesRowView[] = data.rows.map((r) => ({
    id: r.unit.id,
    label: `${r.unit.block.name} · No ${r.unit.doorNo}`,
    detail: [FLOOR_LABEL(r.unit.floor), USAGE_TYPE_LABELS[r.unit.usageType], r.unit.layout].filter(Boolean).join(" · "),
    grossArea: r.unit.grossArea.toString(),
    status: r.status,
    listPrice: r.unit.listPrice?.toString() ?? null,
    listVatRate: r.unit.listVatRate?.toString() ?? null,
    landowner: r.unit.landowner?.name ?? null,
    handoverDate: r.unit.handoverDate?.toISOString() ?? null,
    contract: r.contract
      ? {
          id: r.contract.id,
          customer: r.contract.customer.name,
          salePrice: r.contract.salePrice.toString(),
          currency: r.contract.currency,
          total: r.contract.totalAmount.toString(),
          collected: r.contract.state.collected.toString(),
          remaining: r.contract.state.remaining.toString(),
          overdue: r.contract.state.overdue.toString(),
          date: r.contract.date.toISOString(),
        }
      : null,
    reservation: r.reservation ? { id: r.reservation.id, customer: r.reservation.customer.name, expiresAt: r.reservation.expiresAt.toISOString() } : null,
  }));
  const gap = s.targetRevenue ? s.expectedRevenue.minus(s.targetRevenue) : null;

  return (
    <>
      <PageHeader
        title="Satışlar"
        description="Bölüm durumu, rezervasyon ve satış sözleşmeleri. Satışta bölümün fiyatı kilitlenir; fiyatlandırmada gerçek satış fiyatı kullanılır."
        actions={
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/sales/customers`}>
              <UsersIcon />
              Müşteriler ({customers.length})
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            <Figure label="Boş" value={String(s.available)} />
            <Figure label="Rezerve" value={String(s.reserved)} />
            <Figure label="Satıldı" value={String(s.sold)} />
            <Figure label="Arsa sahibi" value={String(s.landowner)} note="Satışa kapalı" />
            <Figure label="Satış (KDV hariç)" value={formatMoney(s.soldNetTry)} note={`KDV dahil ${formatMoney(s.soldTotalTry)}`} />
            <Figure label="Tahsil edilen" value={formatMoney(s.collectedTry)} />
            <Figure label="Kalan alacak" value={formatMoney(s.remainingTry)} tone={s.overdueTry.gt(0) ? "warn" : undefined} note={s.overdueTry.gt(0) ? `${formatMoney(s.overdueTry)} gecikmiş` : "Gecikme yok"} />
            <Figure
              label="Hedef gelire göre"
              value={gap ? formatMoney(gap) : "—"}
              tone={gap?.isNegative() ? "danger" : undefined}
              note={s.targetRevenue ? `Satılan + boşların liste fiyatı ${formatMoney(s.expectedRevenue)} ↔ hedef ${formatMoney(s.targetRevenue)}` : "Onaylı fiyat listesi yok"}
            />
          </CardContent>
        </Card>

        {data.activeReservations.length > 0 && (
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Geçerli rezervasyonlar</CardTitle>
              <CardDescription>Süresi dolan rezervasyon kendiliğinden düşer.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 gap-2 text-sm">
                {data.activeReservations.map((r) => {
                  const unit = data.rows.find((x) => x.unit.id === r.unitId)?.unit;
                  const label = unit ? `${unit.block.name} No ${unit.doorNo}` : "";
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="font-medium">{label}</span> · {r.customer.name}
                        <span className="block text-xs text-muted-foreground">
                          {formatDateOnly(r.startDate)} – {formatDateOnly(r.expiresAt)}
                          {r.deposit ? ` · kapora ${formatMoney(r.deposit)}` : ""}
                          {r.quotedPrice ? ` · teklif ${formatMoney(r.quotedPrice)}` : ""}
                        </span>
                      </span>
                      {data.canManage && (
                        <span className="flex gap-1">
                          <Button size="sm" asChild>
                            <Link href={`/projects/${projectId}/sales/new?bolum=${r.unitId}`}>Satışa dönüştür</Link>
                          </Button>
                          <CancelReservationButton projectId={projectId} reservationId={r.id} label={label} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-1.5" role="tablist" aria-label="Görünüm">
          <Button asChild size="sm" variant={planView ? "outline" : "default"}>
            <Link href="?" role="tab" aria-selected={!planView}>
              <ListIcon />
              Liste
            </Link>
          </Button>
          <Button asChild size="sm" variant={planView ? "default" : "outline"}>
            <Link href="?gorunum=plan" role="tab" aria-selected={planView}>
              <LayoutGridIcon />
              Kat planı
            </Link>
          </Button>
        </div>
        {planView ? (
          <FloorPlan
            legend={(["AVAILABLE", "RESERVED", "SOLD", "LANDOWNER"] as const).map((st) => ({ label: SALE_STATUS_LABELS[st], tone: SALE_STATUS_STYLES[st], count: data.rows.filter((r) => r.status === st).length }))}
            blocks={groupPlan(
              data.rows.map((r) => ({ ...r.unit, row: r })),
              (u) => {
                const r = u.row;
                return {
                  tone: SALE_STATUS_STYLES[r.status],
                  lines: [
                    [u.layout, `${formatNumber(u.grossArea, 0)} m²`].filter(Boolean).join(" · "),
                    r.contract ? r.contract.customer.name : r.reservation ? `Rez.: ${r.reservation.customer.name}` : r.status === "LANDOWNER" ? (u.landowner?.name ?? "Arsa sahibi") : u.listPrice ? formatMoney(u.listPrice) : "Liste yok",
                    ...(r.contract && r.contract.state.overdue.gt(0) ? ["Geciken taksit"] : []),
                  ],
                  href: r.contract ? `/projects/${projectId}/sales/${r.contract.id}` : data.canManage && (r.status === "AVAILABLE" || r.status === "RESERVED") ? `/projects/${projectId}/sales/new?bolum=${u.id}` : undefined,
                  title: `${u.block.name} No ${u.doorNo} · ${SALE_STATUS_LABELS[r.status]}`,
                };
              },
            )}
          />
        ) : (
          <SalesTable projectId={projectId} rows={rows} customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))} canManage={data.canManage} today={dateToDateInput(new Date())} />
        )}
      </div>
    </>
  );
}
