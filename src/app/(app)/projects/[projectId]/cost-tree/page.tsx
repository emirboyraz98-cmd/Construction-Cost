import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { requireProjectAccess } from "@/server/access";
import { listCostItems } from "@/server/cost-items";
import { CostTree } from "./cost-tree";

export const metadata: Metadata = { title: "Maliyet ağacı" };

export default async function CostTreePage({ params }: PageProps<"/projects/[projectId]/cost-tree">) {
  const { projectId } = await params;
  const { role } = await requireProjectAccess(projectId);

  if (!hasCapability(role, "costTree.view")) {
    return (
      <>
        <PageHeader title="Bütçe / Maliyet ağacı" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">
            Bu projede maliyet bilgilerini görme yetkiniz yok.
          </CardContent>
        </Card>
      </>
    );
  }

  const items = await listCostItems(projectId);
  return (
    <>
      <PageHeader
        title="Bütçe / Maliyet ağacı"
        description="Harcama türlerinin gruplanmış listesi. Her harcama ve bütçe satırı bir kaleme bağlanır."
      />
      <CostTree projectId={projectId} items={items} canEdit={hasCapability(role, "costTree.edit")} />
    </>
  );
}
