import { redirect } from "next/navigation";
import { getAccess } from "@/server/access";

/**
 * Giriş sonrası açılış: tek projesi olan kullanıcı doğrudan işine gider — şantiye şefi harcama
 * girişine, satış ekibi satış ekranına, diğerleri proje paneline. Birden fazla projede portföy.
 */
export default async function HomePage() {
  const { scope } = await getAccess();
  if (!scope.all && scope.grants.size === 1) {
    const [[projectId, role]] = scope.grants.entries();
    if (role === "santiye_sefi") redirect(`/projects/${projectId}/expenses/new`);
    if (role === "satis") redirect(`/projects/${projectId}/sales`);
    redirect(`/projects/${projectId}`);
  }
  redirect("/portfolio");
}
