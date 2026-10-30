import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PendingFigure, ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { totalConstructionArea } from "@/lib/calc/zoning";
import { formatNumber } from "@/lib/format";
import { PROJECT_STATUS_ORDER } from "@/lib/labels";
import { getAccess } from "@/server/access";
import { listProjects } from "@/server/projects";

export const metadata: Metadata = { title: "Portföy" };

export default async function PortfolioPage() {
  const { user } = await getAccess();
  const projects = await listProjects({
    statuses: PROJECT_STATUS_ORDER.filter((status) => status !== "ARCHIVED"),
  });
  const canCreate = hasCapability(user.role, "project.create");
  const blockCount = projects.reduce((sum, project) => sum + project._count.blocks, 0);
  const area = totalConstructionArea(projects.flatMap((project) => project.blocks));

  return (
    <>
      <PageHeader
        title="Portföy"
        description="Yürüyen tüm projelerin özeti. Arşivdeki projeler Projeler listesinde."
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/projects/new">
                <PlusIcon />
                Yeni proje
              </Link>
            </Button>
          )
        }
      />

      <Card className="mb-6 py-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <p className="text-xs text-muted-foreground">Aktif proje</p>
            <p className="text-lg font-semibold tabular-nums">{projects.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Blok</p>
            <p className="text-lg font-semibold tabular-nums">{blockCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Toplam inşaat alanı</p>
            <p className="text-lg font-semibold tabular-nums">{formatNumber(area, 0)} m²</p>
          </div>
          <PendingFigure label="Toplam bütçe" phase={3} />
          <PendingFigure label="Toplam harcanan" phase={1} />
          <PendingFigure label="Tahsilat" phase={6} />
        </CardContent>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {canCreate
              ? "Henüz proje yok. “Yeni proje” ile ilk projenizi oluşturun."
              : "Size henüz bir proje atanmadı. Yöneticinizden proje yetkisi isteyin."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  );
}
