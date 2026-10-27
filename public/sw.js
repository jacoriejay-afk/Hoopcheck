/* HoopCheck PWA service worker.
 * Only the offline shell and non-personal static assets are cached.
 * API/review responses are always fetched from the network and never cached,
 * so stale reviews can never be presented as current data.
 */
const CACHE_PREFIX = "hoopcheck-pwa-v1";
const SHELL_CACHE = CACHE_PREFIX + "-shell";
const STATIC_CACHE = CACHE_PREFIX + "-static";
const SHELL_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/hoopcheck-192.svg",
  "/icons/hoopcheck-512.svg",
  "/apple-icon"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("hoopcheck-pwa-") && key !== SHELL_CACHE && key !== STATIC_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isApiOrReviewRequest(url) {
  const path = url.pathname.toLowerCase();
  return path.startsWith("/api/") ||
    /(^|\/)(reviews?|ratings?|review-data)(\/|$)/.test(path) ||
    /[?&](type|resource)=(review|reviews|rating|ratings)(?:&|$)/i.test(url.search);
}

function isStaticAsset(url) {
  return /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico)$/i.test(url.pathname) &&
    !url.pathname.startsWith("/api/");
}

function offlineResponse() {
  return new Response(JSON.stringify({
    error: "offline",
    message: "Connect to the internet to load current HoopCheck data."
  }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API, review, rating, or other data endpoints. Network failure
  // is explicit; no cached response can masquerade as a live review.
  if (isApiOrReviewRequest(url)) {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => offlineResponse()));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.open(SHELL_CACHE);
        return (await shell.match("/offline.html")) || new Response(
          "HoopCheck is offline. Reconnect to load the latest basketball reviews.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
        );
      })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((response) => {
          if (response.ok && response.type === "basic") cache.put(request, response.clone());
          return response;
        });
        return cached || network;
      })
    );
  }
});
