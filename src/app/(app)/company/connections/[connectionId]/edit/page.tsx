import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { hasCapability } from "@/lib/auth/roles";
import { dateToDateInput, decimalToInput } from "@/lib/format";
import { getAccess } from "@/server/access";
import { connectionFormOptions, getConnection } from "@/server/connections";
import { vatRateOptions } from "@/server/parameters";
import { ConnectionForm } from "../../connection-form";

export const metadata: Metadata = { title: "Bağlantıyı düzenle" };

export default async function EditConnectionPage({ params }: PageProps<"/company/connections/[connectionId]/edit">) {
  const { connectionId } = await params;
  const { user } = await getAccess();
  if (!hasCapability(user.role, "connection.manage")) return <NoAccess text="Bağlantıyı yönetici, muhasebe ve satın alma düzenleyebilir." />;
  const [detail, options, vat] = await Promise.all([getConnection(connectionId), connectionFormOptions(), vatRateOptions(new Date().getUTCFullYear())]);
  if (!detail) notFound();
  const c = detail.connection;
  return (
    <>
      <PageHeader title={`${c.no} düzenle`} description="Ödeme planı, tahsis ve faturalar bağlantı sayfasından yönetilir." />
      <ConnectionForm
        connectionId={c.id}
        options={{ suppliers: options.suppliers, costItems: options.costItems, resources: options.resources, vatRates: vat.map((v) => v.value) }}
        documents={c.documents.map((d) => ({ id: d.id, fileName: d.fileName }))}
        initial={{
          no: c.no,
          date: dateToDateInput(c.date),
          supplierId: c.supplierId,
          status: c.status,
          priceType: c.priceType,
          currency: c.currency,
          priceFixedUntil: dateToDateInput(c.priceFixedUntil),
          validUntil: dateToDateInput(c.validUntil),
          lastDrawDate: dateToDateInput(c.lastDrawDate),
          deliveryPlace: c.deliveryPlace ?? "",
          transportIncluded: c.transportIncluded,
          unloadingIncluded: c.unloadingIncluded,
          notes: c.notes ?? "",
          items: c.items.map((item) => ({
            key: item.id,
            id: item.id,
            description: item.description,
            costItemCode: item.costItemCode,
            resourceId: item.resourceId,
            unit: item.unit,
            quantity: decimalToInput(item.quantity),
            unitPrice: decimalToInput(item.unitPrice),
            vatRate: item.vatRate.toString(),
          })),
          payments: [],
        }}
      />
    </>
  );
}
