import type { Metadata } from "next";
import { BillingFormPage } from "../../billing-page";

export const metadata: Metadata = { title: "Hakedişi düzenle" };

export default async function EditBillingPage({ params }: PageProps<"/projects/[projectId]/contracts/[contractId]/billings/[billingId]/edit">) {
  const { projectId, contractId, billingId } = await params;
  return <BillingFormPage projectId={projectId} contractId={contractId} billingId={billingId} />;
}
