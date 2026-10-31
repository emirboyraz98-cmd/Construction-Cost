// Yedek ve geri yükleme için ortak yardımcılar (scripts/backup.mjs, scripts/restore.mjs, launch.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const backupDir = () => path.resolve(root, process.env.BACKUP_DIR || "yedekler");
export const uploadsDir = () => path.resolve(root, process.env.UPLOAD_DIR || "uploads");
export const KEEP = Number(process.env.BACKUP_KEEP || 14);

/** Gömülü veritabanının bağlantı adresi (DATABASE_URL yoksa). */
export function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const port = Number(process.env.EMBEDDED_PG_PORT || 5499);
  const db = process.env.EMBEDDED_PG_DATABASE || "insaat";
  return `postgresql://postgres:postgres@127.0.0.1:${port}/${db}`;
}

/** Yedek dosyaları, en yeni başta. */
export function listBackups() {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^yedek-.*\.zip$/.test(f))
    .sort()
    .reverse()
    .map((f) => ({ name: f, path: path.join(dir, f), size: fs.statSync(path.join(dir, f)).size }));
}

export const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

/** Klasördeki tüm dosyalar (göreli yol → tam yol). */
export function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile()) out.push({ rel: path.relative(base, full).split(path.sep).join("/"), full });
  }
  return out;
}

/** Uygulama tabloları (Prisma migration tablosu hariç). */
export async function appTables(client) {
  const r = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name",
  );
  return r.rows.map((x) => x.table_name);
}
