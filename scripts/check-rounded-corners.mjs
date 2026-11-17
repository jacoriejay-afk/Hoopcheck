import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const root = readFileSync("app/hoopcheck-theme-tokens.css", "utf8");
const tailwind = readFileSync("tailwind.config.ts", "utf8");
const stylesheets = [
  "app/globals.css",
  "app/hoopcheck-unified-layout.css",
  "app/hoopcheck-flow.css",
];

for (const [token, value] of Object.entries({
  "--radius-sm": "12px",
  "--radius-md": "16px",
  "--radius-lg": "20px",
})) {
  assert.match(root, new RegExp(token + "\\s*:\\s*" + value.replace(".", "\\.") + "\\s*;"), token + " missing");
  assert.ok(!root.includes(token + ": " + value + ";\\n"), token + " has escaped newline");
}

for (const name of ["sm", "md", "lg", "xl", "2xl", "3xl"]) {
  assert.ok(tailwind.includes(name + ': "var(--hc-radius-') || tailwind.includes('"' + name + '": "var(--hc-radius-'), "Missing Tailwind radius: " + name);
}
assert.ok(!tailwind.includes("\\n"), "Tailwind config contains literal escaped newlines");

for (const path of stylesheets) {
  const css = readFileSync(path, "utf8");
  for (const match of css.matchAll(/border-radius\s*:\s*([^;}\n]+)/g)) {
    assert.ok(!/var\([^)]*\)\s+\d/.test(match[1]), path + ": inspect malformed radius " + match[1]);
  }
}
console.log("Rounded corner token checks passed.");
