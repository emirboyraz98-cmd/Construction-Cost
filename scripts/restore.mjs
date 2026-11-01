#!/usr/bin/env node
// Yedekten geri yükleme (geri-yukle.bat): program kapalıyken çalıştırın.
//   node scripts/with-db.mjs -- scripts/restore.mjs [yedek.zip]
// Önce mevcut durumun yedeği alınır; sonra tüm tablolar yedektekiyle değiştirilir ve belgeler geri yazılır.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import readline from "node:readline/promises";
import { strFromU8, unzipSync } from "fflate";
import pg from "pg";
import { appTables, databaseUrl, listBackups, root, uploadsDir } from "./backup-lib.mjs";

const say = (m) => console.log(`\x1b[35m[geri yükleme]\x1b[0m ${m}`);
const fail = (m) => {
  console.error(`\x1b[31m[geri yükleme] HATA:\x1b[0m ${m}`);
  process.exit(1);
};

const appPort = Number(process.env.PORT || 3000);
const appOpen = await new Promise((resolve) => {
  const s = net.connect({ host: "127.0.0.1", port: appPort });
  s.once("connect", () => (s.destroy(), resolve(true)));
  s.once("error", () => resolve(false));
});
if (appOpen) fail("Program açık görünüyor. Önce program penceresini kapatın (Ctrl + C), sonra tekrar deneyin.");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let file = process.argv[2];
if (!file) {
  const list = listBackups().slice(0, 15);
  if (list.length === 0) fail("Yedek bulunamadı (yedekler klasörü boş).");
  console.log("\nYedekler (en yeni başta):");
  list.forEach((b, i) => console.log(`  ${i + 1}) ${b.name}  (${(b.size / 1024 / 1024).toFixed(1)} MB)`));
  const pick = Number((await rl.question("\nHangi yedek geri yüklensin? Numara yazın: ")).trim());
  if (!Number.isInteger(pick) || pick < 1 || pick > list.length) fail("Geçersiz seçim.");
  file = list[pick - 1].path;
}
if (!fs.existsSync(file)) fail(`Dosya bulunamadı: ${file}`);
const entries = unzipSync(new Uint8Array(fs.readFileSync(file)));
if (!entries["manifest.json"]) fail("Bu dosya program yedeği değil (manifest yok).");
const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
say(`Yedek: ${path.basename(file)} · ${new Date(manifest.createdAt).toLocaleString("tr-TR")} · ${Object.values(manifest.counts).reduce((s, n) => s + n, 0)} kayıt, ${manifest.uploads} belge`);
const answer = (await rl.question('Mevcut TÜM veriler bu yedektekiyle değiştirilecek. Devam etmek için EVET yazın: ')).trim();
rl.close();
if (answer.toLocaleUpperCase("tr-TR") !== "EVET") fail("İptal edildi; hiçbir şey değişmedi.");

say("Önce mevcut durumun yedeği alınıyor ...");
const pre = spawnSync(process.execPath, [path.join(root, "scripts", "backup.mjs"), "--label=geri-yukleme-oncesi"], { stdio: "inherit", env: process.env });
if (pre.status !== 0) fail("Güvenlik yedeği alınamadı; geri yükleme yapılmadı.");

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();
try {
  const current = (await client.query("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL")).rows.map((r) => r.migration_name);
  const missing = manifest.migrations.filter((m) => !current.includes(m));
  if (missing.length) fail(`Yedek daha yeni bir program sürümünden. Önce guncelle.bat ile programı güncelleyin. (Eksik: ${missing.join(", ")})`);
  const tables = await appTables(client);
  await client.query("BEGIN");
  // Yabancı anahtar sırası gözetmeden yüklemek için tetikleyiciler bu işlem boyunca kapalı.
  await client.query("SET LOCAL session_replication_role = replica");
  await client.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
  let total = 0;
  for (const table of tables) {
    const data = entries[`veritabani/${table}.jsonl`];
    if (!data) continue;
    const lines = strFromU8(data).split("\n").filter(Boolean);
    for (let i = 0; i < lines.length; i += 500) {
      const batch = `[${lines.slice(i, i + 500).join(",")}]`;
      await client.query(`INSERT INTO "${table}" SELECT * FROM json_populate_recordset(NULL::"${table}", $1::json)`, [batch]);
    }
    total += lines.length;
  }
  await client.query("COMMIT");
  say(`${total} kayıt geri yüklendi.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  fail(`Geri yükleme başarısız, veriler değiştirilmedi: ${error.message}`);
} finally {
  await client.end().catch(() => {});
}

const dir = uploadsDir();
let written = 0;
for (const [name, data] of Object.entries(entries)) {
  if (!name.startsWith("uploads/") || name.endsWith("/")) continue;
  const target = path.join(dir, ...name.slice(8).split("/"));
  if (!target.startsWith(dir)) continue;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  written++;
}
say(`${written} belge geri yazıldı. Tamam: programı baslat.bat ile açabilirsiniz.`);
