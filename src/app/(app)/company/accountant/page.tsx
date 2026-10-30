import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { dateToDateInput } from "@/lib/format";
import { getAccess } from "@/server/access";
import { listProjectSummaries } from "@/server/projects";
import { PackageForm } from "./package-form";

export const metadata: Metadata = { title: "Muhasebeci paketi" };

export default async function AccountantPage() {
  const { user, scope } = await getAccess();
  if (!hasCapability(user.role, "accountant.export")) {
    return (
      <Card className="max-w-xl">
        <CardContent className="text-sm text-muted-foreground">Muhasebeci paketini indirme yetkiniz yok.</CardContent>
      </Card>
    );
  }
  const projects = (await listProjectSummaries()).filter((p) => hasCapability(projectRole(scope, p.id), "accountant.export"));
  return (
    <>
      <PageHeader
        title="Muhasebeci paketi"
        description="Dönemin onaylı fatura listesi (tedarikçi, vergi no, belge no, tarih, matrah, KDV, toplam), tedarikçi cari özetleri, avanslar ve belge görselleri tek ZIP dosyasında (PLAN 8.4)."
      />
      <PackageForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} today={dateToDateInput(new Date())} />
    </>
  );
}
