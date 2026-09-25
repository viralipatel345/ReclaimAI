// Reclaim service worker. Exists only so the app can be installed (for Share → Reclaim).
// It caches NOTHING: a survivor's case must never linger in browser caches.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
