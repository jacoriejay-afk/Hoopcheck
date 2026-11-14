import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/reels-validation.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { validateReelInput, REEL_MAX_BYTES } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const valid = { mimeType: "video/mp4", bytes: 1024, durationSeconds: 30, caption: "Game day", tag: null };
const check = (changes) => validateReelInput({ ...valid, ...changes });

assert.equal(check({}), null, "valid video");
assert.equal(check({ bytes: REEL_MAX_BYTES }), null, "100 MB boundary accepted");
assert.equal(check({ durationSeconds: 90 }), null, "90 second boundary accepted");
assert.equal(check({ caption: "a".repeat(300) }), null, "300-character boundary accepted");
for (const mimeType of ["video/mp4", "video/webm", "video/quicktime"])
  assert.equal(check({ mimeType }), null, mimeType + " accepted");
for (const bytes of [0, -1, REEL_MAX_BYTES + 1, 1.5, Number.NaN])
  assert.ok(check({ bytes }), "invalid byte count rejected: " + bytes);
for (const durationSeconds of [0, -1, 90.001, Infinity, Number.NaN])
  assert.ok(check({ durationSeconds }), "invalid duration rejected: " + durationSeconds);
assert.ok(check({ caption: "a".repeat(301) }), "long caption rejected");
assert.ok(check({ mimeType: "text/html" }), "invalid MIME rejected");
assert.equal(check({ tag: { type: "club", id: "550e8400-e29b-41d4-a716-446655440000" } }), null, "valid tag accepted");
assert.ok(check({ tag: { type: "club", id: "not-a-uuid" } }), "invalid tag rejected");
assert.ok(check({ tag: { type: "admin", id: "550e8400-e29b-41d4-a716-446655440000" } }), "unknown tag type rejected");

console.log("REELS-1 input validation checks passed");
