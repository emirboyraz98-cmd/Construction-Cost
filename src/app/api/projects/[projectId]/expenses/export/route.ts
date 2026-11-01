import { parseExpenseFilters } from "@/lib/expenses/filters";
import { ActionError } from "@/server/access";
import { db } from "@/server/db";
import { listExpensesForExport } from "@/server/expenses";
import { expensesWorkbook } from "@/server/exports";
import { getSessionUser } from "@/server/session";

/** Harcama listesini (ekrandaki filtrelerle) Excel olarak indirir. */
export async function GET(request: Request, { params }: RouteContext<"/api/projects/[projectId]/expenses/export">) {
  if (!(await getSessionUser())) return new Response("Oturum açın.", { status: 401 });
  const { projectId } = await params;
  const filters = parseExpenseFilters(Object.fromEntries(new URL(request.url).searchParams));
  try {
    const rows = await listExpensesForExport(projectId, filters);
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });
    const file = await expensesWorkbook(project.name, rows);
    const name = `harcamalar_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (error) {
    if (error instanceof ActionError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
