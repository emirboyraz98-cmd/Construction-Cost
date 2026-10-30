import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { dateToDateInput } from "@/lib/format";
import { getAccess } from "@/server/access";
import { contractFormOptions } from "@/server/contracts";
import { vatRateOptions } from "@/server/parameters";
import { ContractForm, emptyContractItem } from "../contract-form";

export const metadata: Metadata = { title: "Yeni taşeron sözleşmesi" };

export default async function NewContractPage({ params }: PageProps<"/projects/[projectId]/contracts/new">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "contract.manage")) return <NoAccess text="Sözleşmeyi yönetici, teknik ofis, muhasebe ve satın alma açabilir." />;
  const [options, vat] = await Promise.all([contractFormOptions(projectId), vatRateOptions(new Date().getUTCFullYear())]);
  const vatRates = vat.map((v) => v.value);
  return (
    <>
      <PageHeader title="Yeni taşeron sözleşmesi" description="Birim fiyatlar ve hakediş şartları (teminat, avans mahsubu, KDV tevkifatı)." />
      <ContractForm
        projectId={projectId}
        contractId={null}
        options={{ ...options, vatRates }}
        initial={{
          no: "",
          date: dateToDateInput(new Date()),
          supplierId: null,
          title: "",
          scope: "",
          supplyMethod: "TURNKEY",
          vatRate: vatRates[0] ?? "20",
          vatWithholdingRate: "0",
          retentionRate: "0",
          advanceOffsetRate: "0",
          status: "ACTIVE",
          startDate: "",
          endDate: "",
          notes: "",
          items: [emptyContractItem()],
        }}
      />
    </>
  );
}
