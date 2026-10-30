import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { formatDateOnly } from "@/lib/format";
import { PROJECT_STATUS_ORDER, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { listProjects } from "@/server/projects";
import { listOpenTabs } from "@/server/tabs";

export const metadata: Metadata = { title: "Projeler" };

const FILTERS = {
  aktif: { label: "Yürüyen", statuses: PROJECT_STATUS_ORDER.filter((s) => s !== "ARCHIVED") },
  arsiv: { label: "Arşiv", statuses: ["ARCHIVED"] as ProjectStatus[] },
  tum: { label: "Tümü", statuses: undefined },
} as const;

type FilterKey = keyof typeof FILTERS;

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const { user } = await getAccess();
  const raw = (await searchParams).filtre;
  const filter: FilterKey = typeof raw === "string" && raw in FILTERS ? (raw as FilterKey) : "aktif";
  const [projects, tabs] = await Promise.all([
    listProjects({ statuses: FILTERS[filter].statuses }),
    listOpenTabs(),
  ]);
  const openIds = new Set(tabs.map((tab) => tab.projectId));
  const canCreate = hasCapability(user.role, "project.create");

  return (
    <>
      <PageHeader
        title="Projeler"
        description="Kapattığınız sekmeler silinmez; projeyi buradan yeniden açabilirsiniz."
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

      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1 text-sm sm:w-fit" role="tablist">
        {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
          <Link
            key={key}
            href={key === "aktif" ? "/projects" : `/projects?filtre=${key}`}
            role="tab"
            aria-selected={filter === key}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center sm:flex-none",
              filter === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            {FILTERS[key].label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Bu listede proje yok.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Masaüstü: tablo */}
          <Card className="hidden py-0 md:flex">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Proje</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead className="text-right">Blok</TableHead>
                  <TableHead>Başlangıç</TableHead>
                  <TableHead className="pr-4 text-right">Sekme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="max-w-72 truncate pl-4 font-medium">{project.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} />
                    </TableCell>
                    <TableCell>{PROJECT_TYPE_LABELS[project.type]}</TableCell>
                    <TableCell className="text-right tabular-nums">{project._count.blocks}</TableCell>
                    <TableCell>{formatDateOnly(project.startDate)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button asChild size="sm" variant={openIds.has(project.id) ? "ghost" : "outline"}>
                        <Link href={`/projects/${project.id}`}>
                          {openIds.has(project.id) ? "Açık · Git" : "Sekmede aç"}
                          <ExternalLinkIcon />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobil: kartlar */}
          <div className="grid gap-3 md:hidden">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="gap-2 py-4">
                  <CardContent className="grid gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{project.name}</span>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {PROJECT_TYPE_LABELS[project.type]} · {project._count.blocks} blok ·{" "}
                      {formatDateOnly(project.startDate)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
