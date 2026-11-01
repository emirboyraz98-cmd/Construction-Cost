import type { Metadata } from "next";
import { BillingFormPage } from "../billing-page";

export const metadata: Metadata = { title: "Hakediş hazırla" };

export default async function NewBillingPage({ params }: PageProps<"/projects/[projectId]/contracts/[contractId]/billings/new">) {
  const { projectId, contractId } = await params;
  return <BillingFormPage projectId={projectId} contractId={contractId} billingId={null} />;
}
