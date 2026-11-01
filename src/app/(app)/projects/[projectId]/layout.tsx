import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireProjectAccess } from "@/server/access";

/** Proje ekranlarının ortak kontrolü: proje yoksa veya kullanıcının yetkisi yoksa 404. */
export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  await requireProjectAccess(projectId);
  const exists = await db.project.count({ where: { id: projectId } });
  if (!exists) notFound();
  return children;
}
