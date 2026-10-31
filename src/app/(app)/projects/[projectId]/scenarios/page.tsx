import type { Metadata } from "next";
import { AlertTriangleIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { monthLabel, type Outcome } from "@/lib/cashflow/cashflow";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { getScenarios } from "@/server/cashflow";
import { NewScenarioButton, ScenarioActions, type ScenarioView } from "./scenario-panels";

export const metadata: Metadata = { title: "Senaryolar" };

function Delta({ value, base, invert = false }: { value: { minus(x: unknown): { isZero(): boolean; isNegative(): boolean; toString(): string } }; base: unknown; invert?: boolean }) {
  const d = value.minus(base);
  if (d.isZero()) return null;
  const good = invert ? d.isNegative() : !d.isNegative();
  return (
    <span className={cn("block text-[11px]", good ? "text-emerald-700" : "text-destructive")}>
      {d.isNegative() ? "" : "+"}
      {formatMoney(d.toString())}
    </span>
  );
}

function Row({ label, sub, o, base, actions }: { label: string; sub?: string; o: Outcome; base: Outcome | null; actions?: React.ReactNode }) {
  return (
    <tr className="border-b [&>td:not(:first-child)]:whitespace-nowrap">
      <td className="px-4 py-2">
        <span className="flex items-center justify-between gap-2 font-medium">
          {label}
          {actions}
        </span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {formatMoney(o.cost)}
        {base && <Delta value={o.cost} base={base.cost} invert />}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {formatMoney(o.revenue)}
        {base && <Delta value={o.revenue} base={base.revenue} />}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {formatMoney(o.financingCost)}
        {base && <Delta value={o.financingCost} base={base.financingCost} invert />}
      </td>
      <td className={cn("px-2 py-2 text-right font-medium tabular-nums", o.profit.isNegative() && "text-destructive")}>
        {formatMoney(o.profit)}
        {base && <Delta value={o.profit} base={base.profit} />}
        {o.marginPercent && <span className="block text-[11px] font-normal text-muted-foreground">%{formatNumber(o.marginPercent, 2)} marj</span>}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {o.requiredM2 ? formatMoney(o.requiredM2) : "—"}
        {base?.requiredM2 && o.requiredM2 && <Delta value={o.requiredM2} base={base.requiredM2} invert />}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {formatMoney(o.peakNeed)}
        {o.peakNeed.gt(0) && <span className="block text-[11px] text-muted-foreground">{monthLabel(o.peakMonth)}</span>}
      </td>
    </tr>
  );
}

function describe(s: ScenarioView) {
  return [
    ...s.adjustments.map((a) => `${a.costItemCode} ${Number(a.changePercent) > 0 ? "+" : ""}%${formatNumber(a.changePercent, 2)}`),
    s.fxChangePercent != null && `kur %${formatNumber(s.fxChangePercent, 2)}`,
    s.monthlyInflationPercent != null && `aylık artış %${formatNumber(s.monthlyInflationPercent, 3)}`,
    s.monthlyInterestPercent != null && `finansman %${formatNumber(s.monthlyInterestPercent, 3)}`,
    s.delayMonths > 0 && `${s.delayMonths} ay gecikme`,
    Number(s.salesPriceChangePercent) !== 0 && `satış fiyatı %${formatNumber(s.salesPriceChangePercent, 2)}`,
    Number(s.salesSpeedPercent) !== 100 && `satış hızı %${formatNumber(s.salesSpeedPercent, 2)}`,
    s.landownerSharePercent != null && `arsa payı %${formatNumber(s.landownerSharePercent, 2)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function ScenariosPage({ params }: PageProps<"/projects/[projectId]/scenarios">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "cashflow.view")) return <NoAccess text="Bu projenin senaryolarını görme yetkiniz yok." />;
  const data = await getScenarios(projectId);
  const maxImpact = Math.max(1, ...data.tornado.map((t) => Number(t.impact)));
  const views: ScenarioView[] = data.scenarios.map(({ scenario: s }) => ({
    id: s.id,
    name: s.name,
    note: s.note,
    monthlyInflationPercent: s.monthlyInflationPercent?.toString() ?? null,
    fxChangePercent: s.fxChangePercent?.toString() ?? null,
    monthlyInterestPercent: s.monthlyInterestPercent?.toString() ?? null,
    delayMonths: s.delayMonths,
    salesPriceChangePercent: s.salesPriceChangePercent.toString(),
    salesSpeedPercent: s.salesSpeedPercent.toString(),
    landownerSharePercent: s.landownerSharePercent?.toString() ?? null,
    adjustments: s.adjustments.map((a) => ({ costItemCode: a.costItemCode, changePercent: a.changePercent.toString() })),
  }));
  const a = data.assumptions;

  return (
    <>
      <PageHeader
        title="Senaryolar"
        description="Varsayımlar değişince maliyet, gelir, finansman, kâr, hedef kâr için gereken m² fiyatı ve en yüksek nakit ihtiyacı (PLAN 7.9). Tutarlar KDV hariç; nakit ihtiyacı KDV dahil nakit akışından."
        actions={data.canManage ? <NewScenarioButton projectId={projectId} /> : undefined}
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
        <Card className="gap-0 overflow-x-auto py-0">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Senaryo</th>
                <th className="px-2 py-2 text-right font-medium">Maliyet</th>
                <th className="px-2 py-2 text-right font-medium">Gelir</th>
                <th className="px-2 py-2 text-right font-medium">Finansman</th>
                <th className="px-2 py-2 text-right font-medium">Kâr</th>
                <th className="px-2 py-2 text-right font-medium">Gereken baz m²</th>
                <th className="px-4 py-2 text-right font-medium">En yüksek nakit ihtiyacı</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="Baz"
                sub={`Aylık artış %${formatNumber(a.inflationPercent, 3)} · kur %${formatNumber(a.fxPercent, 2)} · finansman %${formatNumber(a.interestPercent, 3)} · Nakit akışı ekranındaki varsayımlar`}
                o={data.base}
                base={null}
              />
              <tr>
                <td colSpan={7} className="bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                  Duyarlılık (PLAN 7.9 örnekleri, baza göre)
                </td>
              </tr>
              {data.sensitivities.map((x) => (
                <Row
                  key={x.key}
                  label={x.label}
                  sub={x.outcome.profit.eq(data.base.profit) && x.outcome.peakNeed.eq(data.base.peakNeed) ? "Bu projede sonuca etkisi yok (ilgili kalem / dövizli tutar yok ya da değer mevcut durumla aynı)." : undefined}
                  o={x.outcome}
                  base={data.base}
                />
              ))}
              <tr>
                <td colSpan={7} className="bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                  Kayıtlı senaryolar
                </td>
              </tr>
              {data.scenarios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-sm text-muted-foreground">
                    Henüz senaryo yok. “Yeni senaryo” ile iyimser / kötümser varsayımları kaydedin; kopyalayarak çeşitleyin.
                  </td>
                </tr>
              ) : (
                data.scenarios.map(({ scenario: s, outcome }, i) => (
                  <Row key={s.id} label={s.name} sub={[describe(views[i]), s.note].filter(Boolean).join(" · ") || "Baz ile aynı"} o={outcome} base={data.base} actions={data.canManage ? <ScenarioActions projectId={projectId} scenario={views[i]} /> : undefined} />
                ))
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kâra en çok etki eden kalemler</CardTitle>
            <CardDescription>Kalan maliyetin ±%10 değişmesi (ve satılmamış bölümlerin fiyatının ±%10 değişmesi) kârı ne kadar oynatır. Sol: kârı azaltan yön, sağ: artıran yön.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.tornado.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kalan maliyet veya satış varsayımı yok.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 text-sm">
                {data.tornado.map((t) => {
                  const w = `${(Number(t.impact) / maxImpact) * 100}%`;
                  return (
                    <li key={t.key} className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[minmax(0,14rem)_1fr]">
                      <span className="min-w-0 truncate" title={t.label}>
                        {t.label}
                        <span className="ml-1 text-xs text-muted-foreground">{t.kind === "cost" ? "maliyet ±%10" : "fiyat ±%10"}</span>
                      </span>
                      <span className="grid grid-cols-2 items-center gap-0.5" title={`±${formatMoney(t.impact)}`}>
                        <span className="flex justify-end">
                          <span className="h-3 rounded-l bg-[#e34948]" style={{ width: w }} aria-hidden />
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-3 rounded-r bg-[#2a78d6]" style={{ width: w }} aria-hidden />
                          <span className="text-xs whitespace-nowrap tabular-nums">±{formatMoney(t.impact)}</span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
