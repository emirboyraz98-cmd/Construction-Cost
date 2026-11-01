import type { Metadata } from "next";
import Link from "next/link";
import { PaymentBadge } from "@/components/expenses/badges";
import { PageHeader } from "@/components/page-header";
import { CheckList } from "@/components/purchasing/checks";
import { Figure } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LAND_MODEL_LABELS } from "@/lib/labels";
import { dateToDateInput, Decimal, formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { landPayments } from "@/server/land";
import { getUnitsOverview } from "@/server/units";
import { LandInstallmentForm } from "./land-payments";
import { LandownersManager } from "./landowners-manager";

export const metadata: Metadata = { title: "Arsa & sözleşme" };

export default async function LandPage({ params }: PageProps<"/projects/[projectId]/land">) {
  const { projectId } = await params;
  const [data, payments] = await Promise.all([getUnitsOverview(projectId), landPayments(projectId)]);
  const totalGross = data.units.reduce((s, u) => s.plus(u.grossArea.toString()), new Decimal(0));
  const landownerShare = data.landowners.reduce((s, l) => s.plus(l.sharePercent.toString()), new Decimal(0));
  const rent = data.landowners.reduce((s, l) => s.plus(l.monthlyRentAid?.toString() ?? 0), new Decimal(0));
  const marked = data.units.filter((u) => u.owner === "LANDOWNER").reduce((s, u) => s.plus(u.grossArea.toString()), new Decimal(0));
  const shareChecks = data.checks.filter((c) => c.scope === "landowner");
  const flatForLand = data.landModel !== "PURCHASE";

  return (
    <>
      <PageHeader title="Arsa & sözleşme" description={data.landModel ? `Arsa modeli: ${LAND_MODEL_LABELS[data.landModel]}` : undefined} />
      <div className="grid max-w-4xl grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Arsa sahipleri payı (sözleşme)" value={`%${formatNumber(landownerShare, 2)}`} />
            <Figure
              label="Arsa sahibine işaretli bölümler"
              value={`${formatNumber(marked)} m²`}
              note={totalGross.gt(0) ? `Toplam brütün %${formatNumber(marked.div(totalGross).times(100), 2)}'i` : "Bölüm girilmemiş"}
            />
            <Figure label="Müteahhide kalan brüt" value={`${formatNumber(totalGross.minus(marked))} m²`} note="Satılabilir m² maliyetinin paydası" />
            <Figure label="Kira yardımı toplamı" value={`${formatMoney(rent)} / ay`} />
          </CardContent>
        </Card>

        {flatForLand && (
          <Card>
            <CardHeader>
              <CardTitle>Arsa sahipleri</CardTitle>
              <CardDescription>Kat karşılığı payları ve kira yardımları. Verilecek bölümler “Bağımsız bölümler” ekranında işaretlenir.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <CheckList checks={shareChecks} />
              <LandownersManager
                projectId={projectId}
                canEdit={data.canEdit}
                landowners={data.landowners.map((l) => {
                  const own = data.units.filter((u) => u.landownerId === l.id);
                  return {
                    id: l.id,
                    name: l.name,
                    sharePercent: l.sharePercent.toString(),
                    monthlyRentAid: l.monthlyRentAid?.toString() ?? null,
                    phone: l.phone,
                    email: l.email,
                    notes: l.notes,
                    unitCount: own.length,
                    markedGross: own.reduce((s, u) => s.plus(u.grossArea.toString()), new Decimal(0)).toString(),
                  };
                })}
              />
              <Button asChild variant="ghost" className="justify-self-start">
                <Link href={`/projects/${projectId}/units`}>Bölümleri işaretle →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {payments && (
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Arsa ödemeleri ve ödeme planı</CardTitle>
              <CardDescription>
                01 grubundaki ödemeler (arsa bedeli, tapu, kira yardımı …) vade sırasıyla. Ödenen {formatMoney(payments.paid)} · ödenecek {formatMoney(payments.unpaid)}. Taksitler vade listesine ve nakit akışına kendiliğinden yansır; ödendi işareti vade listesinden verilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {payments.rows.length > 0 && (
                <ul className="grid grid-cols-1 divide-y text-sm">
                  {payments.rows.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <Link href={`/projects/${projectId}/expenses/${r.id}`} className="min-w-0 hover:underline">
                        <span className="tabular-nums">{formatDateOnly(r.dueDate ?? r.date)}</span> · {r.costItem?.code} {r.description || r.costItem?.name}
                        {r.supplier && <span className="text-muted-foreground"> · {r.supplier.name}</span>}
                      </Link>
                      <span className="flex items-center gap-2 tabular-nums">
                        {formatMoney(r.totalAmountTry)}
                        <PaymentBadge status={r.paymentStatus} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {payments.canAdd && data.landModel !== "FLAT_FOR_LAND" && <LandInstallmentForm projectId={projectId} today={dateToDateInput(new Date())} />}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Arsa maliyeti</CardTitle>
            <CardDescription>
              Arsa bedeli, tapu masrafları, kira yardımları ve kat karşılığı giderleri bütçede <strong>01 Arsa ve Kat Karşılığı</strong> kalemlerine girilir; ödemeler
              harcama olarak izlenir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/budget`}>Bütçeye git</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
