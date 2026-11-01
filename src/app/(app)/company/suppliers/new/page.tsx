import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { SupplierForm } from "../supplier-form";

export const metadata: Metadata = { title: "Tedarikçi ekle" };

export default async function NewSupplierPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "supplier.manage")) {
    return (
      <Card className="max-w-xl">
        <CardContent className="text-sm text-muted-foreground">Tedarikçi ekleme yetkiniz yok.</CardContent>
      </Card>
    );
  }
  return (
    <>
      <PageHeader title="Tedarikçi ekle" />
      <SupplierForm
        supplierId={null}
        initial={{ name: "", taxNumber: "", taxOffice: "", kind: "SUPPLIER", phone: "", email: "", address: "", iban: "", notes: "", active: true }}
      />
    </>
  );
}
