// Çevrimdışı destek (Faz 8): uygulama dosyaları önbellekten; hızlı harcama girişi sayfası son açılan
// haliyle internetsiz açılabilir. Diğer sayfalar her zaman sunucudan gelir (güncel veri).
const STATIC = "insaat-static-v2";
const PAGES = "insaat-pages-v2";
const QUICK_ENTRY = /^\/projects\/[^/]+\/expenses\/new$/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Çıkışta kullanıcıya ait sayfa önbelleği silinir.
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Hızlı giriş sayfası: önce ağ (güncel liste), olmazsa son kaydedilen hali.
  if (req.mode === "navigate" && QUICK_ENTRY.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            // Kopya, gövde tarayıcıya verilmeden önce alınmalı.
            const copy = res.clone();
            event.waitUntil(caches.open(PAGES).then((c) => c.put(url.pathname, copy)));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname, { cacheName: PAGES })) || new Response("Çevrimdışı: bu sayfa daha önce açılmamış.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })),
    );
  }
});
