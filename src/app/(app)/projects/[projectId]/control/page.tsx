import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { PRICE_SOURCE_LABELS } from "@/lib/budget/labels";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { getBudgetControl } from "@/server/control";
import { BaselineControls, ControlTable } from "./control-panels";

export const metadata: Metadata = { title: "Bütçe kontrolü" };

const COVERAGE_TONE = { missing: "text-destructive", short: "text-amber-800", excess: "text-amber-800", ok: "text-emerald-700", unbudgeted: "text-muted-foreground" } as const;

export default async function ControlPage({ params, searchParams }: PageProps<"/projects/[projectId]/control">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "budget.view")) return <NoAccess text="Bu projenin bütçesini görme yetkiniz yok." />;
  const sp = await searchParams;
  const data = await getBudgetControl(projectId, typeof sp.baz === "string" ? sp.baz : null);
  const t = data.totals;
  const variance = t.variance;

  return (
    <>
      <PageHeader
        title="Bütçe kontrolü"
        description="Bütçe ile harcananın karşılaştırması ve iş bitince toplam maliyetin ne olacağı tahmini (KDV hariç)."
        actions={
          <Button asChild variant="outline">
            <a href={`/api/projects/${projectId}/control/export${data.baseline ? `?baz=${data.baseline.id}` : ""}`}>
              <DownloadIcon />
              Excel&apos;e aktar
            </a>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        <BaselineControls
          projectId={projectId}
          canEdit={data.canEdit}
          today={formatDateOnly(new Date())}
          selectedId={data.baseline?.id ?? null}
          baselines={data.baselines.map((b) => ({ id: b.id, name: b.name, createdAt: b.createdAt.toISOString(), total: b.total.toString() }))}
        />
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            <Figure label={t.hasBaseline ? "Baz bütçe" : "Referans (güncel bütçe)"} value={formatMoney(t.reference)} note={t.hasBaseline ? data.baseline?.name : "Baz bütçe dondurulmamış"} />
            <Figure label="Güncel bütçe" value={formatMoney(t.budget)} note="Canlı fiyat ve metrajla" />
            <Figure label="Gerçekleşen" value={formatMoney(t.actual)} />
            <Figure label="Tamamlanma" value={t.progress ? `%${formatNumber(t.progress, 1)}` : "—"} note="Yapılan işin bütçedeki payı" />
            <Figure label="Tahmini toplam maliyet (EAC)" value={formatMoney(t.eac)} />
            <Figure
              label="Sapma (bütçe − tahmini)"
              value={formatMoney(variance)}
              tone={variance.isNegative() ? "danger" : undefined}
              note={variance.isNegative() ? "Aşım bekleniyor" : "Bütçe içinde"}
            />
            <Figure
              label="Müteahhit m² maliyeti"
              value={data.m2.eacContractor ? formatMoney(data.m2.eacContractor) : "—"}
              note={data.m2.referenceContractor ? `Tahmini maliyetle; bütçede ${formatMoney(data.m2.referenceContractor)}` : "Bağımsız bölüm girilmemiş"}
              tone={data.m2.eacContractor && data.m2.referenceContractor && data.m2.eacContractor.gt(data.m2.referenceContractor) ? "warn" : undefined}
            />
          </CardContent>
        </Card>

        <ControlTable
          projectId={projectId}
          canEdit={data.canEdit}
          hasBaseline={t.hasBaseline}
          rows={data.rows
            .filter((r) => r.hasData)
            .map((r) => ({
              id: r.id,
              code: r.code,
              name: r.name,
              depth: r.depth,
              isLeaf: r.isLeaf,
              unit: r.unit,
              baseline: r.baseline?.toString() ?? null,
              budget: r.budget.toString(),
              budgetQuantity: r.budgetQuantity?.toString() ?? null,
              actual: r.actual.toString(),
              actualQuantity: r.actualQuantity?.toString() ?? null,
              percent: r.control.percent?.toString() ?? null,
              percentSource: r.control.percentSource,
              manualPercent: r.manualPercent?.toString() ?? null,
              progressNote: r.progressNote,
              eac: r.control.eac.toString(),
              variance: r.control.variance.toString(),
              status: r.control.status,
            }))}
        />

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Bağlantı kapsaması</CardTitle>
            <CardDescription>Bütçedeki ihtiyaç miktarı ↔ bu projeye tahsis edilen bağlantı miktarı (aynı kalem kodu ve birim). %100 altı eksik, %110 üstü fazla bağlantı.</CardDescription>
          </CardHeader>
          {data.coverage.length === 0 ? (
            <CardContent className="pb-6 text-sm text-muted-foreground">Kaba ve ince işlerde birimli bütçe satırı veya bağlantı yok.</CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Kalem</TableHead>
                  <TableHead className="text-right">İhtiyaç</TableHead>
                  <TableHead className="text-right">Bağlantılı</TableHead>
                  <TableHead className="text-right">Çekilen</TableHead>
                  <TableHead className="pr-4 text-right">Kapsama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.coverage.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="pl-4">
                      {c.message.split(":")[0]}
                      <span className={cn("block text-xs", COVERAGE_TONE[c.status])}>{c.message.split(": ").slice(1).join(": ")}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.need, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.covered, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.drawn, 2)}</TableCell>
                    <TableCell className={cn("pr-4 text-right tabular-nums", COVERAGE_TONE[c.status])}>{c.percent ? `%${formatNumber(c.percent, 1)}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Bağlantı kazancı</CardTitle>
            <CardDescription>
              (Güncel fiyat − bağlantı fiyatı) × projeye tahsis edilen miktar. Güncel fiyat kütüphaneden: son alım (fatura) → teklif → piyasa. Bağlantı kalemine kütüphane malzemesi seçilmiş olmalı.
            </CardDescription>
          </CardHeader>
          {data.gains.length === 0 ? (
            <CardContent className="pb-6 text-sm text-muted-foreground">Kütüphane malzemesine bağlı bağlantı tahsisi yok.</CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Bağlantı / malzeme</TableHead>
                  <TableHead className="text-right">Miktar</TableHead>
                  <TableHead className="text-right">Bağlantı fiyatı</TableHead>
                  <TableHead className="text-right">Güncel fiyat</TableHead>
                  <TableHead className="pr-4 text-right">Kazanç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.gains.map((g) => (
                  <TableRow key={g.itemId}>
                    <TableCell className="pl-4">
                      <Link href={`/company/connections/${g.connectionId}`} className="hover:underline">
                        {g.connectionNo} · {g.description}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{g.supplier}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(g.quantity, 2)} {g.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{g.connectionPriceTry ? formatMoney(g.connectionPriceTry) : "kur yok"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.marketPriceTry ? formatMoney(g.marketPriceTry) : "—"}
                      {g.marketSource && <span className="block text-xs text-muted-foreground">{PRICE_SOURCE_LABELS[g.marketSource]} · {formatDateOnly(g.marketDate)}</span>}
                    </TableCell>
                    <TableCell className={cn("pr-4 text-right tabular-nums", g.gain?.isNegative() && "text-destructive")}>{g.gain ? formatMoney(g.gain) : "Güncel fiyat yok"}</TableCell>
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
