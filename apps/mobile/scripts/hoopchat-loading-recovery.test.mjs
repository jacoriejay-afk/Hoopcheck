import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { hoopChatAuthAction, withHoopChatDeadline } from "../src/native/hoopChatLoad.ts";

const screen = readFileSync(new URL("../app/messages.tsx", import.meta.url), "utf8");

test("HoopChat must ignore harmless initial-session and token-refresh auth events", () => {
  for (const event of ["INITIAL_SESSION", "TOKEN_REFRESHED", "USER_UPDATED", "MFA_CHALLENGE_VERIFIED"]) {
    assert.equal(hoopChatAuthAction(event, "owner", "owner"), "ignore", event);
  }
  assert.equal(hoopChatAuthAction("SIGNED_IN", "owner", "owner"), "ignore");
  assert.equal(hoopChatAuthAction("SIGNED_IN", "owner", "other-owner"), "reload");
  assert.equal(hoopChatAuthAction("SIGNED_IN", null, "owner"), "reload");
  assert.equal(hoopChatAuthAction("SIGNED_IN", null, null), "ignore");
  assert.equal(hoopChatAuthAction("SIGNED_OUT", "owner", null), "clear");
  assert.equal(hoopChatAuthAction("SIGNED_OUT", null, null), "clear");
});

test("HoopChat resolves a successful contact fetch and cleans up its abort signal", async () => {
  let signal;
  const rows = await withHoopChatDeadline(async requestSignal => {
    signal = requestSignal;
    assert.equal(signal.aborted, false);
    return [{ id: "request" }];
  }, 200);
  assert.deepEqual(rows, [{ id: "request" }]);
  assert.equal(signal.aborted, true, "The completed request cannot keep a stale listener active");
});

test("HoopChat times out a stuck request and permits an independent retry", async () => {
  let signal;
  await assert.rejects(withHoopChatDeadline(async requestSignal => {
    signal = requestSignal;
    return await new Promise(() => {});
  }, 12), /Conversations are taking too long.*Refresh/);
  assert.equal(signal.aborted, true);
  const answer = await withHoopChatDeadline(async () => "recovered", 100);
  assert.equal(answer, "recovered");
});

test("HoopChat propagates genuine request errors and rejects invalid deadlines", async () => {
  await assert.rejects(withHoopChatDeadline(async () => { throw Error("RLS rejected"); }, 120), /RLS rejected/);
  await assert.rejects(withHoopChatDeadline(async () => "ok", 0), /Invalid conversation timeout/);
});

test("The private HoopChat UI is generation guarded and aborts all PostgREST reads", () => {
  assert.match(screen, /withHoopChatDeadline\(async signal =>/);
  assert.match(screen, /if \(revision !== generation\.current\) return/);
  assert.match(screen, /if \(revision === generation\.current\) setLoading\(false\)/);
  assert.match(screen, /hoopChatAuthAction\(event, authIdentity\.current, nextUserId\)/);
  assert.match(screen, /if \(action === "ignore"\) return/);
  assert.match(screen, /if \(action === "clear"\)/);
  assert.match(screen, /setTimeout\(\(\) => \{/);
  assert.match(screen, /\.eq\("player_id",userId\)/, "Player approval remains owner-scoped");
  assert.match(screen, /selected\.status!=="accepted"/, "Message send remains accepted-connection-only");
  assert.equal((screen.match(/\.abortSignal\(signal\)/g) ?? []).length, 3,
    "Contact requests, accepted conversation history and profile labels all support abort");
});
