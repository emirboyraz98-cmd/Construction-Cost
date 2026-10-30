import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { totalConstructionArea } from "@/lib/calc/zoning";
import { dateToDateInput } from "@/lib/format";
import { getAccess } from "@/server/access";
import { db } from "@/server/db";
import { vatRateOptions } from "@/server/parameters";
import { supplierOptions } from "@/server/suppliers";
import { SharedInvoiceForm } from "./shared-invoice-form";

export const metadata: Metadata = { title: "Ortak fatura" };

export default async function SharedInvoicePage() {
  const { user, scope } = await getAccess();
  if (!hasCapability(user.role, "expense.manage")) {
    return (
      <Card className="max-w-xl">
        <CardContent className="text-sm text-muted-foreground">Ortak faturayı yalnızca yönetici ve muhasebe girebilir.</CardContent>
      </Card>
    );
  }
  const [projects, templates, suppliers, vatRates] = await Promise.all([
    db.project.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, blocks: { select: { constructionArea: true } } },
    }),
    db.costItemTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true } }),
    supplierOptions(),
    vatRateOptions(new Date().getUTCFullYear()),
  ]);
  const allowed = projects.filter((p) => hasCapability(projectRole(scope, p.id), "expense.manage"));

  return (
    <>
      <PageHeader
        title="Ortak fatura"
        description="Genel merkez gideri, ortak reklam veya birden fazla şantiyeye gelen tek fatura: seçilen projelere dağıtım anahtarıyla bölünür (PLAN 5.1)."
      />
      <SharedInvoiceForm
        today={dateToDateInput(new Date())}
        projects={allowed.map((p) => ({ id: p.id, name: p.name, area: totalConstructionArea(p.blocks).toString() }))}
        costItemCodes={templates}
        suppliers={suppliers}
        vatRates={vatRates}
      />
    </>
  );
}
