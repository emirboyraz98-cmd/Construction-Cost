import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { dateToDateInput, decimalToInput } from "@/lib/format";
import { ActionError } from "@/server/access";
import { billingFormData } from "@/server/contracts";
import { BillingForm } from "./billing-form";

/** Yeni ve taslak hakediş formu (sunucu tarafı veri hazırlığı ortak). */
export async function BillingFormPage({ projectId, contractId, billingId }: { projectId: string; contractId: string; billingId: string | null }) {
  let data: Awaited<ReturnType<typeof billingFormData>>;
  try {
    data = await billingFormData(projectId, contractId, billingId);
  } catch (error) {
    if (error instanceof ActionError) return <NoAccess text={error.message} />;
    throw error;
  }
  if (!data) return <NoAccess text="Sözleşme veya hakediş bulunamadı." />;
  const b = data.billing;
  return (
    <>
      <PageHeader title={`${data.contract.no} · ${data.seq}. hakediş`} description={`${data.contract.title} · ${data.contract.supplier}`} />
      {b?.rejectionNote && (
        <Alert variant="destructive" className="mb-4 max-w-5xl">
          <AlertTitle>Geri gönderildi</AlertTitle>
          <AlertDescription>{b.rejectionNote}</AlertDescription>
        </Alert>
      )}
      <BillingForm
        projectId={projectId}
        contractId={contractId}
        billingId={b?.id ?? null}
        seq={data.seq}
        lines={data.lines}
        terms={"terms" in data.contract && data.contract.terms ? data.contract.terms : null}
        openAdvance={data.openAdvance}
        initial={{
          date: dateToDateInput(b?.date ?? new Date()),
          periodStart: dateToDateInput(b?.periodStart),
          periodEnd: dateToDateInput(b?.periodEnd),
          dueDate: dateToDateInput(b?.dueDate),
          advanceOffset: b && "advanceOffset" in b ? decimalToInput(b.advanceOffset) : "",
          materialOffset: b && "materialOffset" in b ? decimalToInput(b.materialOffset) : "",
          otherDeductions: b && "otherDeductions" in b ? decimalToInput(b.otherDeductions) : "",
          otherDeductionNote: b && "otherDeductionNote" in b ? (b.otherDeductionNote ?? "") : "",
          notes: b?.notes ?? "",
        }}
      />
    </>
  );
}
