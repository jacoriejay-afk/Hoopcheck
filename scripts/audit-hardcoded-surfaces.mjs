import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["app", "components", "lib", "apps", "public"];
const ignoredFiles = new Set([
  "app/hoopcheck-theme-tokens.css",
  "components/Logo.tsx",
]);
const allowedTileSelector = /(?:logo|avatar|photo|portrait|image)[\w-]*(?:tile|wrap|frame|image|photo|avatar|portrait)?/i;
const rules = [
  ["utility bg-white", /(?:^|[\\s"'\x60])bg-white(?:$|[\\s"'\x60])/i],
  ["utility bg-neutral-50", /(?:^|[\\s"'\x60])bg-neutral-50(?:$|[\\s"'\x60])/i],
  ["utility bg-[#fff]", /bg-\\[#(?:fff|ffffff)\\]/i],
  ["inline white backgroundColor", /backgroundColor\\s*:\\s*(?:["']white["']|["']#(?:fff|ffffff)["']|white\\b|#(?:fff|ffffff)\\b)/i],
  ["hardcoded white background", /background(?:-color)?\\s*:\\s*(?:white\\b|#(?:fff|ffffff)\\b|rgb\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*\\))/i],
];

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\\.(?:tsx?|jsx?|css|html)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files = (await Promise.all(sourceRoots.map(walk))).flat();
const matches = [];
for (const file of files) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  if (ignoredFiles.has(relative) || /(?:^|\\/)(?:node_modules|\.next|dist|build|coverage)(?:\\/|$)/.test(relative)) continue;
  const lines = (await readFile(file, "utf8")).split(/\\r?\\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const context = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 2)).join(" ");
    if (allowedTileSelector.test(context) && /(?:logo|avatar|photo|portrait|image)/i.test(context)) continue;
    for (const [kind, regex] of rules) {
      if (regex.test(line)) matches.push({ file: relative, line: i + 1, kind, source: line.trim() });
    }
  }
}
if (matches.length) {
  console.error("HARDCODED_SURFACE_AUDIT=FAIL");
  for (const item of matches) console.error(`${item.file}:${item.line}: [${item.kind}] ${item.source}`);
  console.error(`TOTAL_MATCHES=${matches.length}`);
  process.exitCode = 1;
} else {
  console.log("HARDCODED_SURFACE_AUDIT=PASS");
  console.log("TOTAL_MATCHES=0");
}
