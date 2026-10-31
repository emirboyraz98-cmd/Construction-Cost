import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { FORMULA_VARIABLE_LABELS } from "@/lib/budget/metrics";
import { formatMoney, formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { getBudget, getQuantities } from "@/server/budget";
import { recipeOptions, resourceOptions } from "@/server/library";
import { BudgetEditor } from "./budget-editor";

export const metadata: Metadata = { title: "Bütçe" };

export default async function BudgetPage({ params }: PageProps<"/projects/[projectId]/budget">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "budget.view")) return <NoAccess text="Bu projenin bütçesini görme yetkiniz yok." />;
  const [budget, quantities, recipes, resources] = await Promise.all([getBudget(projectId), getQuantities(projectId), recipeOptions(), resourceOptions()]);
  const { metrics, summary, m2 } = budget;
  const parentIds = new Set(budget.items.map((i) => i.parentId).filter(Boolean));
  const blockName = new Map(budget.blocks.map((b) => [b.id, b.name]));

  return (
    <>
      <PageHeader
        title="Bütçe"
        description="Kalem kalem miktar × birim fiyat. Toplam maliyet tüm binayı kapsar; satılabilir m² maliyeti müteahhide kalan alana bölünür (PLAN 7.3)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/quantities`}>Metraj ve katsayılar</Link>
            </Button>
            {budget.canEdit && (
              <Button asChild variant="outline">
                <Link href={`/projects/${projectId}/budget/import`}>Excel&apos;den aktar</Link>
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="Toplam maliyet (KDV hariç)" value={formatMoney(summary.total)} />
            <Figure label="Yapım maliyeti (04–12)" value={formatMoney(summary.construction)} />
            <Figure label="İnşaat m² maliyeti" value={m2.construction ? formatMoney(m2.construction) : "—"} note={`Yapım / ${formatNumber(metrics.constructionArea)} m² inşaat`} />
            <Figure label="Toplam / inşaat m²" value={m2.totalPerConstruction ? formatMoney(m2.totalPerConstruction) : "—"} />
            <Figure
              label="Müteahhit satılabilir m² maliyeti"
              value={m2.contractorSellable ? formatMoney(m2.contractorSellable) : "—"}
              note={metrics.contractorGross.gt(0) ? `Toplam / ${formatNumber(metrics.contractorGross)} m² müteahhit brüt` : "Bağımsız bölüm girilmemiş"}
              tone={metrics.contractorGross.isZero() ? "warn" : undefined}
            />
            <Link href={`/projects/${projectId}/control`} className="min-w-0 hover:underline">
              <Figure label="Gerçekleşen (onaylı, KDV hariç)" value={formatMoney(budget.actualTotal)} note="Sapma ve EAC: Bütçe kontrolü →" />
            </Link>
          </CardContent>
        </Card>

        {budget.blocks.length > 1 && summary.total.gt(0) && (
          <Card className="gap-0 pb-0">
            <CardHeader className="pb-4">
              <CardTitle>Blok bazında maliyet</CardTitle>
              <CardDescription>Bloğa ait satırlar + ortak satırların inşaat alanı oranında payı.</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Blok</TableHead>
                  <TableHead className="text-right">Kendi</TableHead>
                  <TableHead className="text-right">Ortak payı</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                  <TableHead className="pr-4 text-right">m² maliyeti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byBlock.map((b) => {
                  const area = budget.blocks.find((x) => x.id === b.blockId)?.constructionArea;
                  return (
                    <TableRow key={b.blockId}>
                      <TableCell className="pl-4">{blockName.get(b.blockId)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(b.direct)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(b.common)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(b.total)}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{area && Number(area) > 0 ? formatMoney(b.total.div(area.toString()).toDecimalPlaces(2)) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        <BudgetEditor
          projectId={projectId}
          canEdit={budget.canEdit}
          items={budget.items.map((i) => ({
            id: i.id,
            code: i.code,
            name: i.name,
            unit: i.unit,
            active: i.active,
            isLeaf: !parentIds.has(i.id),
            budget: i.budget.toString(),
            actual: i.actual.toString(),
          }))}
          lines={budget.lines.map((l) => ({
            id: l.id,
            costItemId: l.costItemId,
            blockId: l.blockId,
            blockName: l.block?.name ?? null,
            description: l.description,
            supplyMethod: l.supplyMethod,
            quantitySource: l.quantitySource,
            quantity: l.quantityLive.toString(),
            storedQuantity: l.quantity.toString(),
            formula: l.formula,
            coefficientId: l.coefficientId,
            unit: l.unit,
            priceSource: l.priceSource,
            recipeId: l.recipeId,
            resourceId: l.resourceId,
            unitPrice: l.unitPrice?.toString() ?? null,
            currency: l.currency,
            unitPriceTry: l.unitPriceTry?.toString() ?? null,
            priceLabel: l.priceLabel,
            wastePercent: l.wastePercent.toString(),
            priceNote: l.priceNote,
            amount: l.amount.toString(),
            warnings: l.warnings,
          }))}
          options={{
            blocks: budget.blocks.map((b) => ({ id: b.id, name: b.name })),
            recipes,
            resources,
            coefficients: quantities.coefficients.map((c) => ({ id: c.id, name: c.name, costItemCode: c.costItemCode, basis: c.basis, coefficient: c.coefficient.toString(), unit: c.unit })),
            variables: Object.entries(quantities.variables).map(([name, value]) => ({ name, label: FORMULA_VARIABLE_LABELS[name] ?? name, value: value.toString() })),
          }}
        />
      </div>
    </>
  );
}
