// Veritabanını hazırlayıp verilen komutu çalıştıran yardımcı betik.
//
//   node scripts/with-db.mjs [--prepare] -- <komut> [argümanlar]
//
// - DATABASE_URL tanımlıysa o veritabanı kullanılır (gerçek PostgreSQL sunucusu).
// - Tanımlı değilse proje içindeki `.pgdata/` klasöründe gömülü PostgreSQL
//   (embedded-postgres paketinin ikili dosyaları) başlatılır; sisteme kurulum gerekmez.
// - --prepare: komuttan önce Prisma istemcisini (gerekirse) üretir, migration'ları
//   uygular ve başlangıç verisini (seed) yükler.
// Komut bitince (Ctrl+C dahil) bu betiğin başlattığı veritabanı düzgünce kapatılır.

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // dosya yoksa sorun değil
  }
}

const EMBEDDED = {
  dir: path.join(root, ".pgdata"),
  host: "127.0.0.1",
  port: Number(process.env.EMBEDDED_PG_PORT || 5499),
  user: "postgres",
  password: "postgres",
  database: process.env.EMBEDDED_PG_DATABASE || "insaat",
};
const LOG_FILE = path.join(EMBEDDED.dir, "postgres.log");

function log(message) {
  console.log(`\x1b[36m[veritabanı]\x1b[0m ${message}`);
}

