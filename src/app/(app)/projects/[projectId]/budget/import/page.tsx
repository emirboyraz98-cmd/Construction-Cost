import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { BudgetImport } from "./budget-import";

export const metadata: Metadata = { title: "Excel'den metraj / bütçe" };

export default async function BudgetImportPage({ params }: PageProps<"/projects/[projectId]/budget/import">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "budget.edit")) return <NoAccess text="Bütçe düzenleme yetkiniz yok." />;
  return (
    <>
      <PageHeader
        title="Excel'den metraj / bütçe"
        description="Metraj cetveli veya keşif listesini toplu ekler. Her satır bir bütçe satırı olur (manuel miktar; birim fiyat varsa elle fiyat, yoksa fiyat sonra bütçe ekranında girilir). Maliyet kalemi kodla eşleşir (ör. 05.05)."
      />
      <BudgetImport projectId={projectId} />
    </>
  );
}
