import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { dateToDateInput, decimalToInput } from "@/lib/format";
import { contractFormOptions, getContract } from "@/server/contracts";
import { vatRateOptions } from "@/server/parameters";
import { ContractForm } from "../../contract-form";

export const metadata: Metadata = { title: "Sözleşmeyi düzenle" };

export default async function EditContractPage({ params }: PageProps<"/projects/[projectId]/contracts/[contractId]/edit">) {
  const { projectId, contractId } = await params;
  const detail = await getContract(projectId, contractId);
  if (!detail) notFound();
  if (!detail.perms.manage) return <NoAccess text="Sözleşmeyi düzenleme yetkiniz yok." />;
  const c = detail.contract;
  const [options, vat] = await Promise.all([contractFormOptions(projectId), vatRateOptions(c.date.getUTCFullYear())]);
  return (
    <>
      <PageHeader title={`${c.no} düzenle`} description="Fiyat değişikliği sonraki hakedişlerden itibaren geçerlidir; hakedişe girmiş satır silinemez." />
      <ContractForm
        projectId={projectId}
        contractId={c.id}
        options={{ ...options, vatRates: vat.map((v) => v.value) }}
        documents={c.documents.map((d) => ({ id: d.id, fileName: d.fileName }))}
        initial={{
          no: c.no,
          date: dateToDateInput(c.date),
          supplierId: c.supplierId,
          title: c.title,
          scope: c.scope ?? "",
          supplyMethod: c.supplyMethod,
          vatRate: c.vatRate.toString(),
          vatWithholdingRate: decimalToInput(c.vatWithholdingRate),
          retentionRate: decimalToInput(c.retentionRate),
          advanceOffsetRate: decimalToInput(c.advanceOffsetRate),
          status: c.status,
          startDate: dateToDateInput(c.startDate),
          endDate: dateToDateInput(c.endDate),
          notes: c.notes ?? "",
          items: c.items.map((i) => ({
            key: i.id,
            id: i.id,
            costItemId: i.costItemId,
            description: i.description,
            unit: i.unit,
            quantity: decimalToInput(i.quantity),
            unitPrice: decimalToInput(i.unitPrice),
          })),
        }}
      />
    </>
  );
}
