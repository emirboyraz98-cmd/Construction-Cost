import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CheckList } from "@/components/purchasing/checks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUnitsOverview } from "@/server/units";
import { UnitsManager } from "./units-manager";

export const metadata: Metadata = { title: "Bağımsız bölümler" };

export default async function UnitsPage({ params }: PageProps<"/projects/[projectId]/units">) {
  const { projectId } = await params;
  const data = await getUnitsOverview(projectId);
  return (
    <>
      <PageHeader
        title="Bağımsız bölümler"
        description="Kat kat bölümler, net / brüt alan ve sahiplik. Arsa sahibine verilecek bölümler burada işaretlenir; sözleşmedeki pay ile karşılaştırılır."
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
            <CardContent className="py-6 text-center text-sm text-muted-foreground">Önce blok ekleyin.</CardContent>
          </Card>
        ) : (
          <UnitsManager
            projectId={projectId}
            canEdit={data.canEdit}
            blocks={data.blocks.map((b) => ({ id: b.id, name: b.name, constructionArea: b.constructionArea?.toString() ?? null }))}
            landowners={data.landowners.map((l) => ({ id: l.id, name: l.name }))}
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
      </div>
    </>
  );
}
