import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ActionError, requireGlobalCapability } from "./access";
import { db } from "./db";

// Yönetim ekranları: değişiklik geçmişi (PLAN.md 15) ve yedekler.

const PAGE = 50;

export async function listAuditLog(filters: { projectId: string | null; userId: string | null; entity: string | null; from: Date | null; to: Date | null; page: number }) {
  await requireGlobalCapability("audit.view");
  const where = {
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: new Date(filters.to.getTime() + 86_400_000) } : {}) } } : {}),
  };
  const [rows, total, users, projects, entities] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE,
      take: PAGE,
      include: { user: { select: { name: true } }, project: { select: { name: true } } },
    }),
    db.auditLog.count({ where }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.auditLog.groupBy({ by: ["entity"], _count: { _all: true } }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE)), users, projects, entities: entities.map((e) => e.entity).sort() };
}

const root = /*turbopackIgnore: true*/ process.cwd();
export const backupDir = () => path.resolve(/*turbopackIgnore: true*/ root, process.env.BACKUP_DIR || "yedekler");

export async function listBackupFiles() {
  await requireGlobalCapability("backup.manage");
  const dir = backupDir();
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => /^yedek-.*\.zip$/.test(f))
        .sort()
        .reverse()
        .map((name) => {
          const stat = fs.statSync(path.join(/*turbopackIgnore: true*/ dir, name));
          return { name, size: stat.size, createdAt: stat.mtime };
        })
    : [];
  return { dir, files, keep: Number(process.env.BACKUP_KEEP || 14) };
}

/** Şimdi yedek al: scripts/backup.mjs aynı veritabanı bağlantısıyla çalıştırılır. */
export async function runBackupNow() {
  await requireGlobalCapability("backup.manage");
  const script = path.join(/*turbopackIgnore: true*/ root, "scripts", "backup.mjs");
  if (!fs.existsSync(script)) throw new ActionError("Yedek betiği bulunamadı.");
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [script], { env: process.env, timeout: 10 * 60_000 });
    return stdout.replace(/\x1b\[[0-9;]*m/g, "").replace(/\[yedek\] /g, "").trim();
  } catch (error) {
    const message = error instanceof Error && "stderr" in error ? String((error as { stderr: string }).stderr).replace(/\x1b\[[0-9;]*m/g, "").trim() : "";
    throw new ActionError(message || "Yedek alınamadı.");
  }
}

/** Yedek dosyasını indirmek için (yalnızca yedek klasöründeki dosya adları). */
export async function readBackupFile(name: string) {
  await requireGlobalCapability("backup.manage");
  if (!/^yedek-[\w-]+\.zip$/.test(name)) throw new ActionError("Geçersiz dosya adı.");
  const file = path.join(/*turbopackIgnore: true*/ backupDir(), name);
  if (!fs.existsSync(file)) throw new ActionError("Yedek bulunamadı.");
  return fs.readFileSync(file);
}
