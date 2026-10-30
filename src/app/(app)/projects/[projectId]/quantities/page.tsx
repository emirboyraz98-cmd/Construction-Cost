import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Figure, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { FORMULA_VARIABLE_LABELS } from "@/lib/budget/metrics";
import { formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { getQuantities } from "@/server/budget";
import { CoefficientsPanel } from "./coefficients-panel";

export const metadata: Metadata = { title: "Metraj" };

export default async function QuantitiesPage({ params }: PageProps<"/projects/[projectId]/quantities">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "budget.view")) return <NoAccess text="Bu projenin metrajını görme yetkiniz yok." />;
  const data = await getQuantities(projectId);
  const m = data.metrics;
  return (
    <>
      <PageHeader
        title="Metraj"
        description="Üç seviye: parametrik (alan × katsayı), formül (proje değişkenleriyle) ve manuel. Seviye her bütçe satırında seçilir ve raporda görünür."
        actions={
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/budget`}>Bütçe</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="İnşaat alanı" value={`${formatNumber(m.constructionArea)} m²`} note="Blokların toplamı" />
            <Figure label="Satılabilir brüt" value={`${formatNumber(m.sellableGross)} m²`} note={`${m.unitCount} bağımsız bölüm`} />
            <Figure label="Satılabilir net" value={`${formatNumber(m.sellableNet)} m²`} />
            <Figure label="Müteahhide kalan brüt" value={`${formatNumber(m.contractorGross)} m²`} />
            <Figure label="Arsa sahiplerine" value={`${formatNumber(m.landownerGross)} m²`} />
            <Figure label="Arsa alanı" value={`${formatNumber(m.landArea)} m²`} />
          </CardContent>
        </Card>
        <Card className="gap-3 pb-0">
          <CardHeader>
            <CardTitle>Parametrik katsayılar</CardTitle>
            <CardDescription>
              Başlangıç değerleri PLAN 6&apos;daki aralıkların ortasıdır; projeye göre düzenleyin. Gerçekleşen katsayı = onaylı harcama / çekiş miktarı (aynı kalem ve birim) ÷ taban;
              sonraki projeler için kalibrasyonda kullanın.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <CoefficientsPanel
              projectId={projectId}
              canEdit={data.canEdit}
              coefficients={data.coefficients.map((c) => ({
                id: c.id,
                costItemCode: c.costItemCode,
                costItemName: c.costItem?.name ?? null,
                name: c.name,
                basis: c.basis,
                coefficient: c.coefficient.toString(),
                unit: c.unit,
                note: c.note,
                base: c.base.toString(),
                quantity: c.quantity.toString(),
                actualQuantity: c.actualQuantity.toString(),
                actualCoefficient: c.actualCoefficient?.toString() ?? null,
                inBudget: c.inBudget,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Formül değişkenleri</CardTitle>
            <CardDescription>Bütçe satırında “Formül” seçilince kullanılabilir; ör. <code>insaat_alani * 0,42</code> veya <code>(bolum_sayisi * 2 + 4) * 1,5</code>.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {Object.entries(data.variables).map(([name, value]) => (
                <div key={name} className="flex flex-wrap justify-between gap-2 border-b py-1">
                  <dt>
                    <code>{name}</code>
                    <span className="block text-xs text-muted-foreground">{FORMULA_VARIABLE_LABELS[name]}</span>
                  </dt>
                  <dd className="tabular-nums">{formatNumber(value, 2)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
