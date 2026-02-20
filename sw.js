// Меняй версию при каждом релизе (v3, v4, v5...)
// Это гарантированно обновит PWA без удаления иконки.
const CACHE_VERSION = "v3";
const CACHE_NAME = `ru-tr-trainer-${CACHE_VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

// Установка: кладём файлы в новый кэш и сразу активируем
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Активация: удаляем старые кэши и сразу берём контроль
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) =>
        k.startsWith("ru-tr-trainer-") && k !== CACHE_NAME
          ? caches.delete(k)
          : Promise.resolve()
      )
    );
    await self.clients.claim();
  })());
});

// Fetch стратегия:
// - index.html: network-first (чтобы всегда тянуть свежий HTML)
// - остальное: stale-while-revalidate (быстро, но обновляется)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Только наш origin (GitHub Pages)
  if (url.origin !== self.location.origin) return;

  const isIndex =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");

  if (isIndex) {
    event.respondWith((async () => {
      try {
        // no-store: не даём браузерному HTTP-кэшу мешать
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (e) {
        // офлайн: отдаём index.html из кэша
        const cached = await caches.match("./index.html");
        if (cached) return cached;
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  // Для остальных ресурсов: быстро из кэша, обновление в фоне
  event.respondWith((async () => {
    const cached = await caches.match(req);

    const fetchPromise = fetch(req).then((fresh) => {
      caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh.clone()));
      return fresh;
    }).catch(() => cached);

    return cached || fetchPromise;
  })());
});
