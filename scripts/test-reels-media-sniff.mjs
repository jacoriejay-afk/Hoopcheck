import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/reels-media-sniff.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { detectReelContainer, matchesReelContainer } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const ascii = (text) => Uint8Array.from(Buffer.from(text, "latin1"));
const mp4 = ascii("\x00\x00\x00\x18ftypisom");
const mov = ascii("\x00\x00\x00\x18ftypqt  ");
const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]);
assert.equal(detectReelContainer(mp4), "video/mp4");
assert.equal(detectReelContainer(mov), "video/quicktime");
assert.equal(detectReelContainer(webm), "video/webm");
assert.equal(detectReelContainer(Uint8Array.from([0x1a,0x45,0xdf,0xa3,0x9f,0,0,0,0,0,0,0])), null, "generic EBML must not pass as WebM");
assert.equal(matchesReelContainer(mp4, "video/mp4"), true);
assert.equal(matchesReelContainer(mp4, "video/webm"), false);
assert.equal(detectReelContainer(ascii("<html>bad</html>")), null);
assert.equal(detectReelContainer(new Uint8Array()), null);
assert.equal(detectReelContainer(ascii("\x00\x00\x00\x18nopeisom")), null);
console.log("REELS-1 container signature tests passed");
