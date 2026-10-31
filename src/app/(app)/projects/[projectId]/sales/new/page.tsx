import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { FLOOR_LABEL } from "@/lib/budget/labels";
import { dateToDateInput } from "@/lib/format";
import { getAccess } from "@/server/access";
import { db } from "@/server/db";
import { getSaleForm } from "@/server/sales";
import { SaleForm } from "./sale-form";

export const metadata: Metadata = { title: "Yeni satış" };

export default async function NewSalePage({ params, searchParams }: PageProps<"/projects/[projectId]/sales/new">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "sales.manage")) return <NoAccess text="Satış girme yetkiniz yok." />;
  const sp = await searchParams;
  const data = await getSaleForm(projectId);
  const latest = await db.exchangeRate.findMany({ orderBy: { date: "desc" }, distinct: ["currency"], select: { currency: true, buying: true } });
  const customerName = new Map(data.customers.map((c) => [c.id, c.name]));
  return (
    <>
      <PageHeader title="Yeni satış" description="Satış sözleşmesi ve ödeme planı. Kaydedilince bölümün fiyatı kilitlenir ve rezervasyon satışa dönüşür." />
      <SaleForm
        projectId={projectId}
        today={dateToDateInput(new Date())}
        initialUnitId={typeof sp.bolum === "string" ? sp.bolum : null}
        commissionPercent={data.commissionPercent.toString()}
        customers={data.customers}
        rates={Object.fromEntries(latest.map((r) => [r.currency, r.buying.toString()]))}
        units={data.units.map(({ unit, reservation }) => ({
          id: unit.id,
          label: `${unit.block.name} · No ${unit.doorNo} · ${FLOOR_LABEL(unit.floor)}${unit.layout ? ` · ${unit.layout}` : ""}`,
          listPrice: unit.listPrice?.toString() ?? null,
          listVatRate: unit.listVatRate?.toString() ?? null,
          reservedBy: reservation ? (customerName.get(reservation.customerId) ?? "müşteri") : null,
          reservedCustomerId: reservation?.customerId ?? null,
        }))}
      />
    </>
  );
}
