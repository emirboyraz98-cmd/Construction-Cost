import { hasCapability } from "@/lib/auth/roles";
import { dateInputToDate } from "@/lib/format";
import { ActionError, getAccess } from "@/server/access";
import { accountantPackage } from "@/server/exports";
import { getSessionUser } from "@/server/session";

/** Muhasebeci paketi (ZIP): ?from=2026-10-01&to=2026-10-31&projects=id1,id2 */
export async function GET(request: Request) {
  if (!(await getSessionUser())) return new Response("Oturum açın.", { status: 401 });
  const { user } = await getAccess();
  if (!hasCapability(user.role, "accountant.export")) return new Response("Yetkiniz yok.", { status: 403 });
  const params = new URL(request.url).searchParams;
  const from = dateInputToDate(params.get("from"));
  const to = dateInputToDate(params.get("to"));
  if (!from || !to || from > to) return new Response("Geçerli bir dönem seçin.", { status: 400 });
  const projectIds = params.get("projects")?.split(",").filter(Boolean) ?? null;
  try {
    const { zip, fileName } = await accountantPackage({ from, to, projectIds: projectIds?.length ? projectIds : null });
    return new Response(zip, {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${fileName}"` },
    });
  } catch (error) {
    if (error instanceof ActionError) return new Response(error.message, { status: 400 });
    throw error;
  }
}
