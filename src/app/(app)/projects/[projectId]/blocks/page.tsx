import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { totalConstructionArea } from "@/lib/calc/zoning";
import { formatNumber } from "@/lib/format";
import { getProject } from "@/server/projects";
import { BlocksManager } from "./blocks-manager";

export const metadata: Metadata = { title: "Bloklar" };

export default async function BlocksPage({ params }: PageProps<"/projects/[projectId]/blocks">) {
  const { projectId } = await params;
  const { project, role } = await getProject(projectId);
  if (!project) notFound();
  const total = totalConstructionArea(project.blocks);

  return (
    <>
      <PageHeader
        title="Bloklar"
        description={`${project.blocks.length} blok · toplam ${formatNumber(total)} m² inşaat alanı`}
      />
      <BlocksManager
        projectId={project.id}
        canEdit={hasCapability(role, "blocks.edit")}
        blocks={project.blocks.map((block) => ({
          id: block.id,
          name: block.name,
          floorCount: block.floorCount,
          basementCount: block.basementCount,
          floorHeight: block.floorHeight?.toString() ?? null,
          constructionArea: block.constructionArea?.toString() ?? null,
          elevatorCount: block.elevatorCount,
        }))}
      />
      <Card className="mt-4 max-w-2xl py-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Kat kat bölüm listesi, net / brüt m², sahiplik ve alan kontrolleri.</span>
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${projectId}/units`}>Bağımsız bölümler</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
