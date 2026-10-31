#!/usr/bin/env node
// Bilgisayarda tek komutla çalıştırma (baslat.bat / demo.bat / guncelle.bat bunu çağırır):
//   node scripts/launch.mjs            → gerekirse kurar ve derler, programı açar
//   node scripts/launch.mjs --demo     → ayrı "insaat_demo" veritabanında örnek verili deneme
//   node scripts/launch.mjs --update   → GitHub'dan son sürümü çeker, kurar, derler
// Gerçek veriler `.pgdata` ve `uploads` klasörlerindedir; demo onlara dokunmaz.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // dosya yoksa sorun değil
  }
}
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === "win32";
const PORT = Number(process.env.PORT || 3000);

const say = (message) => console.log(`\x1b[32m[program]\x1b[0m ${message}`);
function fail(message) {
  console.error(`\x1b[31m[program] HATA:\x1b[0m ${message}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { stdio: "inherit", shell: isWindows && !command.endsWith(".exe") && command !== process.execPath, ...options });
    child.on("error", (error) => fail(`${command} çalıştırılamadı: ${error.message}`));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
const node = (script, scriptArgs, env) => run(process.execPath, [script, ...scriptArgs], { env: { ...process.env, ...env } });
const nextBin = path.join("node_modules", "next", "dist", "bin", "next");

// Gömülü PostgreSQL, Windows'ta Türkçe karakter veya boşluk içeren klasör yollarında sorun çıkarabilir.
if (isWindows && /[^\x00-\x7F]| /.test(root)) {
  say(`Uyarı: klasör yolu Türkçe karakter veya boşluk içeriyor (${root}). Sorun yaşarsanız klasörü C:\\insaat gibi bir yere taşıyın.`);
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) fail(`Node.js 22.12 veya üstü gerekli (bu bilgisayarda ${process.versions.node}). nodejs.org adresinden LTS sürümünü kurun.`);

if (args.has("--update")) {
  say("Son sürüm GitHub'dan alınıyor ...");
  if (!fs.existsSync(".git")) fail("Bu klasör Git ile indirilmemiş (ZIP olarak indirildiyse güncelleme yapılamaz). README'deki “Bir kez yapılacaklar” adımıyla git clone kullanın.");
  if ((await run("git", ["pull", "--ff-only"])) !== 0) fail("Güncelleme alınamadı. Git kurulu mu ve internet var mı kontrol edin; klasörde elle değiştirilmiş dosya varsa geri alın.");
}

if (args.has("--update") || !fs.existsSync("node_modules")) {
  say("Bağımlılıklar yükleniyor (ilk seferde birkaç dakika sürebilir) ...");
  if ((await run("npm", ["install"])) !== 0) fail("npm install başarısız. İnternet bağlantısını kontrol edin.");
}

if (args.has("--update") || !fs.existsSync(path.join(".next", "BUILD_ID"))) {
  say("Program derleniyor ...");
  if ((await node(nextBin, ["build"])) !== 0) fail("Derleme başarısız.");
}
if (args.has("--update") && !args.has("--demo")) {
  say("Güncelleme tamam. Programı açmak için baslat.bat'ı çalıştırın.");
  process.exit(0);
}

const env = {};
if (args.has("--demo")) {
  if (process.env.DATABASE_URL) fail("Demo yalnızca gömülü veritabanıyla çalışır; .env içindeki DATABASE_URL satırını geçici olarak kapatın.");
  env.EMBEDDED_PG_DATABASE = "insaat_demo";
  say("Demo: ayrı “insaat_demo” veritabanına örnek veri yükleniyor (gerçek verilerinize dokunulmaz) ...");
  if ((await node("scripts/with-db.mjs", ["--prepare", "--", "tsx", "prisma/demo.ts"], env)) !== 0) fail("Örnek veri yüklenemedi.");
}

const openBrowser = (url) => {
  const opener = isWindows ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
};

// Program zaten açıksa (ör. pencere arkada kaldıysa) ikinci kez başlatmak yerine tarayıcıyı aç.
const alreadyOpen = await new Promise((resolve) => {
  const socket = net.connect({ host: "127.0.0.1", port: PORT });
  socket.once("connect", () => (socket.destroy(), resolve(true)));
  socket.once("error", () => resolve(false));
});
if (alreadyOpen) {
  // Portu kullanan bu program mı, başka bir uygulama mı?
  const ours = await fetch(`http://127.0.0.1:${PORT}/manifest.webmanifest`)
    .then((r) => r.text())
    .then((t) => t.includes("İnşaat Maliyet"))
    .catch(() => false);
  if (!ours) fail(`${PORT} portunu başka bir program kullanıyor. .env dosyasına PORT=3005 gibi başka bir port yazın.`);
  say(`Program zaten açık: http://localhost:${PORT} (tarayıcıda açılıyor). Kapatmak için açık olan program penceresinde Ctrl + C.`);
  openBrowser(`http://localhost:${PORT}`);
  process.exit(0);
}

/** Günlük otomatik yedek (demo hariç): program açılınca ve açık kaldığı sürece saatte bir kontrol. */
function scheduleBackups() {
  if (args.has("--demo")) return;
  const backup = () => node("scripts/backup.mjs", ["--auto"], env).catch(() => {});
  void backup();
  setInterval(backup, 60 * 60 * 1000).unref();
}

/** Program açılınca tarayıcıyı açar ve telefondan bağlanılacak adresi yazar. */
function openWhenReady() {
  const started = Date.now();
  const timer = setInterval(() => {
    const socket = net.connect({ host: "127.0.0.1", port: PORT });
    socket.once("connect", () => {
      socket.destroy();
      clearInterval(timer);
      const url = `http://localhost:${PORT}`;
      const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => `http://${i.address}:${PORT}`);
      say(`Program hazır: ${url}`);
      if (lan.length) say(`Aynı Wi-Fi'daki telefondan: ${lan.join("  veya  ")}`);
      say("Kapatmak için bu pencerede Ctrl + C.");
      openBrowser(url);
      scheduleBackups();
    });
    socket.once("error", () => {
      socket.destroy();
      if (Date.now() - started > 120_000) clearInterval(timer);
    });
  }, 1500);
}

openWhenReady();
const code = await node("scripts/with-db.mjs", ["--prepare", "--", "next", "start", "-p", String(PORT)], env);
process.exit(code);
