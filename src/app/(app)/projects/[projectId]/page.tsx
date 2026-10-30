import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListTreeIcon, PencilIcon } from "lucide-react";
import { InfoList } from "@/components/info-list";
import { PageHeader } from "@/components/page-header";
import { PendingFigure } from "@/components/project-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability, ROLE_LABELS } from "@/lib/auth/roles";
import {
  estimatedEndDate,
  permittedFloorArea,
  permittedFootprint,
  totalConstructionArea,
} from "@/lib/calc/zoning";
import { formatDateOnly, formatNumber } from "@/lib/format";
import { LAND_MODEL_LABELS, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { getProject, listProjectTeam } from "@/server/projects";

export const metadata: Metadata = { title: "Proje paneli" };

export default async function ProjectPanelPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { project, role } = await getProject(projectId);
  if (!project) notFound();

  const canEdit = hasCapability(role, "project.edit");
  const canSeeTree = hasCapability(role, "costTree.view");
  const team = hasCapability(role, "project.viewTeam") ? await listProjectTeam(projectId) : null;
  const totalArea = totalConstructionArea(project.blocks);
  const floorArea = permittedFloorArea(project.landArea, project.floorAreaRatio);
  const footprint = permittedFootprint(project.landArea, project.groundCoverageRatio);
  const endDate = estimatedEndDate(project.startDate, project.durationMonths);

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${PROJECT_TYPE_LABELS[project.type]} · ${LAND_MODEL_LABELS[project.landModel]}`}
        actions={
          canEdit && (
            <Button asChild variant="outline">
              <Link href={`/projects/${project.id}/edit`}>
                <PencilIcon />
                Bilgileri düzenle
              </Link>
            </Button>
          )
        }
      >
        <StatusBadge status={project.status} className="mt-2" />
      </PageHeader>

      <div className="grid gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <PendingFigure label="Harcanan" phase={1} />
            <PendingFigure label="Bütçe" phase={3} />
            <PendingFigure label="Satış / tahsilat" phase={6} />
            {canSeeTree ? (
              <Link href={`/projects/${project.id}/cost-tree`} className="min-w-0 hover:underline">
                <p className="text-xs text-muted-foreground">Maliyet ağacı</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <ListTreeIcon className="size-4" />
                  {project._count.costItems} aktif kalem
                </p>
              </Link>
            ) : (
              <div />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proje bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              items={[
                { label: "Adres", value: project.address },
                {
                  label: "Ada / parsel",
                  value:
                    project.landBlockNo || project.landParcelNo
                      ? `${project.landBlockNo ?? "—"} / ${project.landParcelNo ?? "—"}`
                      : null,
                },
                {
                  label: "Arsa alanı",
                  value: project.landArea ? `${formatNumber(project.landArea)} m²` : null,
                },
                { label: "Emsal (KAKS)", value: project.floorAreaRatio ? formatNumber(project.floorAreaRatio, 4) : null },
                {
                  label: "TAKS",
                  value: project.groundCoverageRatio ? formatNumber(project.groundCoverageRatio, 4) : null,
                },
                {
                  label: "Emsal alanı",
                  value: floorArea ? `${formatNumber(floorArea)} m²` : null,
                  hint: "Arsa alanı × emsal",
                },
                {
                  label: "Taban oturumu",
                  value: footprint ? `${formatNumber(footprint)} m²` : null,
                  hint: "Arsa alanı × TAKS",
                },
                { label: "Başlangıç", value: project.startDate ? formatDateOnly(project.startDate) : null },
                {
                  label: "Süre / tahmini bitiş",
                  value: project.durationMonths
                    ? `${project.durationMonths} ay${endDate ? ` · ${formatDateOnly(endDate)}` : ""}`
                    : null,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bloklar</CardTitle>
            <CardDescription>
              {project.blocks.length} blok
              {totalArea.gt(0) && ` · toplam ${formatNumber(totalArea)} m² inşaat alanı`}
            </CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/projects/${project.id}/blocks`}>Bloklar ekranı</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Blok</TableHead>
                  <TableHead className="text-right">Kat</TableHead>
                  <TableHead className="text-right">Bodrum</TableHead>
                  <TableHead className="pr-5 text-right">İnşaat alanı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.blocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell className="pl-5 font-medium">{block.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{block.floorCount ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{block.basementCount ?? "—"}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">
                      {block.constructionArea ? `${formatNumber(block.constructionArea)} m²` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {team && (
          <Card>
            <CardHeader>
              <CardTitle>Ekip</CardTitle>
              <CardDescription>
                Bu projeye yetkili kullanıcılar. Yöneticiler tüm projeleri görür.
              </CardDescription>
              <CardAction>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/settings/users">Kullanıcılar</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {team.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz projeye özel yetki verilmedi.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {team.map((member) => (
                    <li key={member.user.id} className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{member.user.name}</span>
                      <span className="text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
