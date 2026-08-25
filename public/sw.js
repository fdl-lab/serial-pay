/* Serial Pay — network-first; avoid sticking to stale HTML */
const CACHE = "serial-pay-v4";
const PRECACHE = ["/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // API / RSC / HTML はキャッシュしない（文言デプロイが端末に残るのを防ぐ）
  if (
    url.pathname.startsWith("/api/") ||
    request.mode === "navigate" ||
    request.headers.get("RSC") === "1" ||
    request.destination === "document"
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && url.pathname.startsWith("/_next/static/")) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
