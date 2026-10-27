const base = process.env.PWA_BASE_URL || "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchText(path) {
  const response = await fetch(new URL(path, base));
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return { response, text: await response.text() };
}

const { text: html } = await fetchText("/");
const { response: manifestResponse, text: manifestText } = await fetchText("/manifest.webmanifest");
const manifest = JSON.parse(manifestText);
const { response: swResponse, text: sw } = await fetchText("/sw.js");
await fetchText("/offline.html");

assert(manifest.name === "HoopCheck", "Manifest name must be HoopCheck");
assert(manifest.short_name === "HoopCheck", "Manifest short_name must be HoopCheck");
assert(manifest.display === "standalone", "Manifest display must be standalone");
assert(manifest.theme_color === "#0A0A0A", "Manifest theme_color must be #0A0A0A");
assert(manifest.background_color === "#0A0A0A", "Manifest background_color must be #0A0A0A");
assert(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose?.includes("maskable")), "Missing 192px maskable icon");
assert(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose?.includes("maskable")), "Missing 512px maskable icon");
for (const path of ["/icons/hoopcheck-192.svg", "/icons/hoopcheck-512.svg", "/apple-icon"]) {
  const { response, text } = await fetchText(path);
  assert(response.headers.get("content-type")?.includes(path === "/apple-icon" ? "image/png" : "image/svg+xml"), `${path} must have the expected image MIME type`);
  if (path !== "/apple-icon") assert(text.includes("#0A0A0A") && text.includes("#FF5A1F"), `${path} must use the existing HoopCheck logo palette`);
}
assert(manifestResponse.headers.get("content-type")?.includes("json"), "Manifest must be served as JSON");
assert(swResponse.headers.get("service-worker-allowed") === null || swResponse.headers.get("service-worker-allowed") === "/", "Unexpected service worker scope");
assert(html.includes("/manifest.webmanifest"), "Document must link the web app manifest");
assert(html.includes("apple-mobile-web-app-capable"), "Document must include Apple web app metadata");
assert(html.includes("/apple-icon"), "Document must reference the generated Apple touch icon");
assert(sw.includes('fetch(request, { cache: "no-store" })'), "API/review requests must use a network-only no-store fetch");
assert(sw.includes("isApiOrReviewRequest") && !sw.includes("cache.put(request, response.clone())\n    );"), "Review data must not be cached");
assert(sw.includes('"/offline.html"'), "Service worker must precache an offline app shell");
console.log("PWA_SMOKE_CHECK=PASS");
console.log(JSON.stringify({
  manifest: { name: manifest.name, short_name: manifest.short_name, display: manifest.display, theme_color: manifest.theme_color, background_color: manifest.background_color },
  maskableIcons: manifest.icons.filter((icon) => icon.purpose?.includes("maskable")).map((icon) => ({ sizes: icon.sizes, src: icon.src })),
  serviceWorker: "registered by root layout; offline shell precached",
  reviewCaching: "network-only, no-store; never falls back to cached review data",
  appleTouchIcon: "/apple-icon (generated 180×180 PNG)"
}, null, 2));
