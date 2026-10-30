import { projectRole } from "@/lib/auth/access";
import { expenseVisibility } from "@/lib/expenses/access";
import { getAccess } from "@/server/access";
import { db } from "@/server/db";
import { getSessionUser } from "@/server/session";
import { readStoredFile } from "@/server/storage";

/** Belge dosyası: yalnızca harcamayı görebilen kullanıcıya. */
export async function GET(request: Request, { params }: RouteContext<"/api/documents/[documentId]">) {
  if (!(await getSessionUser())) return new Response("Oturum açın.", { status: 401 });
  const { user, scope } = await getAccess();
  const { documentId } = await params;
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { expense: { select: { projectId: true, createdById: true, deletedAt: true } } },
  });
  const expense = document?.expense;
  const visibility = expense ? expenseVisibility(projectRole(scope, expense.projectId), user.id) : null;
  if (!document || !expense || expense.deletedAt || !visibility) return new Response("Bulunamadı.", { status: 404 });
  if (visibility.createdById && visibility.createdById !== expense.createdById) {
    return new Response("Bulunamadı.", { status: 404 });
  }
  let file: Buffer;
  try {
    file = await readStoredFile(document.storageKey);
  } catch {
    return new Response("Dosya depolamada bulunamadı.", { status: 404 });
  }
  const download = new URL(request.url).searchParams.has("indir");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
