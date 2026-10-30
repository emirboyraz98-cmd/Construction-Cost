import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { requireProjectAccess } from "@/server/access";
import { importLookups } from "@/server/expenses";
import { vatRateOptions } from "@/server/parameters";
import { BatchEntry } from "./batch-entry";

export const metadata: Metadata = { title: "Toplu harcama girişi" };

export default async function BatchExpensePage({ params }: PageProps<"/projects/[projectId]/expenses/batch">) {
  const { projectId } = await params;
  const { role } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "expense.create")) {
    return (
      <>
        <PageHeader title="Toplu harcama girişi" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">Bu projede harcama girme yetkiniz yok.</CardContent>
        </Card>
      </>
    );
  }
  const [lookups, vatRates] = await Promise.all([importLookups(projectId), vatRateOptions(new Date().getUTCFullYear())]);
  return (
    <>
      <PageHeader
        title="Toplu harcama girişi"
        description="Mevcut fatura kayıtlarını Excel'den aktarın veya tablo modunda çok sayıda harcamayı birlikte girin."
      />
      <BatchEntry
        projectId={projectId}
        vatRates={vatRates}
        costItems={lookups.costItems.filter((c) => c.active).map((c) => `${c.code} ${c.name}`)}
        suppliers={lookups.suppliers.map((s) => s.name)}
      />
    </>
  );
}
