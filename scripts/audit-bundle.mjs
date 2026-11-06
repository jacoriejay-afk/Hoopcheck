import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const appPathsFile = path.join(nextDir, "server", "app-paths-manifest.json");
const appPaths = (() => {
  try { return JSON.parse(fs.readFileSync(appPathsFile, "utf8")); }
  catch { return null; }
})();

function walkClientJs(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkClientJs(fullPath, files);
    else if (entry.isFile() && /\.(?:js|mjs|cjs)$/i.test(entry.name)) files.push(fullPath);
  }
  return files;
}

if (!appPaths) {
  console.error("Bundle audit: Next.js app-paths manifest is missing or unreadable.");
  process.exit(1);
}

const requiredRoutes = [
  { label: "Homepage", key: "/page" },
  { label: "Club profile", key: "/teams/[id]/page" },
  { label: "HoopFeed", key: "/feed/page" },
];
const missingRoutes = requiredRoutes.filter(({ key }) => !Object.hasOwn(appPaths, key));
if (missingRoutes.length) {
  console.error("Bundle audit: expected app routes are missing from app-paths manifest:");
  missingRoutes.forEach(({ label, key }) => console.error(`- ${label}: ${key}`));
  process.exit(1);
}

const clientAssetDirectory = path.join(nextDir, "static");
const chunks = walkClientJs(clientAssetDirectory).map((file) => {
  const bytes = fs.readFileSync(file);
  return {
    file: path.relative(nextDir, file).split(path.sep).join("/"),
    kb: gzipSync(bytes).byteLength / 1024,
  };
}).sort((a, b) => b.kb - a.kb);

if (!chunks.length) {
  console.error("Bundle audit: no emitted client JavaScript assets were found under .next/static (checked .js, .mjs and .cjs files).");
  process.exit(1);
}

const totalKb = chunks.reduce((sum, chunk) => sum + chunk.kb, 0);
console.log("\\nHoopCheck production client JavaScript (gzip)");
console.log(`- Total emitted client chunks: ${totalKb.toFixed(1)} KB across ${chunks.length} files`);
console.log("- Route manifest checks:");
requiredRoutes.forEach(({ label, key }) => console.log(`  - ${label}: present (${appPaths[key]})`));
console.log("\\nFive largest emitted JavaScript chunks (not package attribution):");
chunks.slice(0, 5).forEach(({ file, kb }) => console.log(`- ${kb.toFixed(1)} KB gzip  ${file}`));

for (const [label, envName] of [
  ["Homepage", "BUNDLE_BUDGET_HOME_KB"],
  ["Club profile", "BUNDLE_BUDGET_CLUB_KB"],
  ["HoopFeed", "BUNDLE_BUDGET_FEED_KB"],
]) {
  const budget = Number(process.env[envName]);
  if (Number.isFinite(budget) && budget > 0) {
    console.log(`- ${label} route budget ${envName}=${budget} KB is configured; route-level chunk attribution is not available from Next.js 16 app-paths manifest and is not inferred.`);
  }
}
