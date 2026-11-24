import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const home = readFileSync(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
test("Home search morphs inside the existing pinned glass island without replacing account navigation", () => {
  const header = home.indexOf('styles.pinnedHeader');
  const field = home.indexOf('accessibilityLabel="Search basketball directory"');
  const scroll = home.indexOf('testID="dashboard-scroll"');
  assert.ok(header < field && field < scroll);
  assert.equal((home.match(/accessibilityLabel="Search basketball directory"/g) || []).length, 1);
  assert.match(home, /entering=\{reduced \? undefined : FadeIn.duration\(150\)\}/);
  assert.match(home, /setMenuOpen\(false\); setSearchOpen\(true\)/);
  assert.match(home, /scrollEnabled=\{!searchOpen\}/);
  assert.match(home, /accessibilityLabel="Cancel search" onPress=\{closeSearch\}/);
  assert.match(home, /params: \{ q: search \}/);
  assert.match(home, /accessibilityLabel="Open account menu"/);
});
