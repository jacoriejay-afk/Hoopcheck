import assert from "node:assert/strict";
import { test } from "node:test";
import {
  courtChoices, defaultCourtActions, normalizeCourtActions, toggleCourtAction,
} from "../src/native/myCourtActions.ts";

const free = { feed: false, hoopgroups: false };
const eligible = { feed: true, hoopgroups: true };

test("My Court selects compact role-specific defaults from verified features", () => {
  assert.deepEqual(defaultCourtActions("player", eligible), ["teams", "live", "chat", "feed"]);
  assert.deepEqual(defaultCourtActions("player", free), ["teams", "live", "chat", "clubgroups"]);
  assert.deepEqual(defaultCourtActions("fan", free), ["live", "clubgroups", "teams", "chat"]);
  assert.deepEqual(defaultCourtActions("scout", free), ["players", "leagues", "chat", "teams"]);
  assert.equal(courtChoices("player", free).some(action => action.id === "feed"), false);
  assert.equal(courtChoices("player", free).some(action => action.id === "hoopgroups"), false);
});

test("My Court restores only allowlisted, currently enabled actions", () => {
  assert.deepEqual(normalizeCourtActions(["hoopgroups", "feed", "live", "live", "players", "/admin", "chat"], "fan", free), ["live", "players", "chat"]);
  assert.deepEqual(normalizeCourtActions(["hoopgroups", "feed", "live", "players", "chat"], "player", eligible), ["hoopgroups", "feed", "live", "players"]);
  assert.deepEqual(normalizeCourtActions('["teams"]', "player", free), defaultCourtActions("player", free));
  assert.deepEqual(normalizeCourtActions(["/admin"], "player", free), defaultCourtActions("player", free));
  assert.equal(normalizeCourtActions(new Array(100).fill("teams"), "player", free).length, 1);
});

test("My Court edit keeps one to four destinations and preserves chosen order", () => {
  let selected = ["teams"];
  selected = toggleCourtAction(selected, "teams", "player", free);
  assert.deepEqual(selected, ["teams"]);
  selected = toggleCourtAction(selected, "live", "player", free);
  assert.deepEqual(selected, ["teams", "live"]);
  selected = toggleCourtAction(selected, "chat", "player", free);
  selected = toggleCourtAction(selected, "clubgroups", "player", free);
  assert.equal(selected.length, 4);
  assert.deepEqual(toggleCourtAction(selected, "players", "player", free), selected);
  assert.deepEqual(toggleCourtAction(selected, "feed", "player", free), selected);
  assert.deepEqual(toggleCourtAction(selected, "teams", "player", free), ["live", "chat", "clubgroups"]);
});
