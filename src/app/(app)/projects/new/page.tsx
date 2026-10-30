import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { projectWhere } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { db } from "@/server/db";
import { NewProjectWizard } from "./new-project-wizard";

export const metadata: Metadata = { title: "Yeni proje" };

export default async function NewProjectPage() {
  const { user, scope } = await getAccess();
  if (!hasCapability(user.role, "project.create")) {
    return (
      <>
        <PageHeader title="Yeni proje" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">
            Proje açma yetkiniz yok. Yönetici veya teknik ofis yeni proje açabilir.
          </CardContent>
        </Card>
      </>
    );
  }

  const [projects, templateItemCount] = await Promise.all([
    db.project.findMany({
      where: projectWhere(scope),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        landModel: true,
        _count: { select: { costItems: true } },
        blocks: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { name: true, floorCount: true, basementCount: true, constructionArea: true },
        },
      },
    }),
    db.costItemTemplate.count({ where: { active: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Yeni proje"
        description="Proje bilgilerini, arsa modelini ve blokları girin. Kaydedince maliyet ağacı kopyalanır."
      />
      <NewProjectWizard
        templateItemCount={templateItemCount}
        sources={projects.map((project) => ({
          id: project.id,
          name: project.name,
          type: project.type,
          landModel: project.landModel,
          costItemCount: project._count.costItems,
          blocks: project.blocks.map((block) => ({
            ...block,
            constructionArea: block.constructionArea?.toString() ?? null,
          })),
        }))}
      />
    </>
  );
}
