import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { resourceOptions, unmatchedInvoices } from "@/server/library";
import { supplierOptions } from "@/server/suppliers";
import { LibraryTabs } from "../library-panels";
import { MatchTable } from "./match-table";

export const metadata: Metadata = { title: "Faturalardan fiyat" };

export default async function MatchPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "library.manage")) return <NoAccess text="Eşleştirme için kütüphane yönetme yetkisi gerekir." />;
  const [data, resources, suppliers] = await Promise.all([unmatchedInvoices(150), resourceOptions(), supplierOptions()]);
  return (
    <>
      <PageHeader
        title="Faturalardan fiyat"
        description="Fatura satırlarını kütüphane malzemeleriyle eşleştirin; son alım fiyatı kütüphaneye yazılır."
      />
      <LibraryTabs />
      {data.rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Eşleşmemiş fatura satırı yok. Yalnızca miktar × birim fiyat ile girilmiş faturalar listelenir.
          </CardContent>
        </Card>
      ) : (
        <MatchTable
          total={data.count}
          resources={resources}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          rows={data.rows.map((r) => ({
            id: r.id,
            date: r.date.toISOString(),
            project: r.project.name,
            supplier: r.supplier?.name ?? null,
            description: r.description,
            costItem: r.costItem ? `${r.costItem.code} ${r.costItem.name}` : null,
            quantity: r.quantity?.toString() ?? null,
            unit: r.unit,
            unitPrice: r.unitPrice!.toString(),
            currency: r.currency,
            documentNo: r.documentNo,
            suggestion: r.suggestion,
          }))}
        />
      )}
    </>
  );
}
