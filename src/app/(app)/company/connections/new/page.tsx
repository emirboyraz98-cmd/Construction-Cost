import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { hasCapability } from "@/lib/auth/roles";
import { dateToDateInput } from "@/lib/format";
import { getAccess } from "@/server/access";
import { connectionFormOptions } from "@/server/connections";
import { vatRateOptions } from "@/server/parameters";
import { emptyConnectionItem } from "@/lib/form-rows";
import { ConnectionForm } from "../connection-form";

export const metadata: Metadata = { title: "Yeni bağlantı" };

export default async function NewConnectionPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "connection.manage")) return <NoAccess text="Bağlantıyı yönetici, muhasebe ve satın alma açabilir." />;
  const [options, vat] = await Promise.all([connectionFormOptions(), vatRateOptions(new Date().getUTCFullYear())]);
  const vatRates = vat.map((v) => v.value);
  return (
    <>
      <PageHeader title="Yeni malzeme bağlantısı" description="Tedarikçiyle önceden anlaşılan miktar ve fiyat. Projelere dağıtım kayıttan sonra yapılır." />
      <ConnectionForm
        connectionId={null}
        options={{ suppliers: options.suppliers, costItems: options.costItems, resources: options.resources, vatRates }}
        initial={{
          no: "",
          date: dateToDateInput(new Date()),
          supplierId: null,
          status: "ACTIVE",
          priceType: "FIXED",
          currency: "TRY",
          priceFixedUntil: "",
          validUntil: "",
          lastDrawDate: "",
          deliveryPlace: "",
          transportIncluded: true,
          unloadingIncluded: false,
          notes: "",
          items: [emptyConnectionItem(vatRates[0] ?? "20")],
          payments: [],
        }}
      />
    </>
  );
}
