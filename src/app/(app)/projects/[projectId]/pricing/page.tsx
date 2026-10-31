import type { Metadata } from "next";
import { AlertTriangleIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { FLOOR_LABEL, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { formatDateOnly, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { COST_BASIS_LABELS, PROFIT_METHOD_LABELS } from "@/lib/pricing/labels";
import { getAccess } from "@/server/access";
import { getPricing, USAGE_ORDER } from "@/server/pricing";
import { ApproveButton, FactorTables, PriceTable, SettingsCard, type PriceRowView } from "./pricing-panels";

export const metadata: Metadata = { title: "Fiyatlandırma" };

const s = (v: { toString(): string } | null | undefined) => (v == null ? null : v.toString());

function ExportButtons({ projectId, draft }: { projectId: string; draft: boolean }) {
  const q = draft ? "?taslak=1" : "";
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href={`/api/projects/${projectId}/pricing/export${q}`}>
          <DownloadIcon />
          Excel
        </a>
      </Button>
      <Button asChild variant="outline">
        <a href={`/print/projects/${projectId}/price-list${q}`} target="_blank" rel="noopener">
          <PrinterIcon />
          PDF / yazdır
        </a>
      </Button>
    </div>
  );
}

export default async function PricingPage({ params }: PageProps<"/projects/[projectId]/pricing">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "priceList.view")) return <NoAccess text="Bu projenin fiyat listesini görme yetkiniz yok." />;
  const data = await getPricing(projectId);

  if (data.mode === "list") {
    const contractor = data.rows.filter((r) => r.unit.owner === "CONTRACTOR");
    return (
      <>
        <PageHeader
          title="Fiyat listesi"
          description={data.list ? `${data.list.name} · onay ${formatDateOnly(data.list.approvedAt)}. Fiyatlar KDV hariç ve dahil gösterilir.` : "Henüz onaylı fiyat listesi yok."}
          actions={data.list ? <ExportButtons projectId={projectId} draft={false} /> : undefined}
        />
        <Card className="gap-0 overflow-x-auto py-0">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Bölüm</TableHead>
                <TableHead className="text-right">Net / brüt m²</TableHead>
                <TableHead className="text-right">Fiyat (KDV hariç)</TableHead>
                <TableHead className="text-right">KDV</TableHead>
                <TableHead className="text-right">KDV dahil</TableHead>
                <TableHead className="pr-4 text-right">m² fiyatı</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractor.map((r) => (
                <TableRow key={r.unit.id}>
                  <TableCell className="pl-4">
                    {r.unit.block.name} · No {r.unit.doorNo}
                    <span className="block text-xs text-muted-foreground">{[FLOOR_LABEL(r.unit.floor), USAGE_TYPE_LABELS[r.unit.usageType], r.unit.layout, r.unit.facade && `Cephe ${r.unit.facade}`, r.unit.view].filter(Boolean).join(" · ")}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(r.unit.netArea, 2)} / {formatNumber(r.unit.grossArea, 2)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{r.price ? formatMoney(r.price) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.vatRate ? `%${formatNumber(r.vatRate, 2)}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.priceWithVat ? formatMoney(r.priceWithVat) : "—"}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{r.perM2 ? formatMoney(r.perM2) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </>
    );
  }

  const { base, priced, costs, settings, profit } = data;
  const latest = data.lists[0] ?? null;
  const rows: PriceRowView[] = data.rows.map((r) => ({
    id: r.unit.id,
    block: r.unit.block.name,
    floorLabel: FLOOR_LABEL(r.unit.floor),
    doorNo: r.unit.doorNo,
    usage: USAGE_TYPE_LABELS[r.unit.usageType],
    layout: r.unit.layout,
    facade: r.unit.facade,
    view: r.unit.view,
    netArea: r.unit.netArea.toString(),
    grossArea: r.unit.grossArea.toString(),
    owner: r.unit.owner,
    landowner: r.unit.landowner?.name ?? null,
    baseM2: s(r.priced?.baseM2),
    coefficient: s(r.priced?.coefficient),
    rawPrice: s(r.priced?.rawPrice),
    price: s(r.price),
    perM2: s(r.perM2),
    vatRate: s(r.vatRate),
    vatOverride: s(r.unit.vatRateOverride),
    priceWithVat: s(r.priceWithVat),
    current: s(r.current),
    change: s(r.change),
    locked: r.priced?.locked ?? r.unit.priceLocked,
    sold: r.sold,
  }));

  return (
    <>
      <PageHeader
        title="Fiyatlandırma"
        description="Maliyet + reklam payı → kâr yöntemi ve komisyonla baz m² fiyatı → kullanım tipi oranı ve katsayılarla bölüm fiyatı → toplam hedef gelire normalizasyon (PLAN 7.4–7.6). Fiyatlar KDV hariçtir; KDV ayrıca gösterilir."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportButtons projectId={projectId} draft />
            {data.canApprove && base.ok && priced && <ApproveButton projectId={projectId} today={formatDateOnly(new Date())} total={priced.total.toString()} requiredChange={s(data.requiredChange)} />}
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
            <Figure label={`Maliyet (${COST_BASIS_LABELS[settings.costBasis]})`} value={formatMoney(costs.cost)} note="Reklam ve komisyon hariç, tüm bina" />
            <Figure label="Sabit reklam bütçesi" value={formatMoney(costs.advertising)} note={settings.advertisingBudget ? "Elle girildi" : "Bütçenin 14 grubundan"} />
            <Figure label="Müteahhide kalan brüt m²" value={formatNumber(costs.metrics.contractorGross, 2)} note={`Toplam satılabilir ${formatNumber(costs.metrics.sellableGross, 2)} m²`} />
            {base.ok ? (
              <>
                <Figure label="m² maliyeti + reklam payı" value={formatMoney(base.fullCostPerM2)} note={`${formatMoney(base.costPerM2)} + ${formatMoney(base.advertisingPerM2)}`} />
                <Figure label="Başabaş m² fiyatı" value={formatMoney(base.breakEvenM2)} note="Kâr = 0, komisyon dahil" />
                <Figure
                  label="Baz m² satış fiyatı"
                  value={formatMoney(base.baseM2)}
                  note={`${PROFIT_METHOD_LABELS[settings.profitMethod]} %${formatNumber(settings.profitPercent, 2)} · komisyon %${formatNumber(settings.commissionPercent, 2)}`}
                />
                <Figure label="Hedef gelir" value={formatMoney(base.targetRevenue)} note="Müteahhit bölümleri, KDV hariç" />
                <Figure label="Karşılık" value={`%${formatNumber(base.marginPercent, 2)} marj`} note={`= maliyet üzerine %${formatNumber(base.markupPercent, 2)}`} />
              </>
            ) : (
              <Figure label="Baz m² satış fiyatı" value="—" note={base.error} tone="danger" />
            )}
            {priced && profit && (
              <>
                <Figure label="Liste toplamı" value={formatMoney(priced.total)} note={priced.roundingDifference.isZero() ? "Hedefe eşit" : `Yuvarlama farkı ${formatMoney(priced.roundingDifference)}`} />
                <Figure label="Komisyon" value={formatMoney(profit.commission)} />
                <Figure label="Beklenen kâr" value={formatMoney(profit.profit)} tone={profit.profit.isNegative() ? "danger" : undefined} note={profit.marginPercent ? `%${formatNumber(profit.marginPercent, 2)} marj` : undefined} />
                <Figure
                  label="Kilitli bölümler"
                  value={formatMoney(priced.lockedTotal)}
                  note={data.requiredChange ? `Kalanlarda onaylı listeye göre ${Number(data.requiredChange) > 0 ? "+" : ""}%${formatNumber(data.requiredChange, 2)}` : priced.normalization ? `Normalizasyon × ${formatNumber(priced.normalization, 4)}` : undefined}
                />
              </>
            )}
          </CardContent>
        </Card>

        {priced && priced.baseByUsage.size > 1 && (
          <Card className="py-4">
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {USAGE_ORDER.filter((u) => priced.baseByUsage.has(u)).map((u) => (
                <Figure key={u} label={`Baz m² – ${USAGE_TYPE_LABELS[u]}`} value={formatMoney(priced.baseByUsage.get(u)!)} />
              ))}
            </CardContent>
          </Card>
        )}

        <SettingsCard
          key={data.settings.updatedAt?.toISOString() ?? "new"}
          projectId={projectId}
          canEdit={data.canEdit}
          advertisingFromBudget={costs.advertisingFromBudget.toString()}
          settings={{
            profitMethod: settings.profitMethod,
            profitPercent: settings.profitPercent.toString(),
            commissionPercent: settings.commissionPercent.toString(),
            advertisingBudget: s(settings.advertisingBudget),
            costBasis: settings.costBasis,
            manualCost: s(settings.manualCost),
            roundingStep: settings.roundingStep.toString(),
            extraAreaFactor: settings.extraAreaFactor.toString(),
            reducedVatEligible: settings.reducedVatEligible,
          }}
        />

        <FactorTables projectId={projectId} canEdit={data.canEdit} copySources={data.copySources} groups={data.factorOptions.map((g) => ({ kind: g.kind, entries: g.entries.map((e) => ({ key: e.key, value: e.value, count: e.count })) }))} />

        <PriceTable projectId={projectId} rows={rows} canEdit={data.canEdit} canApprove={data.canApprove} hasList={latest !== null} />

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Onaylanan fiyat listeleri</CardTitle>
            <CardDescription>Her onay o günkü maliyet, oran ve fiyatlarla saklanır. Satış ekibi en son onaylanan listeyi görür.</CardDescription>
          </CardHeader>
          {data.lists.length === 0 ? (
            <CardContent className="pb-6 text-sm text-muted-foreground">Henüz onaylanmış liste yok.</CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Liste</TableHead>
                  <TableHead className="text-right">Maliyet + reklam</TableHead>
                  <TableHead className="text-right">Kâr</TableHead>
                  <TableHead className="text-right">Baz m²</TableHead>
                  <TableHead className="pr-4 text-right">Toplam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lists.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-4">
                      {l.name}
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(l.approvedAt)}
                        {l.approvedBy ? ` · ${l.approvedBy.name}` : ""}
                        {l.note ? ` · ${l.note}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.cost.plus(l.advertising))}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      %{formatNumber(l.profitPercent, 2)} <span className="text-xs text-muted-foreground">{l.profitMethod === "MARGIN" ? "marj" : "ekleme"}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.baseM2)}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatMoney(l.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
