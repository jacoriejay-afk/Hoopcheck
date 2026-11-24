import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("Live border is decorative and limited to fresh featured games with foreground and reduced-motion guards", () => {
  const score = read("../components/Scoreboard.tsx");
  assert.match(score, /const live = state.isLive/);
  assert.match(score, /const showBorder = featured && live/);
  assert.match(score, /running=\{active && !reduced\}/);
  assert.match(score, /cancelAnimation\(phase\)/);
  assert.match(score, /strokeDashoffset/);
  assert.match(score, /pointerEvents="none"/);
  assert.match(read("../components/HomeCourtside.tsx"), /featured=\{index === 0\} active=\{active\}/);
  const live = read("../app/fan-live.tsx");
  assert.match(live, /<Scoreboard game=\{game\}[^>]+featured active=\{active\}/);
  assert.doesNotMatch(live, /<Scoreboard game=\{item\}[^>]+featured/);
});
