import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { COMPANY_MODULES } from "@/lib/modules";
import { getAccess } from "@/server/access";

type Props = PageProps<"/company/[module]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params;
  return { title: COMPANY_MODULES.find((m) => m.key === module)?.label ?? "Bulunamadı" };
}

/** Şirket geneli, henüz yapılmamış ekranlar (Bağlantılar, Tedarikçiler, Kütüphane …). */
export default async function CompanyModulePlaceholder({ params }: Props) {
  await getAccess();
  const { module } = await params;
  const definition = COMPANY_MODULES.find((m) => m.key === module && m.phase);
  if (!definition?.phase) notFound();
  return <ComingSoon title={definition.label} description={definition.description} phase={definition.phase} />;
}
