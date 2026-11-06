import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const staticRoot = path.join(root, ".next", "static");
const manifestPaths = [
  path.join(root, ".next", "build-manifest.json"),
  path.join(root, ".next", "app-build-manifest.json"),
];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return null; }
}

function collectStrings(value, out = []) {
  if (typeof value === "string" && value.endsWith(".js")) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

function gzipKb(relative) {
  const full = path.join(staticRoot, relative.replace(/^\/+/, ""));
  try { return gzipSync(fs.readFileSync(full)).byteLength / 1024; }
  catch { return 0; }
}

const manifests = manifestPaths.map(readJson).filter(Boolean);
if (!manifests.length) {
  console.error("Bundle audit: Next.js build manifests were not found. Run after next build.");
  process.exitCode = 1;
} else {
  const routeFiles = new Map();
  for (const manifest of manifests) {
    const pages = manifest.pages || {};
    for (const [route, files] of Object.entries(pages)) {
      const collected = collectStrings(files);
      const current = routeFiles.get(route) || new Set();
      collected.forEach((file) => current.add(file));
      routeFiles.set(route, current);
    }
  }

  const targets = [
    { label: "Homepage", keys: ["/", "/page"] , env: "BUNDLE_BUDGET_HOME_KB" },
    { label: "Club profile", keys: ["/teams/[id]/page", "/teams/[id]"], env: "BUNDLE_BUDGET_CLUB_KB" },
    { label: "HoopFeed", keys: ["/feed/page", "/feed"], env: "BUNDLE_BUDGET_FEED_KB" },
  ];
  let failed = false;
  console.log("\nHoopCheck first-load JavaScript (gzip, route manifest assets)");
  for (const target of targets) {
    const files = new Set();
    for (const key of target.keys) for (const file of routeFiles.get(key) || []) files.add(file);
    if (!files.size) {
      console.log(`- ${target.label}: route entry not found in build manifests`);
      continue;
    }
    const kb = [...files].reduce((sum, file) => sum + gzipKb(file), 0);
    const budget = Number(process.env[target.env]);
    const status = Number.isFinite(budget) && budget > 0 ? (kb > budget ? "OVER BUDGET" : "within budget") : "baseline";
    console.log(`- ${target.label}: ${kb.toFixed(1)} KB gzip across ${files.size} JS files (${status})`);
    if (Number.isFinite(budget) && budget > 0 && kb > budget) failed = true;
  }

  const allJs = new Set();
  for (const files of routeFiles.values()) for (const file of files) allJs.add(file);
  const largest = [...allJs].map((file) => ({ file, kb: gzipKb(file) })).sort((a, b) => b.kb - a.kb).slice(0, 5);
  console.log("\nFive largest emitted JavaScript chunks:");
  largest.forEach((item) => console.log(`- ${item.kb.toFixed(1)} KB gzip  ${item.file}`));
  if (failed) process.exitCode = 1;
}
