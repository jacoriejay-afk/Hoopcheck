import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("HoopChat starts with inbox and requires explicit, mode-scoped thread selection", () => {
  const chat = read("../app/messages.tsx");
  assert.match(chat, /const \[openedId, setOpenedId\] = useState\(""\)/);
  assert.match(chat, /selected\.id === openedId && openedMode === mode/);
  assert.match(chat, /!opened&&visibleThreads\.length>0/);
  assert.match(chat, /opened&&selected/);
  assert.match(chat, /accessibilityLabel="Back to conversations"/);
  assert.doesNotMatch(chat, /<ScrollView horizontal/);
  assert.match(chat, /selected\.status!=="accepted" \|\| !opened/);
  assert.match(chat, /selected\.status!=="pending" \|\| !opened/);
  assert.match(chat, /actionGeneration!==generation\.current \|\| !focused\.current/);
  assert.match(chat, /setUserId\(""\); setSelectedId\(""\); setOpenedId\(""\); setDraft\(""\)/);
});
test("Home sections have bounded waits and preserve caller identity checks", () => {
  const home = read("../components/HomeCourtside.tsx");
  assert.match(home, /withHoopChatDeadline\(\(\) => supabase\.auth\.getSession\(\), 5000\)/);
  assert.match(home, /Promise\.allSettled/);
  assert.match(home, /withHoopChatDeadline\(\(\) => readBasketballSide/);
  assert.match(home, /withHoopChatDeadline\(\(\) => readFeedPage/);
  assert.match(home, /after\.data\.session\?\.user\.id !== uid/);
  assert.match(home, /snapshot\?\.scope===scope/);
  assert.match(home, /current\?\.scope === scope \? Object\.fromEntries/);
});
test("Logo loading uses a named crest fallback without a spinner", () => {
  const art = read("../components/EntityArtwork.tsx");
  assert.match(art, /!loaded \? <View pointerEvents="none"/);
  assert.match(art, /opacity: loaded \? 1 : 0/);
  assert.match(art, /if \(failed\) return <DirectoryCrest/);
  assert.doesNotMatch(art, /ActivityIndicator/);
  assert.match(art, /value\.protocol === "https:"/);
});
