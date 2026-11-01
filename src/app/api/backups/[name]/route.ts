import { ActionError } from "@/server/access";
import { readBackupFile } from "@/server/admin";
import { getSessionUser } from "@/server/session";

/** Yedek dosyasını indirir (yalnızca yönetici). */
export async function GET(_request: Request, { params }: RouteContext<"/api/backups/[name]">) {
  if (!(await getSessionUser())) return new Response("Oturum açın.", { status: 401 });
  const { name } = await params;
  try {
    const data = await readBackupFile(decodeURIComponent(name));
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"` } });
  } catch (error) {
    if (error instanceof ActionError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
