import assert from "node:assert/strict";
import test from "node:test";
import { nativeDestination } from "../src/native/deepLinks.ts";
import { readLinkedConversation } from "../src/native/hoopChatLink.ts";

const id = "10000000-0000-4000-8000-000000000001";
const owner = "10000000-0000-4000-8000-000000000002";
const peer = "10000000-0000-4000-8000-000000000003";
const row = { id, requester_id: peer, player_id: owner, status: "accepted", created_at: "2026-11-29T12:00:00Z" };
const bearer = "Bearer test";

function client(result) {
  return { rpc(name, args) {
    assert.equal(name, "resolve_hoopchat_destination");
    assert.deepEqual(args, { p_request_id: id });
    return {
      setHeader(name, value) {
        assert.equal(name, "Authorization");
        assert.equal(value, bearer);
        return this;
      },
      abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this; },
      async maybeSingle() { return result(); },
    };
  } };
}

test("native link accepts one conversation UUID and drops unrelated input", () => {
  assert.equal(nativeDestination(`hoopcheck://messages?conversation=${id}&next=evil`), `/messages?conversation=${id}`);
  assert.equal(nativeDestination(`/messages?conversation=${id}&conversation=${peer}`), "/messages");
  assert.equal(nativeDestination("/messages?conversation=invalid"), "/messages");
  assert.equal(nativeDestination(`https://example.com/messages?conversation=${id}`), "/");
});

test("opens only a verified, accepted, matching participant row", async () => {
  const signal = new AbortController().signal;
  assert.deepEqual(await readLinkedConversation(client(() => ({ data: row })), id, owner, bearer, signal), { ...row, message: null });
  for (const data of [null, { ...row, player_id: peer }, { ...row, status: "pending" }, { ...row, id: peer }]) {
    assert.equal(await readLinkedConversation(client(() => ({ data })), id, owner, bearer, signal), null);
  }
  assert.equal(await readLinkedConversation(client(() => ({ data: row, error: {} })), id, owner, bearer, signal), null);
});

test("drops an authorization response arriving after cancellation", async () => {
  const controller = new AbortController();
  assert.equal(await readLinkedConversation(client(() => {
    controller.abort();
    return { data: row };
  }), id, owner, bearer, controller.signal), null);
});
