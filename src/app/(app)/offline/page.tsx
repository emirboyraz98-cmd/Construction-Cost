import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getAccess } from "@/server/access";
import { OutboxList } from "./outbox-list";

export const metadata: Metadata = { title: "Bekleyen kayıtlar" };

export default async function OfflinePage() {
  const { user } = await getAccess();
  return (
    <>
      <PageHeader
        title="Bekleyen kayıtlar"
        description="İnternet yokken girilen harcamalar bu telefonda bekler ve bağlantı gelince otomatik gönderilir. Hızlı giriş sayfası bir kez açıldıysa internetsiz de açılır (son açılıştaki kalem ve tedarikçi listesiyle)."
      />
      <OutboxList owner={user.email} />
    </>
  );
}
