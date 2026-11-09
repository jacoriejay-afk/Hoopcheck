const VERSION = "hoopcheck-shell-v1";
const SHELL_CACHE = VERSION + "-shell";
const STATIC_CACHE = VERSION + "-static";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try { await cache.add(new Request(OFFLINE_URL, { cache: "reload" })); } catch {}
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("hoopcheck-") && key !== SHELL_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated APIs, Supabase responses, RSC payloads, or HTML
  // route documents. Those can contain account/tier-specific information.
  if (url.pathname.startsWith("/api/") || url.pathname.includes("/_next/data/") || request.headers.get("RSC") === "1") return;

  if (url.pathname.startsWith("/_next/static/") || /\.(?:woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(OFFLINE_URL)) || new Response("You are offline. Reconnect to continue using HoopCheck.", {
          status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
  }
});
