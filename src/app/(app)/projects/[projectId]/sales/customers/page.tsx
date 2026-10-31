import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { listCustomers } from "@/server/sales";
import { CustomerTable } from "../sales-panels";

export const metadata: Metadata = { title: "Müşteriler" };

export default async function CustomersPage({ params }: PageProps<"/projects/[projectId]/sales/customers">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "sales.view")) return <NoAccess text="Bu projenin müşterilerini görme yetkiniz yok." />;
  const { customers, canManage } = await listCustomers(projectId);
  return (
    <>
      <PageHeader title="Müşteriler" description="Bölüm satın alan veya rezerve eden kişiler. Kimlik bilgilerini yalnızca satış, muhasebe ve yönetici görür." />
      <CustomerTable
        projectId={projectId}
        canManage={canManage}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          identityNo: c.identityNo,
          taxOffice: c.taxOffice,
          phone: c.phone,
          email: c.email,
          address: c.address,
          notes: c.notes,
          units: c.contracts.map((k) => `${k.unit.block.name} No ${k.unit.doorNo}`),
          contractCount: c._count.contracts,
          reservationCount: c._count.reservations,
        }))}
      />
    </>
  );
}
