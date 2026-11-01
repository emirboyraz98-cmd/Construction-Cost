import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { getSupplier } from "@/server/suppliers";
import { SupplierForm } from "../../supplier-form";

export const metadata: Metadata = { title: "Tedarikçiyi düzenle" };

export default async function EditSupplierPage({ params }: PageProps<"/company/suppliers/[supplierId]/edit">) {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "supplier.manage")) {
    return (
      <Card className="max-w-xl">
        <CardContent className="text-sm text-muted-foreground">Tedarikçi düzenleme yetkiniz yok.</CardContent>
      </Card>
    );
  }
  const { supplierId } = await params;
  const data = await getSupplier(supplierId);
  if (!data) notFound();
  const s = data.supplier;
  return (
    <>
      <PageHeader title={s.name} description="Tedarikçiyi düzenle" />
      <SupplierForm
        supplierId={s.id}
        initial={{
          name: s.name,
          taxNumber: s.taxNumber ?? "",
          taxOffice: s.taxOffice ?? "",
          kind: s.kind,
          phone: s.phone ?? "",
          email: s.email ?? "",
          address: s.address ?? "",
          iban: s.iban ?? "",
          notes: s.notes ?? "",
          active: s.active,
        }}
      />
    </>
  );
}
