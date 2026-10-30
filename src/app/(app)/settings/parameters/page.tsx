import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { listParameters } from "@/server/parameters";
import { ParametersManager } from "./parameters-manager";

export const metadata: Metadata = { title: "Parametreler" };

export default async function ParametersPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "parameters.manage")) {
    return (
      <Card className="max-w-xl">
        <CardContent className="text-sm text-muted-foreground">Parametreleri yalnızca yönetici ve muhasebe yönetebilir.</CardContent>
      </Card>
    );
  }
  const rows = await listParameters();
  return (
    <>
      <PageHeader
        title="Vergi, harç ve oran parametreleri"
        description="Oranlar programın içine yazılmaz; buradan yönetilir. Harcama girişindeki KDV seçenekleri harcama yılının “KDV oranı” kayıtlarından gelir. Değerleri muhasebecinizle teyit edin."
      />
      <ParametersManager
        year={new Date().getUTCFullYear()}
        rows={rows.map((row) => ({ ...row, value: row.value.toString() }))}
      />
    </>
  );
}
