import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const manifestPath = resolve(".next/server/app-build-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pages = manifest.pages || {};
const routeTargets = [
  { route: "Home", keys: ["/page", "/"] },
  { route: "Search", keys: ["/search/page", "/search"] },
  { route: "Team Detail", keys: ["/teams/[id]/page", "/teams/[id]"] },
];

function format(bytes) {
  return (bytes / 1024).toFixed(1) + " KiB";
}

const results = [];
for (const target of routeTargets) {
  const key = target.keys.find((candidate) => Array.isArray(pages[candidate]));
  if (!key) {
    throw new Error(`App build manifest is missing the ${target.route} route. Available keys: ${Object.keys(pages).join(", ")}`);
  }
  const files = [...new Set(pages[key].filter((file) => typeof file === "string" && file.endsWith(".js")))];
  const sizes = await Promise.all(files.map(async (file) => {
    const path = resolve(".next", file.replace(/^\/+/, ""));
    const contents = await readFile(path);
    return { file, raw: contents.byteLength, gzip: gzipSync(contents).byteLength };
  }));
  const rawBytes = sizes.reduce((sum, item) => sum + item.raw, 0);
  const gzipBytes = sizes.reduce((sum, item) => sum + item.gzip, 0);
  results.push({ route: target.route, manifestKey: key, jsFiles: files.length, rawBytes, gzipBytes, raw: format(rawBytes), gzip: format(gzipBytes) });
}

await mkdir("artifacts/performance", { recursive: true });
await writeFile("artifacts/performance/route-bundles.json", JSON.stringify(results, null, 2) + "\n");
console.log("FIRST_LOAD_JS_ROUTE_MEASUREMENTS");
for (const result of results) {
  console.log(`${result.route}: ${result.gzip} gzip / ${result.raw} raw (${result.jsFiles} JS files)`);
}
