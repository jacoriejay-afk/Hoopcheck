import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const manifestPaths = [
  path.join(nextDir, "build-manifest.json"),
  path.join(nextDir, "app-build-manifest.json"),
];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return null; }
}

function collectJs(value, out = new Set()) {
  if (typeof value === "string" && value.endsWith(".js")) out.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectJs(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectJs(item, out));
  return out;
}

function resolveAsset(relative) {
  const normalized = relative.replace(/^\/+/, "");
  // Next manifests commonly store paths beginning with "static/"; others store
  // paths relative to .next/static. Resolve both without duplicating the segment.
  return normalized.startsWith("static/")
    ? path.join(nextDir, normalized)
    : path.join(nextDir, "static", normalized);
}

function gzipKb(relative) {
  try { return gzipSync(fs.readFileSync(resolveAsset(relative))).byteLength / 1024; }
  catch { return null; }
}

const manifests = manifestPaths.map(readJson).filter(Boolean);
if (!manifests.length) {
  console.error("Bundle audit: Next.js build manifests were not found. Run after next build.");
  process.exitCode = 1;
} else {
  const routeFiles = new Map();
  for (const manifest of manifests) {
    for (const [route, files] of Object.entries(manifest.pages || {})) {
      const current = routeFiles.get(route) || new Set();
      for (const file of collectJs(files)) current.add(file);
      routeFiles.set(route, current);
    }
  }

  const targets = [
    { label: "Homepage", keys: ["/", "/page"], env: "BUNDLE_BUDGET_HOME_KB" },
    { label: "Club profile", keys: ["/teams/[id]/page", "/teams/[id]"], env: "BUNDLE_BUDGET_CLUB_KB" },
    { label: "HoopFeed", keys: ["/feed/page", "/feed"], env: "BUNDLE_BUDGET_FEED_KB" },
  ];
  let missing = false;
  console.log("\nHoopCheck first-load JavaScript (gzip; unique route manifest assets)");
  for (const target of targets) {
    const files = new Set();
    for (const key of target.keys) for (const file of routeFiles.get(key) || []) files.add(file);
    if (!files.size) {
      console.error(`- ${target.label}: route entry missing (checked ${target.keys.join(", ")})`);
      missing = true;
      continue;
    }
    const sizes = [...files].map((file) => ({ file, kb: gzipKb(file) }));
    const unreadable = sizes.filter((item) => item.kb === null);
    if (unreadable.length) {
      console.error(`- ${target.label}: ${unreadable.length} manifest assets could not be read`);
      missing = true;
    }
    const kb = sizes.reduce((sum, item) => sum + (item.kb ?? 0), 0);
    const budget = Number(process.env[target.env]);
    const status = Number.isFinite(budget) && budget > 0
      ? (kb > budget ? "OVER BUDGET" : "within budget")
      : "baseline (budget not configured)";
    console.log(`- ${target.label}: ${kb.toFixed(1)} KB gzip / ${files.size} JS files (${status})`);
    if (Number.isFinite(budget) && budget > 0 && kb > budget) {
      console.warn(`  WARNING: ${target.env} is ${budget} KB; measured ${kb.toFixed(1)} KB.`);
    }
  }

  const allJs = new Set();
  for (const files of routeFiles.values()) for (const file of files) allJs.add(file);
  const largest = [...allJs]
    .map((file) => ({ file, kb: gzipKb(file) }))
    .filter((item) => item.kb !== null)
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 5);
  console.log("\nFive largest emitted JavaScript chunks (not package attribution):");
  largest.forEach((item) => console.log(`- ${item.kb.toFixed(1)} KB gzip  ${item.file}`));
  if (missing) process.exitCode = 1;
}
