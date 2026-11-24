import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const file = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("33: glass search is in-place on Home and Search reuses directory ACL", () => {
  const header = file("components/glass/GlassHeader.tsx");
  const home = file("app/dashboard.tsx");
  const search = file("app/search.tsx");
  assert.match(header, /withTiming\(searchOpen \? 1 : 0, \{ duration: 150 \}\)/);
  assert.match(header, /searchProgress\.get\(\)/);
  assert.match(header, /accessibilityLabel="Cancel search"/);
  assert.match(header, /accessibilityLabel="Search basketball directory"/);
  assert.match(home, /onSearchCancel=\{\(\) => setSearchExpanded\(false\)\}/);
  assert.match(home, /scrollEnabled=\{!searchExpanded\}/);
  assert.match(search, /searchDirectory\(supabase, term, includePlayers\)/);
  assert.match(search, /canBrowsePlayers/);
  assert.match(search, /<GlassHeader searchOpen=\{searchExpanded\}/);
});

test("31: live animation uses existing freshness gate, visibility and reduce motion", () => {
  const score = file("components/Scoreboard.tsx");
  const games = file("app/fan-live.tsx");
  const liveBadge = file("components/glass/GlassBadge.tsx");
  assert.match(score, /isFreshLive\(game\.status/);
  assert.match(score, /live && animateLive && !reduced/);
  assert.match(score, /cancelAnimation\(borderPhase\)/);
  assert.match(games, /visibleGames\.has\(item\.id\)/);
  assert.match(games, /onViewableItemsChanged=\{onGamesViewable\}/);
  assert.match(liveBadge, /if \(status !== "live" \|\| !scoreUpdatedAt\) return false/);
});

test("40: verified new-message entrances and local drafting only; no fabricated peer typing", () => {
  const shared = file("components/chat/ChatMotion.tsx");
  const messages = file("app/messages.tsx");
  const gameChat = file("components/GameChat.tsx");
  assert.match(shared, /duration: incoming \? 320 : 160/);
  assert.match(shared, /Math\.sin\(Math\.PI \* p\)/);
  assert.match(shared, /active && !reduced/);
  assert.match(shared, /LOCAL draft/);
  assert.match(gameChat, /seen\.current\.ready/);
  assert.match(messages, /seenMessages\.current\.ready/);
  assert.match(gameChat, /readGameRoom\(supabase, gameId, userId\)/);
  assert.match(messages, /ChatTypingBasketball/);
});

test("collapsed search has no read-only textbox; returning to Search restores input",()=>{assert.match(file("components/glass/GlassHeader.tsx"),/\{searchOpen \? <Animated.View pointerEvents="auto"/);assert.match(file("app/search.tsx"),/useFocusEffect\(useCallback\(\(\) => \{\s*setSearchExpanded\(true\)/);assert.match(file("components/glass/GlassHeader.tsx"),/if \(feedMode\)/);});
