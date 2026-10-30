import Link from "next/link";
import { CalendarIcon, BlocksIcon, RulerIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LandModel, ProjectStatus, ProjectType } from "@/generated/prisma/enums";
import { totalConstructionArea } from "@/lib/calc/zoning";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { LAND_MODEL_LABELS, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { StatusBadge } from "./status-badge";

export type ProjectCardData = {
  id: string;
  name: string;
  status: ProjectStatus;
  type: ProjectType;
  landModel: LandModel;
  startDate: Date | null;
  durationMonths: number | null;
  _count: { blocks: number };
  blocks: { constructionArea: { toString(): string } | null }[];
};

/** Bütçe/harcama gibi henüz hesaplanmayan değerler için: 0 ve hangi fazda geleceği. */
export function PendingFigure({ label, phase }: { label: string; phase: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{formatMoney(0)}</p>
      <p className="text-[11px] text-amber-700">Faz {phase}&apos;de</p>
    </div>
  );
}

export type SpendSummary = { net: { toString(): string }; pending: number; unpaid: { toString(): string } };

export function SpendFigure({ label, value, note }: { label: string; value: { toString(): string } | number; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{formatMoney(value)}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

/** spend / budget: undefined → görme yetkisi yok; tutarlar gösterilmez. */
export function ProjectCard({
  project,
  spend,
  budget,
}: {
  project: ProjectCardData;
  spend?: SpendSummary | null;
  budget?: { toString(): string } | null;
}) {
  const area = totalConstructionArea(project.blocks);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-3 transition-shadow group-hover:shadow-md">
        <CardHeader className="grid-cols-[1fr_auto] gap-2">
          <CardTitle className="truncate text-base leading-snug" title={project.name}>
            {project.name}
          </CardTitle>
          <StatusBadge status={project.status} />
          <p className="col-span-2 text-xs text-muted-foreground">
            {PROJECT_TYPE_LABELS[project.type]} · {LAND_MODEL_LABELS[project.landModel]}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="grid gap-1.5 text-muted-foreground">
            <span className="flex items-center gap-2">
              <BlocksIcon className="size-4" />
              {project._count.blocks} blok
              {area.gt(0) && (
                <>
                  <RulerIcon className="ml-2 size-4" />
                  {formatNumber(area, 0)} m²
                </>
              )}
            </span>
            <span className="flex items-center gap-2">
              <CalendarIcon className="size-4" />
              {project.startDate ? formatDateOnly(project.startDate) : "Başlangıç tarihi yok"}
              {project.durationMonths ? ` · ${project.durationMonths} ay` : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            {budget !== undefined ? <SpendFigure label="Bütçe (KDV hariç)" value={budget ?? 0} /> : <div />}
            {spend !== undefined ? (
              <SpendFigure
                label="Harcanan (KDV hariç)"
                value={spend?.net ?? 0}
                note={spend?.pending ? `${spend.pending} kayıt onay bekliyor` : undefined}
              />
            ) : (
              <div />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