function fail(message) {
  console.error(`\x1b[31m[veritabanı] HATA:\x1b[0m ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const separator = argv.indexOf("--");
  const flags = separator === -1 ? argv : argv.slice(0, separator);
  const command = separator === -1 ? [] : argv.slice(separator + 1);
  return { prepare: flags.includes("--prepare"), command };
}

/** Bir süreci çalıştırır ve çıkış kodunu döndürür. */
function run(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    // "close" yerine "exit": pg_ctl'in başlattığı sunucu çıktı akışlarını açık tutabilir.
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function waitForPort(host, port, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await isPortOpen(host, port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/** embedded-postgres paketinin bu işletim sistemi için getirdiği ikili dosyalar. */
async function loadPostgresBinaries() {
  const platformName = { win32: "windows", darwin: "darwin", linux: "linux" }[process.platform];
  const packageName = `@embedded-postgres/${platformName}-${process.arch}`;
  let embeddedEntry;
  try {
    embeddedEntry = fileURLToPath(import.meta.resolve("embedded-postgres"));
  } catch {
    fail('"embedded-postgres" paketi bulunamadı. Önce "npm install" çalıştırın.');
  }
  try {
    const resolved = createRequire(embeddedEntry).resolve(packageName);
    return await import(pathToFileURL(resolved).href);
  } catch {
    fail(
      `Bu bilgisayar (${process.platform}-${process.arch}) için gömülü PostgreSQL bulunamadı. ` +
        "Ayrı kurulmuş bir PostgreSQL kullanmak için .env dosyasına DATABASE_URL yazın.",
    );
  }
}

/**
 * PostgreSQL root kullanıcısıyla çalışmaz. Linux'ta root olarak çalışılıyorsa
 * (ör. Docker), süreçler "postgres" sistem kullanıcısıyla başlatılır.
 */
function resolveRunAsUser() {
  if (process.platform === "win32" || process.getuid?.() !== 0) return null;
  const lookup = () => {
    const uid = spawnSync("id", ["-u", "postgres"], { encoding: "utf8" });
    const gid = spawnSync("id", ["-g", "postgres"], { encoding: "utf8" });
    if (uid.status !== 0 || gid.status !== 0) return null;
    return { uid: Number(uid.stdout.trim()), gid: Number(gid.stdout.trim()) };
  };
  let ids = lookup();
  if (!ids) {
    log('root olarak çalışılıyor; "postgres" sistem kullanıcısı oluşturuluyor.');
    spawnSync("useradd", ["--system", "--no-create-home", "postgres"], { stdio: "inherit" });
    ids = lookup();
    if (!ids) fail('"postgres" sistem kullanıcısı oluşturulamadı.');
  }
  return ids;
}

async function startEmbeddedPostgres() {
  const bin = await loadPostgresBinaries();
  const runAs = resolveRunAsUser();
  const spawnOptions = runAs ? { uid: runAs.uid, gid: runAs.gid } : {};

  if (!fs.existsSync(path.join(EMBEDDED.dir, "PG_VERSION"))) {
    log(`İlk çalıştırma: gömülü veritabanı oluşturuluyor (${path.relative(root, EMBEDDED.dir)}/) ...`);
    fs.mkdirSync(EMBEDDED.dir, { recursive: true });
    if (runAs) fs.chownSync(EMBEDDED.dir, runAs.uid, runAs.gid);
    const passwordFile = path.join(os.tmpdir(), `pg-pw-${crypto.randomBytes(6).toString("hex")}`);
    fs.writeFileSync(passwordFile, `${EMBEDDED.password}\n`, { mode: 0o644 });
    try {
      const code = await run(
        bin.initdb,
        [
          `--pgdata=${EMBEDDED.dir}`,
          `--username=${EMBEDDED.user}`,
          `--pwfile=${passwordFile}`,
          "--auth=scram-sha-256",
          "--encoding=UTF8",
          // İşletim sisteminin bölge ayarından (ör. Turkish_Türkiye.1254) bağımsız olsun diye
          // PostgreSQL'in kendi Unicode yerel ayarı kullanılır.
          "--locale=C",
          "--locale-provider=builtin",
          "--builtin-locale=C.UTF-8",
        ],
        { ...spawnOptions, stdio: ["ignore", "ignore", "inherit"] },
      );
      if (code !== 0) {
        fs.rmSync(EMBEDDED.dir, { recursive: true, force: true });
        fail("Veritabanı oluşturulamadı (initdb). Yukarıdaki mesajlara bakın.");
      }
    } finally {
      fs.rmSync(passwordFile, { force: true });
    }
  } else if (runAs) {
    spawnSync("chown", ["-R", `${runAs.uid}:${runAs.gid}`, EMBEDDED.dir]);
  }

  const status = await run(bin.pg_ctl, ["status", "-D", EMBEDDED.dir], {
    ...spawnOptions,
    stdio: "ignore",
  });
  if (status === 0) {
    // Başka bir terminalde çalışan (veya önceki oturumdan kalan) sunucuyu kullan.
    if (await waitForPort(EMBEDDED.host, EMBEDDED.port, 10_000)) {
      log(`Zaten çalışan gömülü veritabanı kullanılıyor (port ${EMBEDDED.port}).`);
      return { startedHere: false, bin, spawnOptions };
    }
    fail(
      "Veritabanı çalışıyor görünüyor ama bağlanılamıyor. Bilgisayarı yeniden başlatın veya " +
        `"${path.join(".pgdata", "postmaster.pid")}" dosyasını silip tekrar deneyin.`,
    );
  }

  if (await isPortOpen(EMBEDDED.host, EMBEDDED.port)) {
    fail(
      `${EMBEDDED.port} portu başka bir program tarafından kullanılıyor. ` +
        ".env dosyasında EMBEDDED_PG_PORT ile başka bir port seçin.",
    );
  }

  log(`Gömülü PostgreSQL başlatılıyor (port ${EMBEDDED.port}) ...`);
  const code = await run(
    bin.pg_ctl,
    [
      "start",
      "-D",
      EMBEDDED.dir,
      "-w",
      "-t",
      "90",
      "-l",
      LOG_FILE,
      "-o",
      `-p ${EMBEDDED.port} -c listen_addresses=${EMBEDDED.host}`,
    ],
    { ...spawnOptions, stdio: "ignore" },
  );
  if (code !== 0) {
    let tail = "";
    try {
      tail = fs.readFileSync(LOG_FILE, "utf8").split(/\r?\n/).slice(-15).join("\n");
    } catch {
      // günlük dosyası yoksa
    }
    fail(`Gömülü PostgreSQL başlatılamadı. Son günlük satırları:\n${tail}`);
  }
  return { startedHere: true, bin, spawnOptions };
}

async function stopEmbeddedPostgres({ bin, spawnOptions }) {
  log("Gömülü PostgreSQL kapatılıyor ...");
  await run(bin.pg_ctl, ["stop", "-D", EMBEDDED.dir, "-m", "fast", "-w"], {
    ...spawnOptions,
    stdio: "ignore",
  });
}

async function ensureDatabaseExists() {
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    host: EMBEDDED.host,
    port: EMBEDDED.port,
    user: EMBEDDED.user,
    password: EMBEDDED.password,
    database: "postgres",
  });
  await client.connect();
  try {
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      EMBEDDED.database,
    ]);
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(EMBEDDED.database)}`);
      log(`"${EMBEDDED.database}" veritabanı oluşturuldu.`);
    }
  } finally {
    await client.end();
  }
}

