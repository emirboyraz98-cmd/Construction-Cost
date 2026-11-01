import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { formatMoney, formatNumber } from "@/lib/format";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { getProjectComparison } from "@/server/cashflow";

export const metadata: Metadata = { title: "Projeler arası raporlar" };

export default async function ReportsPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "cashflow.view")) return <NoAccess text="Projeler arası raporları görme yetkiniz yok." />;
  const data = await getProjectComparison();
  return (
    <>
      <PageHeader title="Projeler arası karşılaştırma" description="Projelerin m² maliyeti, bütçe, gelir ve kârları yan yana (KDV hariç)." />
      <div className="grid grid-cols-1 gap-4">
        <Card className="gap-0 overflow-x-auto py-0">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Proje</th>
                <th className="px-2 py-2 text-right font-medium">İnşaat alanı</th>
                <th className="px-2 py-2 text-right font-medium">Bütçe</th>
                <th className="px-2 py-2 text-right font-medium">Tahmini toplam</th>
                <th className="px-2 py-2 text-right font-medium">İnşaat m² (tahmini)</th>
                <th className="px-2 py-2 text-right font-medium">Müteahhit m² (tahmini)</th>
                <th className="px-2 py-2 text-right font-medium">Gelir</th>
                <th className="px-2 py-2 text-right font-medium">Beklenen kâr</th>
                <th className="px-4 py-2 text-right font-medium">En yüksek nakit ihtiyacı</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.project.id} className="border-b">
                  <td className="px-4 py-2">
                    <Link href={`/projects/${r.project.id}`} className="font-medium hover:underline">
                      {r.project.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{PROJECT_STATUS_LABELS[r.project.status]}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatNumber(r.metrics.constructionArea, 0)} m²</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatMoney(r.budget)}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", r.eac.gt(r.budget) && "text-destructive")}>{formatMoney(r.eac)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.m2.eacConstruction ? formatMoney(r.m2.eacConstruction) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.m2.eacContractor ? formatMoney(r.m2.eacContractor) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatMoney(r.outcome.revenue)}
                    <span className="block text-[11px] text-muted-foreground">satılan {formatMoney(r.soldNet)}</span>
                  </td>
                  <td className={cn("px-2 py-2 text-right font-medium tabular-nums", r.outcome.profit.isNegative() && "text-destructive")}>
                    {formatMoney(r.outcome.profit)}
                    {r.outcome.marginPercent && <span className="block text-[11px] font-normal text-muted-foreground">%{formatNumber(r.outcome.marginPercent, 2)} marj</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMoney(r.peakNeed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted-foreground">
          Gelir = satılan bölümlerin satış fiyatı + nakit akışındaki satış varsayımıyla satılacak bölümler (satış hızı girilmemişse yalnızca satılanlar). Onaylı liste fiyatıyla tüm boş bölümler:{" "}
          {data.rows.map((r) => `${r.project.name} ${formatMoney(r.unsoldList)}`).join(" · ")}.
          {data.hiddenProjects > 0 && ` Yetkiniz olmayan ${data.hiddenProjects} proje gösterilmiyor.`}
        </p>
        <Card className="gap-0 overflow-x-auto pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Malzeme birim fiyatları</CardTitle>
            <CardDescription>Kütüphane malzemesine bağlı onaylı harcamaların ortalama birim fiyatı (TL, KDV hariç). En çok harcanan 15 malzeme.</CardDescription>
          </CardHeader>
          {data.prices.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Kütüphane malzemesine bağlı miktarlı harcama yok.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Malzeme</th>
                  {data.rows.map((r) => (
                    <th key={r.project.id} className="px-2 py-2 text-right font-medium">
                      {r.project.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.prices.map((p) => (
                  <tr key={p.resource.id} className="border-b">
                    <td className="px-4 py-2">
                      {p.resource.code} {p.resource.name}
                      <span className="block text-xs text-muted-foreground">/ {p.resource.unit}</span>
                    </td>
                    {data.rows.map((r) => {
                      const v = p.byProject.get(r.project.id);
                      return (
                        <td key={r.project.id} className="px-2 py-2 text-right tabular-nums">
                          {v ? formatMoney(v) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
