// Portal service worker.
// Keeps a copy of the portal app itself (pages, scripts, styles, fonts, icons) so it can
// open without signal. Same-origin files are network-first, so updates still arrive
// whenever there is a connection. Supabase requests (client data, files, sign-in) are
// never cached here; itineraries saved for offline use live in the page's own storage.
const CACHE = "sabr-portal-shell-v1";
const CDN_HOSTS = new Set(["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"]);

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("sabr-portal-") && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function isCacheable(url) {
  return url.origin === self.location.origin || CDN_HOSTS.has(url.hostname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match(new URL("./", self.location).href, { ignoreSearch: true });
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!isCacheable(url)) return; // Supabase and anything else: straight to the network.
  // Versioned CDN libraries and fonts never change, so serve them from the cache first.
  event.respondWith(CDN_HOSTS.has(url.hostname) ? cacheFirst(request) : networkFirst(request));
});

// The page sends the files it loaded before this worker took control, so the very first
// visit is enough to make the app available offline.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-urls" || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(event.data.urls.map(async (href) => {
      try {
        const url = new URL(href);
        if (!isCacheable(url) || await cache.match(href)) return;
        const crossOrigin = url.origin !== self.location.origin;
        const response = await fetch(href, crossOrigin ? { mode: "no-cors" } : {});
        if (response.ok || response.type === "opaque") await cache.put(href, response);
      } catch {
        // Best effort: anything missed is cached the next time it loads.
      }
    }));
  })());
});