/** node_modules içindeki bir paketin komut dosyasını (bin) bulur. */
function resolvePackageBin(name) {
  const packageDir = path.join(root, "node_modules", name);
  const packageJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) fail(`"${name}" bulunamadı. Önce "npm install" çalıştırın.`);
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const binPath = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[name];
  if (!binPath) fail(`"${name}" paketinde çalıştırılabilir komut yok.`);
  return path.join(packageDir, binPath);
}

function runCommand([name, ...args], env) {
  return spawn(process.execPath, [resolvePackageBin(name), ...args], { stdio: "inherit", env });
}

async function runStep(command, env, errorMessage) {
  const code = await new Promise((resolve, reject) => {
    const child = runCommand(command, env);
    child.on("error", reject);
    child.on("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== 0) throw new Error(errorMessage);
}

/** Şema değiştiyse (ör. git pull sonrası) Prisma istemcisini yeniden üretir. */
async function generateClientIfNeeded(env) {
  const schema = fs.readFileSync(path.join(root, "prisma", "schema.prisma"));
  const hash = crypto.createHash("sha256").update(schema).digest("hex");
  const marker = path.join(root, "src", "generated", "prisma", ".schema-hash");
  const current = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8") : "";
  if (current === hash) return;
  await runStep(["prisma", "generate"], env, "Prisma istemcisi üretilemedi.");
  fs.writeFileSync(marker, hash);
}

async function main() {
  const { prepare, command } = parseArgs(process.argv.slice(2));
  if (command.length === 0) fail("Çalıştırılacak komut verilmedi.");

  let embedded = null;
  const env = { ...process.env };
  if (process.env.DATABASE_URL) {
    log("DATABASE_URL tanımlı; harici PostgreSQL kullanılıyor.");
  } else {
    embedded = await startEmbeddedPostgres();
    await ensureDatabaseExists();
    env.DATABASE_URL =
      `postgresql://${EMBEDDED.user}:${EMBEDDED.password}` +
      `@${EMBEDDED.host}:${EMBEDDED.port}/${EMBEDDED.database}`;
  }

  let shuttingDown = false;
  const stop = async (exitCode) => {
    if (embedded?.startedHere) await stopEmbeddedPostgres(embedded);
    process.exit(exitCode);
  };

  try {
    if (prepare) {
      await generateClientIfNeeded(env);
      log("Migration'lar uygulanıyor ...");
      await runStep(["prisma", "migrate", "deploy"], env, "Migration'lar uygulanamadı.");
      log("Başlangıç verisi kontrol ediliyor ...");
      await runStep(["tsx", "prisma/seed.ts"], env, "Başlangıç verisi yüklenemedi.");
    }
  } catch (error) {
    console.error(`\x1b[31m[veritabanı] HATA:\x1b[0m ${error.message}`);
    await stop(1);
  }

  const child = runCommand(command, env);
  const forward = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    // Ctrl+C terminaldeki tüm süreçlere zaten gider; yine de kapanmazsa sonlandır.
    setTimeout(() => child.exitCode === null && child.kill(signal), 5000).unref();
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => forward(signal));
  child.on("exit", (code, signal) => stop(code ?? (signal ? 1 : 0)));
}

main().catch((error) => fail(error?.stack ?? String(error)));
