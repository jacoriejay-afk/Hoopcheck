import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const compiled = ts.transpileModule(source("../src/native/reelDraft.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.length || 0, 0);
const out = {};
new Function("require", "exports", compiled.outputText)(id => {
  assert.equal(id, "./mediaClient");
  return { REEL_TOPICS: ["Practice", "Game Day", "Challenge", "Win", "Teammates", "Culture", "Travel"] };
}, out);
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
function localStorage() {
  const rows = new Map();
  return {
    rows, getItem: async key => rows.get(key) ?? null,
    setItem: async (key, value) => { rows.set(key, value); },
    removeItem: async key => { rows.delete(key); },
  };
}
test("caption drafts are stored per verified account, not uploaded or shared as video URLs", async () => {
  const storage = localStorage();
  await out.writeReelCaptionDraft(storage, owner, { caption: "Summer league jumper", topic: "Practice" });
  assert.notEqual(out.reelDraftKey(owner), out.reelDraftKey(other));
  assert.deepEqual(await out.readReelCaptionDraft(storage, other), { caption: "", topic: "" });
  assert.deepEqual(await out.readReelCaptionDraft(storage, owner), { caption: "Summer league jumper", topic: "Practice" });
  assert.doesNotMatch(storage.rows.get(out.reelDraftKey(owner)), /file:|content:|storage\/v1/);
  await out.clearReelCaptionDraft(storage, owner);
  assert.equal(storage.rows.has(out.reelDraftKey(owner)), false);
});
test("invalid, oversized or malicious draft fields never hydrate or persist", async () => {
  const storage = localStorage();
  for (const invalid of ["null", "[1,2]", "{}", "{not-json}", JSON.stringify({ caption: "a", topic: "Unverified" }), JSON.stringify({ caption: "x".repeat(2001), topic: "Game Day" })]) {
    storage.rows.set(out.reelDraftKey(owner), invalid);
    assert.deepEqual(await out.readReelCaptionDraft(storage, owner), { caption: "", topic: "" });
  }
  await assert.rejects(out.writeReelCaptionDraft(storage, owner, { caption: "text", topic: "Unverified" }), /Invalid Reel draft/);
  assert.throws(() => out.reelDraftKey("not-a-uuid"), /Invalid Reel draft account/);
});

test("Creator Studio enforces the existing membership and own-Reel RLS path", () => {
  const studio = source("../app/reels/studio.tsx");
  const composer = source("../components/MediaPostComposer.tsx");
  const client = source("../src/native/mediaClient.ts");
  const feed = source("../app/feed.tsx");
  const layout = source("../app/_layout.tsx");
  assert.match(studio, /account\?\.features\.canWriteHoopFeed/);
  assert.match(studio, /\.eq\("author_id", owner\)\.eq\("status", "approved"\)\.not\("video_url", "is", null\)/);
  assert.match(studio, /\.delete\(\)\.eq\("id", postId\)\.eq\("author_id", owner\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(studio, /data\?\.id !== postId/);
  assert.match(studio, /Alert\.alert\("Delete this Reel\?"/);
  assert.match(studio, /readReelCaptionDraft\(AsyncStorage, owner\)/);
  assert.match(studio, /clearReelCaptionDraft\(AsyncStorage, userId\)/);
  assert.match(composer, /videoOnly/);
  assert.match(composer, /<FeedVideo uri=\{video\.uri\}/);
  assert.match(client, /form\.append\("topic_tag", topicTag\)/);
  assert.match(feed, /router\.push\("\/reels\/studio"\)/);
  assert.match(layout, /name="reels\/studio"/);
});
