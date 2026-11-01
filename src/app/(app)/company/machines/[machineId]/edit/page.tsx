import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { formatNumber } from "@/lib/format";
import { getMachine } from "@/server/machines";
import { MachineForm } from "../../machine-form";

export const metadata: Metadata = { title: "Makineyi düzenle" };

export default async function EditMachinePage({ params }: PageProps<"/company/machines/[machineId]/edit">) {
  const { machineId } = await params;
  const data = await getMachine(machineId);
  if (!data) notFound();
  if (!data.canManage) return <NoAccess text="Makineyi düzenleme yetkiniz yok." />;
  const m = data.machine;
  return (
    <>
      <PageHeader title={`${m.code} düzenle`} description={m.name} />
      <MachineForm
        machineId={m.id}
        initial={{
          code: m.code,
          name: m.name,
          category: m.category ?? "",
          brand: m.brand ?? "",
          model: m.model ?? "",
          plateOrSerial: m.plateOrSerial ?? "",
          year: m.year ? String(m.year) : "",
          status: m.status,
          usageUnit: m.usageUnit,
          internalRate: m.internalRate ? formatNumber(m.internalRate, 2) : "",
          notes: m.notes ?? "",
        }}
      />
    </>
  );
}
