import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon, CalendarRangeIcon, DownloadIcon } from "lucide-react";
import { CashChart } from "@/components/cash-chart";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { monthKey, monthLabel } from "@/lib/cashflow/cashflow";
import { formatMoney, formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { getCashFlow } from "@/server/cashflow";
import { CashSettingsCard } from "./cash-panels";
import { CashTable } from "./cash-table";

export const metadata: Metadata = { title: "Nakit akışı" };

export default async function CashFlowPage({ params }: PageProps<"/projects/[projectId]/cash-flow">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "cashflow.view")) return <NoAccess text="Bu projenin nakit akışını görme yetkiniz yok." />;
  const data = await getCashFlow(projectId);
  const { flow, outcome, cal, settings } = data;
  const s = (v: { toString(): string } | null) => (v == null ? null : v.toString());

  return (
    <>
      <PageHeader
        title="Nakit akışı"
        description="Aylık nakit girişi ve çıkışı (KDV dahil). Geçmiş aylar gerçekleşen ödeme ve tahsilat; bundan sonrası vadesi gelen ödemeler, taksitler, iş programına yayılan kalan maliyet ve satış varsayımı."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/cash-flow/schedule`}>
                <CalendarRangeIcon />
                İş programı
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/projects/${projectId}/cash-flow/export`}>
                <DownloadIcon />
                Excel
              </a>
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        {data.warnings.length > 0 && (
          <ul className="grid grid-cols-1 gap-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {data.warnings.map((w) => (
              <li key={w} className="flex items-start gap-1.5">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        )}
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="Toplam giriş" value={formatMoney(flow.totalIn)} note={`${monthLabel(flow.firstMonth)} – ${monthLabel(flow.lastMonth)}`} />
            <Figure label="Toplam çıkış" value={formatMoney(flow.totalOut)} />
            <Figure
              label="En yüksek nakit ihtiyacı"
              value={formatMoney(outcome.peakNeed)}
              tone={outcome.peakNeed.gt(0) ? "warn" : undefined}
              note={outcome.peakNeed.gt(0) ? `${monthLabel(outcome.peakMonth)} (başlangıç nakdi dahil)` : "Bakiye hiç eksiye düşmüyor"}
            />
            <Figure label="Finansman maliyeti" value={formatMoney(flow.financingCost)} note={settings.monthlyInterestPercent.gt(0) ? `Aylık %${formatNumber(settings.monthlyInterestPercent, 3)}` : "Oran girilmedi"} />
            <Figure label="Dönem sonu bakiye" value={formatMoney(flow.endBalance)} tone={flow.endBalance.isNegative() ? "danger" : undefined} />
            <Figure label="Beklenen kâr (KDV hariç)" value={formatMoney(outcome.profit)} tone={outcome.profit.isNegative() ? "danger" : undefined} note={outcome.marginPercent ? `%${formatNumber(outcome.marginPercent, 2)} marj · finansman dahil` : undefined} />
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent>
            <CashChart
              currentKey={monthKey(cal.currentMonth)}
              rows={flow.rows.map((r) => ({ key: monthKey(r.month), label: monthLabel(r.month), inflow: Number(r.inTotal), outflow: Number(r.outTotal), balance: Number(r.balance), past: r.past }))}
            />
            {flow.truncated && <p className="mt-2 text-xs text-muted-foreground">Tablo 180 ayla sınırlandı.</p>}
          </CardContent>
        </Card>
        <CashSettingsCard
          key={settings.updatedAt?.toISOString() ?? "new"}
          projectId={projectId}
          canEdit={data.canEdit}
          currentProjectMonth={Math.max(1, cal.currentMonth - cal.startMonth + 1)}
          unsoldCount={data.sales?.unsoldCount ?? 0}
          settings={{
            openingCash: settings.openingCash.toString(),
            costVatPercent: s(settings.costVatPercent),
            defaultVat: s(settings.defaultVat),
            monthlyInflationPercent: settings.monthlyInflationPercent.toString(),
            fxChangePercent: settings.fxChangePercent.toString(),
            monthlyInterestPercent: settings.monthlyInterestPercent.toString(),
            salesPerMonth: settings.salesPerMonth.toString(),
            salesStartMonth: settings.salesStartMonth,
            downPaymentPercent: settings.downPaymentPercent.toString(),
            installmentMonths: settings.installmentMonths,
          }}
        />
        <div>
          <h2 className="mb-2 font-medium">Aylık tablo</h2>
          <CashTable rows={flow.rows} />
          <p className="mt-2 text-xs text-muted-foreground">
            Planlanan maliyet = tahmini tamamlanma maliyeti (EAC) − gerçekleşen − bağlantıyla sabitlenmiş açık miktar; iş programındaki aylara eşit yayılır, KDV eklenir. Bağlantı ödemeleri projeye tahsis payı oranında; hakediş net ödemesi (kesintiler sonrası). Vadesi geçmiş ödenmemiş kalemler bu aya yazılır.
          </p>
        </div>
      </div>
    </>
  );
}
