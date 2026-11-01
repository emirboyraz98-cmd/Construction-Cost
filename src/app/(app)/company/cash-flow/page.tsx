import type { Metadata } from "next";
import Link from "next/link";
import { CashChart } from "@/components/cash-chart";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { monthKey, monthLabel } from "@/lib/cashflow/cashflow";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { getCompanyCashFlow } from "@/server/cashflow";
import { CashTable } from "../../projects/[projectId]/cash-flow/cash-table";
import { CompanyCashForm } from "./company-cash-form";

export const metadata: Metadata = { title: "Konsolide nakit" };

export default async function CompanyCashPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "companyCash.view")) return <NoAccess text="Şirket geneli nakit akışını görme yetkiniz yok." />;
  const data = await getCompanyCashFlow();
  const totalIn = data.rows.reduce((s, r) => s.plus(r.inTotal), data.settings.openingCash.mul(0));
  const totalOut = data.rows.reduce((s, r) => s.plus(r.outTotal), data.settings.openingCash.mul(0));
  const end = data.rows.at(-1)?.balance ?? data.settings.openingCash;
  return (
    <>
      <PageHeader title="Konsolide nakit akışı" description="Tüm projelerin nakit akışı ve genel merkez giderleri, ay ay (KDV dahil)." />
      <div className="grid grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Figure label="Toplam giriş" value={formatMoney(totalIn)} />
            <Figure label="Toplam çıkış" value={formatMoney(totalOut)} />
            <Figure
              label="En düşük bakiye"
              value={data.lowest ? formatMoney(data.lowest.balance) : "—"}
              tone={data.lowest?.balance.isNegative() ? "danger" : undefined}
              note={data.lowest ? monthLabel(data.lowest.month) : undefined}
            />
            <Figure label="Dönem sonu bakiye" value={formatMoney(end)} tone={end.isNegative() ? "danger" : undefined} />
            <Figure label="Atanmamış bağlantı ödemeleri" value={formatMoney(data.unassignedTotal)} note="Ödenmemiş, şirket geneli havuz payı" />
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent>
            <CashChart currentKey={monthKey(data.currentMonth)} rows={data.rows.map((r) => ({ key: monthKey(r.month), label: monthLabel(r.month), inflow: Number(r.inTotal), outflow: Number(r.outTotal), balance: Number(r.balance), past: r.past }))} />
          </CardContent>
        </Card>
        {data.canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Şirket varsayımları</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyCashForm openingCash={data.settings.openingCash.toString()} monthlyOverhead={data.settings.monthlyOverhead.toString()} />
            </CardContent>
          </Card>
        )}
        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Projeler</CardTitle>
            <CardDescription>{data.hiddenProjects > 0 ? `Yetkiniz olmayan ${data.hiddenProjects} proje toplama katılmadı.` : "Her proje kendi nakit akışı varsayımlarıyla."}</CardDescription>
          </CardHeader>
          <ul className="grid grid-cols-1 divide-y text-sm">
            {data.projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <Link href={`/projects/${p.id}/cash-flow`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <span className="flex flex-wrap gap-4 text-xs tabular-nums">
                  <span>Giriş {formatMoney(p.flow.totalIn)}</span>
                  <span>Çıkış {formatMoney(p.flow.totalOut)}</span>
                  <span className={cn(p.outcome.peakNeed.gt(0) && "text-amber-800")}>En yüksek ihtiyaç {formatMoney(p.outcome.peakNeed)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <div>
          <h2 className="mb-2 font-medium">Aylık tablo</h2>
          <CashTable rows={data.rows} showOverhead />
        </div>
      </div>
    </>
  );
}
