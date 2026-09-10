// Minimal offline support for the family checklist PWA.
// Only same-origin requests under this app's own scope are cached —
// Supabase API calls and Google Fonts always go straight to the network.
const CACHE_VERSION = "v1";
const CACHE_NAME = `family-checklist-${CACHE_VERSION}`;
const SCOPE = self.registration.scope;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(SCOPE)) return;

  // App shell (index.html / navigations): network-first, so a signed-in
  // user always gets the latest build when online, with the last cached
  // shell as an offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match(`${SCOPE}index.html`)))
    );
    return;
  }

  // Hashed JS/CSS/image assets: cache-first (they never change content
  // under the same filename), falling back to network and caching the
  // result for next time.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
