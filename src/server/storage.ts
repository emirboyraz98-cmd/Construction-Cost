import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ALLOWED_UPLOADS, type AllowedMime } from "@/lib/files";

// Belge dosyaları (fiş/fatura fotoğrafları, PDF). Şimdilik yerel diskte, varsayılan olarak
// proje klasöründeki `uploads/` altında; sunucuya geçişte S3 uyumlu depolamaya taşınabilir.
const ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

function fullPath(key: string): string {
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(ROOT + path.sep)) throw new Error("Geçersiz dosya anahtarı.");
  return resolved;
}

export async function saveFile(data: Uint8Array, mimeType: AllowedMime): Promise<string> {
  const now = new Date();
  const key = [
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}${ALLOWED_UPLOADS[mimeType]}`,
  ].join("/");
  const target = fullPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data, { flag: "wx" });
  return key;
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return fs.readFile(fullPath(key));
}

export async function deleteStoredFile(key: string): Promise<void> {
  await fs.rm(fullPath(key), { force: true });
}
