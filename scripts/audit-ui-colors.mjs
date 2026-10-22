#!/usr/bin/env node
/**
 * HoopCheck UI source guard.
 * Run with: npm run audit:ui
 * Literal colors are permitted only in app/hoopcheck-theme-tokens.css and
 * explicit brand/logo assets/constants. Migrate reported component styles to
 * semantic --hc-* tokens before making this a required CI check.
 */
const fs = require("node:fs");
const path = require("node:path");

const roots = ["app", "components", "lib"];
const allowedFiles = new Set([
  path.normalize("app/hoopcheck-theme-tokens.css"),
]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".scss"]);
const rules = [
  ["Tailwind fixed surface/text utility", /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)(?:\b|\/)/g],
  ["Tailwind arbitrary color utility", /\b(?:bg|text|border|ring|fill|stroke)-\[(?:#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\()/g],
  ["Hex color literal", /#[0-9a-fA-F]{3,8}\b/g],
  ["RGB/HSL color literal", /\b(?:rgba?|hsla?)\(\s*[-\d.]+/g],
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "generated") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (extensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of roots.flatMap(root => walk(root))) {
  const relative = path.normalize(file);
  if (allowedFiles.has(relative)) continue;
  const source = fs.readFileSync(file, "utf8");
  source.split(/\r?\n/).forEach((line, index) => {
    for (const [label, pattern] of rules) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        violations.push({ file: relative, line: index + 1, label, sample: line.trim().slice(0, 180) });
        break;
      }
    }
  });
}
if (violations.length) {
  console.error(`UI color audit failed: ${violations.length} potential hardcoded-color violation(s).\n`);
  for (const item of violations) {
    console.error(`${item.file}:${item.line} — ${item.label}\n  ${item.sample}`);
  }
  console.error("\nMove component colors to semantic theme tokens. Review brand/logo constants separately.");
  process.exitCode = 1;
} else {
  console.log("UI color audit passed: no hardcoded color patterns found in app/components/lib.");
}
