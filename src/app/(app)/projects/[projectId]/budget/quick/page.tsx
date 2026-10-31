import type { Metadata } from "next";
import { NoAccess } from "@/components/purchasing/shared";
import { PageHeader } from "@/components/page-header";
import { ActionError } from "@/server/access";
import { quickBudgetData } from "@/server/budget";
import { QuickBudgetForm } from "./quick-budget-form";

export const metadata: Metadata = { title: "Hızlı bütçe" };

export default async function QuickBudgetPage({ params }: PageProps<"/projects/[projectId]/budget/quick">) {
  const { projectId } = await params;
  let data: Awaited<ReturnType<typeof quickBudgetData>>;
  try {
    data = await quickBudgetData(projectId);
  } catch (error) {
    if (error instanceof ActionError) return <NoAccess text={error.message} />;
    throw error;
  }
  return (
    <>
      <PageHeader
        title="Hızlı bütçe"
        description="Ayrıntılı metraj hazır değilse: her ana gruba m² başına veya toplam (götürü) tahmini maliyet yazın. Detaylı metraj geldikçe bu satırların yerine gerçek kalemleri girersiniz."
      />
      <QuickBudgetForm projectId={projectId} area={data.area} groups={data.groups} />
    </>
  );
}
