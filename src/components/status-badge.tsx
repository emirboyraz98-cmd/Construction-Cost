import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  FEASIBILITY: "border-slate-300 bg-slate-50 text-slate-700",
  PERMIT: "border-violet-300 bg-violet-50 text-violet-700",
  CONSTRUCTION: "border-amber-300 bg-amber-50 text-amber-800",
  SALES: "border-emerald-300 bg-emerald-50 text-emerald-800",
  COMPLETED: "border-sky-300 bg-sky-50 text-sky-800",
  ARCHIVED: "border-zinc-300 bg-zinc-100 text-zinc-600",
};

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}
