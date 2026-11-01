import "server-only";
import { cookies } from "next/headers";

// Basit / gelişmiş görünüm tercihi (tarayıcı çerezi; veritabanında tutulmaz).
export const VIEW_COOKIE = "gorunum";

export async function isAdvancedView(): Promise<boolean> {
  return (await cookies()).get(VIEW_COOKIE)?.value === "gelismis";
}
