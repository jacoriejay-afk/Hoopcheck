import assert from "node:assert/strict";
import test from "node:test";
import { createChatPushReceipts, reconcileChatPush } from "../src/native/chatPushLifecycle.ts";

const denied = { granted: false, canAskAgain: true };
const granted = { granted: true, canAskAgain: true };
function port(options = {}) {
  const calls = [];
  const adapter = {
    preference: async () => { calls.push("preference"); return true; },
    permission: async () => { calls.push("permission"); return denied; },
    requestPermission: async () => { calls.push("prompt"); return granted; },
    token: async () => { calls.push("token"); return "synthetic"; },
    sync: async value => { calls.push(value); },
    ...options,
  };
  return { adapter, calls };
}

test("only explicit opt-in prompts; existing permission registers and refreshes the token", async () => {
  const signal = new AbortController().signal;
  const { adapter, calls } = port();
  await reconcileChatPush(adapter, false, signal);
  assert.deepEqual(calls, ["preference", "permission", null]);
  await reconcileChatPush(adapter, true, signal);
  await reconcileChatPush({ ...adapter, permission: async () => granted }, false, signal);
  assert.deepEqual(calls.slice(3), ["preference", "permission", "prompt", "token", "synthetic", "preference", "token", "synthetic"]);
});

test("opt-out and revoked permissions never obtain a provider token", async () => {
  const { adapter, calls } = port({ preference: async () => false });
  await reconcileChatPush(adapter, true, new AbortController().signal);
  assert.deepEqual(calls, [null]);
  const permanentlyDenied = port({ permission: async () => ({ ...denied, canAskAgain: false }) });
  await reconcileChatPush(permanentlyDenied.adapter, true, new AbortController().signal);
  assert.deepEqual(permanentlyDenied.calls, ["preference", null]);
});

test("account switch or timeout discards a token obtained after cancellation", async () => {
  const controller = new AbortController();
  const { adapter, calls } = port({ permission: async () => granted, token: async () => {
    controller.abort();
    return "stale";
  } });
  await reconcileChatPush(adapter, false, controller.signal);
  assert.deepEqual(calls, ["preference"]);
});

test("foreground and tap receipts accept only the generic notification hint", () => {
  const receive = createChatPushReceipts();
  assert.equal(receive("id", { path: "https://example.com" }), false);
  assert.equal(receive("id", { path: "/notifications", message: "private" }), false);
  assert.equal(receive("id", { path: "/notifications" }), true);
  assert.equal(receive("id", { path: "/notifications" }), false);
});
