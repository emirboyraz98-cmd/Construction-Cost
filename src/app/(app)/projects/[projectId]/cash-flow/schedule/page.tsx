import type { Metadata } from "next";
import { AlertTriangleIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { monthLabel } from "@/lib/cashflow/cashflow";
import { getAccess } from "@/server/access";
import { getSchedule } from "@/server/cashflow";
import { ScheduleGantt } from "./schedule-panels";

export const metadata: Metadata = { title: "İş programı" };

export default async function SchedulePage({ params }: PageProps<"/projects/[projectId]/cash-flow/schedule">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "cashflow.view")) return <NoAccess text="Bu projenin iş programını görme yetkiniz yok." />;
  const data = await getSchedule(projectId);
  const { cal } = data;
  const current = cal.currentMonth - cal.startMonth + 1;
  return (
    <>
      <PageHeader title="İş programı" description={`Hangi işin hangi aylarda yapılacağı (${monthLabel(cal.startMonth)} – ${monthLabel(cal.endMonth)}, ${cal.duration} ay). Nakit akışı kalan maliyeti bu aylara dağıtır.`} />
      {cal.warnings.length > 0 && (
        <ul className="mb-4 grid grid-cols-1 gap-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {cal.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}
      <ScheduleGantt
        projectId={projectId}
        canEdit={data.canEdit}
        duration={cal.duration}
        currentIndex={current >= 1 && current <= cal.duration ? current : null}
        monthLabels={Array.from({ length: cal.duration }, (_, i) => monthLabel(cal.startMonth + i))}
        rows={data.rows.map((r) => ({ id: r.id, code: r.code, name: r.name, depth: r.depth, budget: r.budget.toString(), ...r.schedule }))}
      />
    </>
  );
}
