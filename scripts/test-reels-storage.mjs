import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/reels-storage.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { makeReelObjectPath, matchesReelObjectPath, REELS_PRIVATE_VIDEO_BUCKET } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const owner = "550e8400-e29b-41d4-a716-446655440000";
const reel = "550e8400-e29b-41d4-a716-446655440001";
const other = "550e8400-e29b-41d4-a716-446655440002";
assert.equal(REELS_PRIVATE_VIDEO_BUCKET, "hoopfeed-private-videos");
assert.equal(makeReelObjectPath(owner, reel, "video/mp4"), `reels/${owner}/${reel}/original.mp4`);
assert.equal(makeReelObjectPath(owner, reel, "video/webm"), `reels/${owner}/${reel}/original.webm`);
assert.equal(makeReelObjectPath(owner, reel, "video/quicktime"), `reels/${owner}/${reel}/original.mov`);
assert.equal(matchesReelObjectPath(`reels/${owner}/${reel}/original.mp4`, owner, reel, "video/mp4"), true);
assert.equal(matchesReelObjectPath(`reels/${other}/${reel}/original.mp4`, owner, reel, "video/mp4"), false);
assert.equal(matchesReelObjectPath(`reels/${owner}/${reel}/../original.mp4`, owner, reel, "video/mp4"), false);
assert.equal(matchesReelObjectPath(`reels/${owner}/${reel}/original.mp4?download=1`, owner, reel, "video/mp4"), false);
assert.throws(() => makeReelObjectPath("../escape", reel, "video/mp4"));
assert.throws(() => makeReelObjectPath(owner, reel, "image/svg+xml"));
console.log("REELS-1 private storage path tests passed");
