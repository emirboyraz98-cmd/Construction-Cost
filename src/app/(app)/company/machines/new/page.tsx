import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { EMPTY_MACHINE, MachineForm } from "../machine-form";

export const metadata: Metadata = { title: "Makine ekle" };

export default async function NewMachinePage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "machine.manage")) return <NoAccess text="Makine eklemek için yönetici, muhasebe veya satın alma yetkisi gerekir." />;
  return (
    <>
      <PageHeader title="Makine ekle" description="Kod, ad ve iç kullanım ücreti yeterli; satın alma bedeli ve giderler makine sayfasından hareket olarak girilir." />
      <MachineForm machineId={null} initial={EMPTY_MACHINE} />
    </>
  );
}
