// Çevrimdışı harcama kutusu (Faz 8): internet yokken girilen kayıtlar fotoğraflarıyla birlikte
// tarayıcının IndexedDB'sinde bekler, bağlantı gelince gönderilir. Yalnızca tarayıcıda çalışır.

export type OutboxEntry = {
  id: string;
  /** Kaydı giren kullanıcının e-postası (aynı telefonda başka kullanıcı gönderemesin) */
  owner: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  /** Harcama formunun değerleri (JSON) */
  payload: Record<string, unknown>;
  files: { name: string; type: string; blob: Blob }[];
  summary: string;
  status: "waiting" | "duplicate" | "error";
  error: string | null;
};

const DB = "insaat-offline";
const STORE = "outbox";
export const OUTBOX_EVENT = "outbox-changed";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

const changed = () => window.dispatchEvent(new Event(OUTBOX_EVENT));

export async function listOutbox(owner: string): Promise<OutboxEntry[]> {
  if (typeof indexedDB === "undefined") return [];
  const all = await tx<OutboxEntry[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxEntry[]>);
  return all.filter((e) => e.owner === owner).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addToOutbox(entry: Omit<OutboxEntry, "id" | "createdAt" | "status" | "error">) {
  const full: OutboxEntry = { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "waiting", error: null };
  await tx("readwrite", (s) => s.put(full));
  changed();
  return full;
}

export async function updateOutbox(entry: OutboxEntry) {
  await tx("readwrite", (s) => s.put(entry));
  changed();
}

export async function removeFromOutbox(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  changed();
}

/** Bağlantı hatası mı (sunucuya ulaşılamadı)? Sunucunun döndürdüğü hatalar bu değildir. */
export function isNetworkError(error: unknown) {
  return typeof navigator !== "undefined" && (!navigator.onLine || error instanceof TypeError);
}
