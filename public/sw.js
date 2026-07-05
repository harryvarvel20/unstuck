// ADHV service worker — installability + a calm offline experience.
// Strategy:
//  - Build assets (/_next/static, generated icons): cache-first (immutable).
//  - Navigations: network-first, falling back to the cached copy of that
//    page, then to a tiny inline offline shell. Never serves stale API data.
//  - API/auth requests: network only (correctness beats offline here).
const VERSION = "adhv-v2";
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ADHV — offline</title>
<style>
  body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
  background:#0E0E13;color:#F0EFF5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  text-align:center;padding:24px}
  .card{max-width:380px}
  h1{font-size:22px;margin:12px 0 0}
  p{color:#A2A2B6;margin-top:10px;line-height:1.5}
</style></head><body><div class="card">
<div style="font-size:38px">🌙</div>
<h1>You're offline — and that's fine.</h1>
<p>Nothing is lost. ADHV will pick up exactly where you left off the moment
you're back online. No rush.</p>
</div></body></html>`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(ASSET_CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API or auth traffic.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // Immutable build assets + generated icons: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/api/icon")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Page navigations: network-first with cached fallback, then offline shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          const hit = await cache.match(req);
          if (hit) return hit;
          return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
      })(),
    );
  }
});
