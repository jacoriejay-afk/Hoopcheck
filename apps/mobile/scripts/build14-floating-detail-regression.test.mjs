import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("detail routes opt in to transparent header only with safe-area scroll clearance", () => {
  const layout = read("../app/_layout.tsx");
  for (const route of ["players/[id]", "teams/[id]", "leagues/[id]", "womens/[id]", "womens/leagues/[id]"]) {
    const screen = read("../app/" + route + ".tsx");
    const config = layout.split("\n").find(line => line.includes('name="' + route + '"'));
    assert.ok(config?.includes("headerTransparent: true"), route);
    assert.match(screen, /const insets = useSafeAreaInsets\(\)/);
    assert.match(screen, /paddingTop: insets\.top \+ 62, paddingBottom: 100/);
  }
  assert.ok(!layout.split("\n").find(line => line.includes('name="teams/[id]/review"'))?.includes("headerTransparent: true"));
});
test("team and league identity is a flat section, not an outlined hero card", () => {
  const hero = read("../components/EntityHero.tsx");
  assert.match(hero, /backgroundColor: "transparent", borderBottomWidth: 1/);
  assert.doesNotMatch(hero, /borderTopWidth/);
  assert.match(hero, /<ShareSheet title=\{name\} path=\{path\}/);
});
test("compact score rows preserve provider freshness and unavailable scores", () => {
  const scoreboard = read("../components/Scoreboard.tsx");
  const games = read("../app/fan-live.tsx");
  assert.match(scoreboard, /size=\{28\}/);
  assert.match(scoreboard, /score \?\? "—"/);
  assert.match(scoreboard, /providerReceiptLabel\(game\.score_updated_at, nowMs\)/);
  assert.doesNotMatch(games, /<CourtsideBanner/);
  assert.doesNotMatch(games, /<PressableCard/);
  assert.match(games, /<Scoreboard game=\{item\}/);
});
