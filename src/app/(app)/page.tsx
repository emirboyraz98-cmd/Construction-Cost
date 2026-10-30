import { redirect } from "next/navigation";
import { getAccess } from "@/server/access";

/** Giriş sonrası: tek projesi olan kullanıcı (ör. şantiye şefi) doğrudan projesine gider. */
export default async function HomePage() {
  const { scope } = await getAccess();
  if (!scope.all && scope.grants.size === 1) {
    const [projectId] = scope.grants.keys();
    redirect(`/projects/${projectId}`);
  }
  redirect("/portfolio");
}
