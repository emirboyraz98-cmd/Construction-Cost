import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { dateToDateInput, decimalToInput } from "@/lib/format";
import { getProject } from "@/server/projects";
import { ProjectEditForm } from "./project-edit-form";

export const metadata: Metadata = { title: "Proje bilgileri" };

export default async function ProjectEditPage({ params }: PageProps<"/projects/[projectId]/edit">) {
  const { projectId } = await params;
  const { project, role } = await getProject(projectId);
  if (!project) notFound();

  if (!hasCapability(role, "project.edit")) {
    return (
      <>
        <PageHeader title="Proje bilgileri" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">
            Proje bilgilerini değiştirme yetkiniz yok.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Proje bilgilerini düzenle"
        description="Durum değişikliği (ör. Fizibilite → Ruhsat) ve arşivleme de buradan yapılır. Arşivlenen proje silinmez."
      />
      <ProjectEditForm
        projectId={project.id}
        initialValues={{
          name: project.name,
          type: project.type,
          status: project.status,
          address: project.address ?? "",
          landBlockNo: project.landBlockNo ?? "",
          landParcelNo: project.landParcelNo ?? "",
          landArea: decimalToInput(project.landArea),
          floorAreaRatio: decimalToInput(project.floorAreaRatio),
          groundCoverageRatio: decimalToInput(project.groundCoverageRatio),
          landModel: project.landModel,
          startDate: dateToDateInput(project.startDate),
          durationMonths: project.durationMonths?.toString() ?? "",
        }}
      />
    </>
  );
}
