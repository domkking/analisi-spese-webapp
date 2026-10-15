/* Service worker generato in fase di build (vedi vite.config.ts): precache dell'app, funziona offline. */
const VERSION = "__VERSION__";
const CACHE = `analisi-spese-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("analisi-spese-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return; // mai intercettare altre origini

  if (request.mode === "navigate") {
    // rete prima (per ricevere aggiornamenti), cache se offline
    event.respondWith(fetch(request).catch(() => caches.match("./")));
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
