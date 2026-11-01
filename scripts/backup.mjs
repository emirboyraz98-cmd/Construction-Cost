#!/usr/bin/env node
// Veritabanı + yüklenen belgeler yedeği (PLAN.md 15: otomatik günlük yedek).
//   node scripts/with-db.mjs -- scripts/backup.mjs          → hemen yedek al
//   node scripts/backup.mjs --auto                           → bugün yedek yoksa al (program açıkken)
// Çıktı: yedekler/yedek-YYYY-AA-GG_SSDD.zip (BACKUP_DIR ile başka klasör, ör. OneDrive). Son 14 yedek tutulur.
// İçerik: her tablo JSON satırları (tek tutarlı anda okunur), manifest ve uploads/ klasörü.
import fs from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import pg from "pg";
import { appTables, backupDir, databaseUrl, KEEP, listBackups, stamp, uploadsDir, walk } from "./backup-lib.mjs";

const args = process.argv.slice(2);
const auto = args.includes("--auto");
const label = args.find((a) => a.startsWith("--label="))?.slice(8);
const say = (m) => console.log(`\x1b[35m[yedek]\x1b[0m ${m}`);

const today = stamp().slice(0, 10);
if (auto && listBackups().some((b) => b.name.startsWith(`yedek-${today}`))) process.exit(0);

const client = new pg.Client({ connectionString: databaseUrl() });
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const files = {};
  const counts = {};
  for (const table of await appTables(client)) {
    const r = await client.query(`SELECT row_to_json(t)::text AS j FROM "${table}" t`);
    counts[table] = r.rowCount;
    files[`veritabani/${table}.jsonl`] = strToU8(r.rows.map((x) => x.j).join("\n"));
  }
  const migrations = (await client.query("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name")).rows.map((x) => x.migration_name);
  await client.query("COMMIT");
  const uploads = walk(uploadsDir());
  for (const f of uploads) files[`uploads/${f.rel}`] = fs.readFileSync(f.full);
  files["manifest.json"] = strToU8(JSON.stringify({ createdAt: new Date().toISOString(), migrations, counts, uploads: uploads.length, label: label ?? null }, null, 2));
  const zip = zipSync(files, { level: 6 });
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const name = `yedek-${stamp()}${label ? `-${label}` : ""}.zip`;
  const tmp = path.join(dir, `.${name}.tmp`);
  fs.writeFileSync(tmp, zip);
  fs.renameSync(tmp, path.join(dir, name));
  const rows = Object.values(counts).reduce((s, n) => s + n, 0);
  say(`Yedek alındı: ${path.join(dir, name)} (${(zip.length / 1024 / 1024).toFixed(1)} MB, ${rows} kayıt, ${uploads.length} belge)`);
  // Eski yedekler: etiketli (geri yükleme öncesi) olanlar dahil son KEEP adet tutulur.
  for (const old of listBackups().slice(KEEP)) {
    fs.rmSync(old.path, { force: true });
    say(`Eski yedek silindi: ${old.name}`);
  }
} catch (error) {
  console.error(`\x1b[31m[yedek] HATA:\x1b[0m Yedek alınamadı: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
