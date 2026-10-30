import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AlertList, ConnectionStatusBadge, Meter, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConnectionStatus } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { CONNECTION_STATUS_LABELS, PRICE_TYPE_LABELS } from "@/lib/connections/labels";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { listConnections } from "@/server/connections";

export const metadata: Metadata = { title: "Bağlantılar" };

const FILTERS = [
  { key: "", label: "Aktif" },
  { key: "tamam", label: "Tamamlanan" },
  { key: "taslak", label: "Taslak" },
  { key: "iptal", label: "İptal" },
] as const;
const STATUS_OF: Record<string, ConnectionStatus> = { "": "ACTIVE", tamam: "COMPLETED", taslak: "DRAFT", iptal: "CANCELLED" };

export default async function ConnectionsPage({ searchParams }: PageProps<"/company/connections">) {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "connection.view")) return <NoAccess text="Malzeme bağlantılarını görme yetkiniz yok." />;
  const params = await searchParams;
  const filter = typeof params.durum === "string" && params.durum in STATUS_OF ? params.durum : "";
  const { rows, projectName, canManage } = await listConnections({ status: STATUS_OF[filter] });

  return (
    <>
      <PageHeader
        title="Malzeme bağlantıları"
        description="Önceden sabitlenen miktar ve fiyatlar: toplam / çekilen / kalan, proje tahsisi, ödeme planı ve avans bakiyesi."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/company/connections/new">
                <PlusIcon />
                Yeni bağlantı
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `?durum=${f.key}` : "?"}
            className={cn("rounded-md px-3 py-1.5", filter === f.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {CONNECTION_STATUS_LABELS[STATUS_OF[filter]]} bağlantı yok.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((c) => (
            <Link key={c.id} href={`/company/connections/${c.id}`} className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Card className="h-full gap-3 py-4 transition-shadow group-hover:shadow-md">
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {c.no} · {c.supplier.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateOnly(c.date)} · {PRICE_TYPE_LABELS[c.priceType]}
                        {c.lastDrawDate && ` · son çekiş ${formatDateOnly(c.lastDrawDate)}`}
                      </p>
                    </div>
                    <ConnectionStatusBadge status={c.status} />
                  </div>
                  <ul className="grid grid-cols-1 gap-2 text-sm">
                    {c.items.slice(0, 3).map((item) => {
                      const b = item.balance;
                      const pct = b.total.isZero() ? 0 : b.drawn.div(b.total).times(100).toNumber();
                      return (
                        <li key={item.id} className="grid gap-1">
                          <span className="flex flex-wrap justify-between gap-2">
                            <span className="min-w-0 truncate">{item.description}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatNumber(b.drawn, 2)} / {formatNumber(b.total, 2)} {item.unit} · kalan {formatNumber(b.remaining, 2)}
                            </span>
                          </span>
                          <Meter value={pct} />
                          {b.byProject.length > 0 && (
                            <span className="truncate text-xs text-muted-foreground">
                              {b.byProject.map((p) => `${projectName[p.projectId] ?? "?"} ${formatNumber(p.allocated, 2)}`).join(" · ")}
                              {b.pool.gt(0) && ` · havuz ${formatNumber(b.pool, 2)}`}
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {c.items.length > 3 && <li className="text-xs text-muted-foreground">+{c.items.length - 3} kalem</li>}
                  </ul>
                  <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                    <span>
                      <span className="block text-muted-foreground">Bağlantı tutarı</span>
                      <span className="font-medium tabular-nums">{formatMoney(c.totals.contractTotal, c.currency)}</span>
                    </span>
                    <span>
                      <span className="block text-muted-foreground">Ödenen</span>
                      <span className="font-medium tabular-nums">{formatMoney(c.totals.paid, c.currency)}</span>
                    </span>
                    <span>
                      <span className="block text-muted-foreground">Avans bakiyesi</span>
                      <span className={cn("font-medium tabular-nums", c.totals.advance.isNegative() && "text-amber-700")}>
                        {formatMoney(c.totals.advance, c.currency)}
                      </span>
                    </span>
                  </div>
                  <AlertList alerts={c.alerts} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
