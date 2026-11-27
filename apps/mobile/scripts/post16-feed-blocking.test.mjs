import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const source = readFileSync(new URL("../app/feed.tsx", import.meta.url), "utf8");
test("blocking is available for other authors even in ordinary HoopFeed", () => {
  assert.match(source, /\{post\.author_id !== uid && <Pressable accessibilityRole="button" accessibilityLabel="Block this HoopCheck account"/);
  assert.match(source, /!blocksVerified \|\| !isFeedId\(authorId\) \|\| authorId === uid/);
});
test("all feed modes require verified, account-scoped blocking and exclude blocked authors", () => {
  assert.match(source, /blocksVerified = focused && blockedCreators\.owner === uid && blockedCreators\.ready && !blockedCreators\.failed/);
  assert.match(source, /canRead && blocksVerified && rows\.scope === scope/);
  assert.match(source, /!blockedCreators\.ids\.includes\(post\.author_id\)/);
  assert.match(source, /data\.length > 500/);
  assert.match(source, /session\.session\.user\.id !== uid/);
  assert.match(source, /\[uid, canRead, focused, blocksVersion\]/);
});
test("blocking uses verified bearer and owner-scoped insert, then refreshes block list", () => {
  assert.match(source, /const accessToken = await token\(\)/);
  assert.match(source, /insert\(\{ blocker_id: uid, blocked_id: authorId \}\)\.setHeader/);
  assert.match(source, /setBlocksVersion\(version => version \+ 1\)/);
});
