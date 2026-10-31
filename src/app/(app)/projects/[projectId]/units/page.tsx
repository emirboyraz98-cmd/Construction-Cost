import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { FloorPlan, groupPlan } from "@/components/floor-plan";
import { PageHeader } from "@/components/page-header";
import { CheckList } from "@/components/purchasing/checks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FLOOR_LABEL, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { formatNumber } from "@/lib/format";
import { getUnitsOverview } from "@/server/units";
import { UnitsManager } from "./units-manager";

export const metadata: Metadata = { title: "Bağımsız bölümler" };

const OWNER_TONES = [
  "border-sky-300 bg-sky-50 text-sky-900",
  "border-violet-300 bg-violet-50 text-violet-900",
  "border-amber-300 bg-amber-50 text-amber-900",
  "border-rose-300 bg-rose-50 text-rose-900",
];
const CONTRACTOR_TONE = "border-slate-300 bg-white text-slate-800";

export default async function UnitsPage({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]/units">) {
  const { projectId } = await params;
  const planView = (await searchParams).gorunum === "plan";
  const data = await getUnitsOverview(projectId);
  // Arsa sahibine göre sabit renk (sıra değişse de aynı kişi aynı renk)
  const ownerTone = new Map(
    data.landowners.map((l, i) => [l.id, OWNER_TONES[i % OWNER_TONES.length]]),
  );
  const blockById = new Map(data.blocks.map((b) => [b.id, b]));
  return (
    <>
      <PageHeader
        title="Bağımsız bölümler"
        description="Satılabilen her birim (daire, dükkân, ofis). Arsa sahibine verilecek bölümleri burada işaretleyin."
        actions={
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/land`}>Arsa sahipleri</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        {data.checks.length > 0 && (
          <Card className="py-4">
            <CardContent>
              <CheckList checks={data.checks} />
            </CardContent>
          </Card>
        )}
        {data.blocks.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Önce blok ekleyin.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex gap-1.5" role="tablist" aria-label="Görünüm">
              <Button
                asChild
                size="sm"
                variant={planView ? "outline" : "default"}
              >
                <Link href="?" role="tab" aria-selected={!planView}>
                  <ListIcon />
                  Liste
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={planView ? "default" : "outline"}
              >
                <Link href="?gorunum=plan" role="tab" aria-selected={planView}>
                  <LayoutGridIcon />
                  Kat planı
                </Link>
              </Button>
            </div>
            {planView ? (
              <FloorPlan
                legend={[
                  {
                    label: "Müteahhit",
                    tone: CONTRACTOR_TONE,
                    count: data.units.filter((u) => u.owner === "CONTRACTOR")
                      .length,
                  },
                  ...data.landowners.map((l) => ({
                    label: l.name,
                    tone: ownerTone.get(l.id)!,
                    count: data.units.filter((u) => u.landownerId === l.id)
                      .length,
                  })),
                ]}
                blocks={groupPlan(
                  data.units.map((u) => ({
                    ...u,
                    block: blockById.get(u.blockId)!,
                  })),
                  (u) => ({
                    tone:
                      u.owner === "LANDOWNER"
                        ? u.landownerId
                          ? ownerTone.get(u.landownerId)!
                          : OWNER_TONES[0]
                        : CONTRACTOR_TONE,
                    lines: [
                      [USAGE_TYPE_LABELS[u.usageType], u.layout]
                        .filter(Boolean)
                        .join(" · "),
                      `${formatNumber(u.netArea, 0)} / ${formatNumber(u.grossArea, 0)} m²`,
                      u.owner === "LANDOWNER"
                        ? (u.landowner?.name ?? "Arsa sahibi")
                        : "Müteahhit",
                    ],
                    title: `${FLOOR_LABEL(u.floor)} No ${u.doorNo}${u.facade ? ` · Cephe ${u.facade}` : ""}${u.view ? ` · ${u.view}` : ""}`,
                  }),
                )}
              />
            ) : (
              <UnitsManager
                projectId={projectId}
                canEdit={data.canEdit}
                blocks={data.blocks.map((b) => ({
                  id: b.id,
                  name: b.name,
                  constructionArea: b.constructionArea?.toString() ?? null,
                }))}
                landowners={data.landowners.map((l) => ({
                  id: l.id,
                  name: l.name,
                }))}
                units={data.units.map((u) => ({
                  id: u.id,
                  blockId: u.blockId,
                  floor: u.floor,
                  doorNo: u.doorNo,
                  usageType: u.usageType,
                  layout: u.layout,
                  netArea: u.netArea.toString(),
                  grossArea: u.grossArea.toString(),
                  commonAreaShare: u.commonAreaShare?.toString() ?? null,
                  facade: u.facade,
                  view: u.view,
                  extraArea: u.extraArea?.toString() ?? null,
                  owner: u.owner,
                  landownerId: u.landownerId,
                  landownerName: u.landowner?.name ?? null,
                  notes: u.notes,
                }))}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
