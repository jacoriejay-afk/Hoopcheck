// Behavioral regression test for private HoopFeed media reference parsing.
// Run: node scripts/check-hoopfeed-private-media-ref.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("lib/hoopfeed-private-media-ref.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { parseHoopFeedPrivateMediaRef: parse } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const owner = "11111111-1111-4111-8111-111111111111";
const file = "22222222-2222-4222-8222-222222222222";
const image = `hoopfeed-private-images/${owner}/${file}.jpg`;
const video = `hoopfeed-private-videos/${owner}/${file}.mp4`;
assert.deepEqual(parse(image), { kind: "image", bucket: "hoopfeed-private-images", ownerId: owner, path: `${owner}/${file}.jpg` });
assert.deepEqual(parse(video), { kind: "video", bucket: "hoopfeed-private-videos", ownerId: owner, path: `${owner}/${file}.mp4` });
for (const bad of [
  "", null, 123, "https://example.com/" + image, "feed-images/" + owner + "/" + file + ".jpg",
  `hoopfeed-private-images/${owner}/../${file}.jpg`,
  `hoopfeed-private-images/${owner}/${file}.mp4`,
  `hoopfeed-private-videos/${owner}/${file}.jpg`,
  image + "?download=1", image + "#fragment", image.replace("/", "%2F"),
  image.replace("/", "\\\\"), image.replace(owner, "not-an-owner"),
  image.replace(file, "not-a-uuid"), image + "/extra",
  image.replace(".jpg", ".svg"), image.replace(".jpg", ".jpg.exe"),
]) assert.equal(parse(bad), null, `Unsafe media reference accepted: ${String(bad)}`);
console.log("PASS: valid private media references accepted; malformed, public and cross-type references rejected.");
