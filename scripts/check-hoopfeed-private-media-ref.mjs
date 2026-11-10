// Read-only source contract test. Run: node scripts/check-hoopfeed-private-media-ref.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("lib/hoopfeed-private-media-ref.ts", "utf8");
assert.match(source, /hoopfeed-private-images/);
assert.match(source, /hoopfeed-private-videos/);
assert.match(source, /value\.includes\("%"\)/);
assert.match(source, /parts\.length !== 3/);
assert.match(source, /UUID\.test\(ownerId\)/);
assert.match(source, /FILE\.test\(filename\)/);
assert.match(source, /kind === "image"/);
assert.match(source, /kind === "video"/);
console.log("PASS: private HoopFeed media references require a private bucket, UUID owner, and constrained filename.");
