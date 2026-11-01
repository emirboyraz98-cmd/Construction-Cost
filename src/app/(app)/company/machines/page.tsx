import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { CashChart } from "@/components/cash-chart";
import { MoreFigures } from "@/components/more-figures";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { monthLabel } from "@/lib/cashflow/cashflow";
import { formatMoney, formatNumber } from "@/lib/format";
import { MACHINE_STATUS_LABELS, MACHINE_UNIT_LABELS } from "@/lib/machines/labels";
import { cn } from "@/lib/utils";
import { ActionError } from "@/server/access";
import { listMachines } from "@/server/machines";

export const metadata: Metadata = { title: "Makineler" };

export default async function MachinesPage() {
  let data: Awaited<ReturnType<typeof listMachines>>;
  try {
    data = await listMachines();
  } catch (error) {
    if (error instanceof ActionError) return <NoAccess text={error.message} />;
    throw error;
  }
  const { fleet, machines } = data;
  const active = machines.filter((m) => m.status === "ACTIVE");
  const hours = active.filter((m) => m.usageUnit === "HOUR").reduce((s, m) => s + Number(m.thisMonthQty), 0);
  const days = active.filter((m) => m.usageUnit === "DAY").reduce((s, m) => s + Number(m.thisMonthQty), 0);

  return (
    <>
      <PageHeader
        title="Makineler"
        description="İş makinelerinin nakit giriş ve çıkışları, projelerde çalışması ve kümülatif nakit akışı."
        actions={
          data.canManage && (
            <Button asChild>
              <Link href="/company/machines/new">
                <PlusIcon />
                Makine ekle
              </Link>
            </Button>
          )
        }
      />
      {machines.length === 0 ? (
        <Card className="max-w-2xl">
          <CardContent className="grid gap-2 text-sm">
            <p className="font-medium">Henüz makine yok.</p>
            <p className="text-muted-foreground">
              1) “Makine ekle” ile makineyi tanımlayın (kod, ad, iç kullanım ücreti). 2) Makine sayfasında satın alma bedelini, kredi taksitlerini, yakıt ve bakım giderlerini “Hareket
              ekle” ile girin. 3) Makine bir projede çalıştıkça “Çalışma gir” ile puantaj yazın; bu, projeye maliyet olarak geçer. Kümülatif nakit akışı kendiliğinden çıkar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <Card className="py-4">
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Figure label="Aktif makine" value={String(active.length)} note={`${machines.length} kayıtlı`} />
              <Figure label="Filo net nakit" value={formatMoney(fleet.totals.net)} tone={fleet.totals.net.isNegative() ? "warn" : undefined} note="Kümülatif, giren − çıkan" />
              <Figure label="İç kullanım dahil" value={formatMoney(fleet.totals.netWithUsage)} tone={fleet.totals.netWithUsage.isNegative() ? "warn" : undefined} note="Projelerdeki çalışmanın değeri eklenmiş" />
              <Figure label="Bu ay çalışma" value={[hours ? `${formatNumber(hours)} saat` : null, days ? `${formatNumber(days)} gün` : null].filter(Boolean).join(" + ") || "—"} />
              <MoreFigures>
                <Figure label="Nakit girişi" value={formatMoney(fleet.totals.cashIn)} />
                <Figure label="Nakit çıkışı" value={formatMoney(fleet.totals.cashOut)} />
                <Figure label="Planlı çıkış" value={formatMoney(fleet.totals.plannedOut)} />
                <Figure label="İç kullanım değeri" value={formatMoney(fleet.totals.usageValue)} />
              </MoreFigures>
            </CardContent>
          </Card>

          {fleet.rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle info="Kümülatif nakit akışı">Filo kümülatif nakit akışı</CardTitle>
                <CardDescription>Tüm makineler toplamı. Kesikli çizgi iç kullanım değerini de içerir.</CardDescription>
              </CardHeader>
              <CardContent>
                <CashChart
                  currentKey={String(data.currentMonth)}
                  labels={{ inflow: "Nakit girişi", outflow: "Nakit çıkışı", balance: "Kümülatif nakit", balance2: "İç kullanım dahil" }}
                  rows={fleet.rows.map((r) => ({ key: String(r.month), label: monthLabel(r.month), inflow: Number(r.cashIn), outflow: Number(r.cashOut), balance: Number(r.cumulative), balance2: Number(r.cumulativeWithUsage), past: r.past }))}
                />
              </CardContent>
            </Card>
          )}

          <Card className="gap-0 overflow-x-auto py-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Makine</th>
                  <th className="px-2 py-2 font-medium">Durum</th>
                  <th className="px-2 py-2 text-right font-medium">Bu ay</th>
                  <th className="px-2 py-2 text-right font-medium">Nakit çıkışı</th>
                  <th className="px-2 py-2 text-right font-medium">Nakit girişi</th>
                  <th className="px-2 py-2 text-right font-medium">Net nakit</th>
                  <th className="px-2 py-2 text-right font-medium">İç kullanım dahil</th>
                  <th className="px-4 py-2 text-right font-medium">İşletme maliyeti / birim</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => {
                  const unit = MACHINE_UNIT_LABELS[m.usageUnit];
                  const t = m.flow.totals;
                  return (
                    <tr key={m.id} className={cn("border-b", m.status !== "ACTIVE" && "text-muted-foreground")}>
                      <td className="px-4 py-2">
                        <Link href={`/company/machines/${m.id}`} className="font-medium hover:underline">
                          {m.code} · {m.name}
                        </Link>
                        {m.category && <span className="block text-xs text-muted-foreground">{m.category}</span>}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant={m.status === "ACTIVE" ? "outline" : "secondary"}>{MACHINE_STATUS_LABELS[m.status]}</Badge>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{m.thisMonthQty.isZero() ? "—" : `${formatNumber(m.thisMonthQty)} ${unit}`}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(t.cashOut)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(t.cashIn)}</td>
                      <td className={cn("px-2 py-2 text-right font-medium tabular-nums", t.net.isNegative() && "text-destructive")}>{formatMoney(t.net)}</td>
                      <td className={cn("px-2 py-2 text-right tabular-nums", t.netWithUsage.isNegative() && "text-destructive")}>{formatMoney(t.netWithUsage)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{t.operatingCostPerUnit ? `${formatMoney(t.operatingCostPerUnit)} / ${unit}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
