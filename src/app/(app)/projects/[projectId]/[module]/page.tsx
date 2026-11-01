import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { PROJECT_MODULES } from "@/lib/modules";
import { requireProjectAccess } from "@/server/access";

type Props = PageProps<"/projects/[projectId]/[module]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params;
  return { title: PROJECT_MODULES.find((m) => m.key === module)?.label ?? "Bulunamadı" };
}

/** Henüz yapılmamış proje modülleri (Harcamalar, Satışlar …) için yer tutucu. */
export default async function ProjectModulePlaceholder({ params }: Props) {
  const { projectId, module } = await params;
  await requireProjectAccess(projectId);
  const definition = PROJECT_MODULES.find((m) => m.key === module && m.phase);
  if (!definition?.phase) notFound();
  return <ComingSoon title={definition.label} description={definition.description} phase={definition.phase} />;
}
