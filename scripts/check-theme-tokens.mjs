#!/usr/bin/env node
/**
 * Theme-token guard.
 * Checks newly added lines in the current commit so legacy styling debt does not
 * make the guard unusable, while blocking new hard-coded surface colors/classes.
 * Put literal palette values in app/hoopcheck-preview-system.css token declarations.
 */
import { execFileSync } from "node:child_process";

let diff = "";
try {
  diff = execFileSync("git", ["diff", "--unified=0", "HEAD^", "HEAD", "--", "app", "components"], { encoding: "utf8" });
} catch {
  console.error("Theme-token guard could not inspect the previous commit. Ensure CI checks out at least 2 commits.");
  process.exit(1);
}
let currentFile = "";
const errors = [];
for (const line of diff.split("\n")) {
  const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
  if (fileMatch) { currentFile = fileMatch[1]; continue; }
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  const added = line.slice(1);
  if (/\bbg-white\b|\btext-black\b/.test(added)) errors.push(`${currentFile}: added bg-white/text-black utility; use theme tokens.`);
  if (!/^\s*--[\w-]+\s*:\s*#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i.test(added) && /(?:background(?:-color)?|color|border(?:-color)?|outline-color)\s*:\s*["']?\s*#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i.test(added)) {
    errors.push(`${currentFile}: added raw hex color outside the token stylesheet; use a CSS variable.`);
  }
  if (/style=\{\{[^}]*\b(?:background|backgroundColor|color|borderColor)\s*:\s*["']#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})/i.test(added)) {
    errors.push(`${currentFile}: added inline raw hex color; use a theme token.`);
  }
}
if (errors.length) {
  console.error("Theme-token guard failed:\n" + [...new Set(errors)].join("\n"));
  process.exit(1);
}
console.log("Theme-token guard passed: no newly introduced hardcoded surface colors or bg-white/text-black utilities.");
