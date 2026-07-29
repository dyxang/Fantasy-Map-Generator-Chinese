// Lightweight Service Worker for web deployments.
// Previously delegated caching to workbox loaded from
// https://storage.googleapis.com/workbox-cdn — replaced with the native
// Cache API so the worker stays functional in restricted/offline
// environments and no longer requires a third-party CDN.
//
// Desktop builds (Tauri) skip this worker entirely; see
// `public/main.js` where the registration is gated on `!IS_TAURI`.

const CACHE_VERSION = "fmg-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Minimal precache list — Vite's `public/` files are hashed under /assets
// and are best cached on demand instead.
const PRECACHE_URLS = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        PRECACHE_URLS.map(async url => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) await cache.put(url, response);
          } catch (_err) {
            // ignore: precache is best-effort
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE).map(key => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

const isHTMLRequest = request =>
  request.mode === "navigate" || (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));

const isCacheableAsset = url => {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return [".js", ".css", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2"].some(ext =>
    url.pathname.endsWith(ext)
  );
};

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Network-first for HTML to keep updates responsive, fall back to cache.
  if (isHTMLRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch (_err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // Cache-first for static assets, network in background.
  if (isCacheableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) {
          fetch(request)
            .then(response => {
              if (response.ok) {
                caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response));
              }
            })
            .catch(() => {});
          return cached;
        }
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch (_err) {
          return new Response("", { status: 504, statusText: "Offline" });
        }
      })()
    );
  }
});
