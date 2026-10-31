// Bekleyen çevrimdışı kayıtları gönderir (bağlantı gelince ve uygulama açılınca).
import { createExpenseAction } from "@/app/(app)/projects/[projectId]/expenses/actions";
import { isNetworkError, listOutbox, removeFromOutbox, updateOutbox, type OutboxEntry } from "./outbox";

let running = false;

export async function sendEntry(entry: OutboxEntry, confirmDuplicate = false): Promise<"sent" | "kept"> {
  const formData = new FormData();
  formData.set("payload", JSON.stringify({ ...entry.payload, confirmDuplicate }));
  for (const f of entry.files) formData.append("files", new File([f.blob], f.name, { type: f.type }));
  try {
    const result = await createExpenseAction(entry.projectId, formData);
    if (result.ok) {
      await removeFromOutbox(entry.id);
      return "sent";
    }
    if ("duplicate" in result) await updateOutbox({ ...entry, status: "duplicate", error: "Aynı tedarikçi ve belge no ile kayıt var; kontrol edip yine de gönderin veya silin." });
    else await updateOutbox({ ...entry, status: "error", error: result.error + (result.fieldErrors ? ` (${Object.values(result.fieldErrors).join(", ")})` : "") });
  } catch (error) {
    if (!isNetworkError(error)) await updateOutbox({ ...entry, status: "error", error: "Gönderilemedi; tekrar deneyin." });
  }
  return "kept";
}

/** Bekleyen (hatasız) kayıtları sırayla gönderir; gönderilen sayısını döndürür. */
export async function syncOutbox(owner: string): Promise<number> {
  if (running || !navigator.onLine) return 0;
  running = true;
  let sent = 0;
  try {
    for (const entry of await listOutbox(owner)) {
      if (entry.status !== "waiting") continue;
      if ((await sendEntry(entry)) === "sent") sent++;
      if (!navigator.onLine) break;
    }
  } finally {
    running = false;
  }
  return sent;
}
