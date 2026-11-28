import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { markServerChatRead, readServerChatCounts } from "../src/native/hoopChatReadSync.ts";

const thread = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const message = "33333333-3333-4333-8333-333333333333";

function fixture(payload) {
  const calls = [];
  const client = createClient("https://fixture.supabase.co", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      calls.push({ url: new URL(String(input)), init, body: JSON.parse(init.body) });
      return Response.json(payload);
    } },
  });
  const controller = new AbortController();
  return { calls, client, controller, session: { bearer: "Bearer fixture-token", signal: controller.signal } };
}

test("unread sync binds exact caller and requested thread IDs", async () => {
  const f = fixture([{ request_id: thread, unread_count: 100 }]);
  const counts = await readServerChatCounts(f.client, [thread, thread], f.session);
  assert.equal(counts.get(thread), 100);
  assert.equal(f.calls[0].url.pathname, "/rest/v1/rpc/get_hoopchat_unread");
  assert.equal(new Headers(f.calls[0].init.headers).get("authorization"), f.session.bearer);
  assert.deepEqual(f.calls[0].body, { p_request_ids: [thread] });
  assert.equal((await readServerChatCounts(f.client, [], f.session)).size, 0);
  assert.equal(f.calls.length, 1);
});

test("unread sync rejects unexpected, duplicate and out-of-range responses", async () => {
  for (const rows of [
    [{ request_id: other, unread_count: 1 }],
    [{ request_id: thread, unread_count: 1 }, { request_id: thread, unread_count: 2 }],
    [{ request_id: thread, unread_count: 101 }],
  ]) {
    const f = fixture(rows);
    await assert.rejects(readServerChatCounts(f.client, [thread], f.session));
  }
});

test("mark read requires server acknowledgment and accepts only validated IDs", async () => {
  const f = fixture(true);
  await markServerChatRead(f.client, thread, message, f.session);
  assert.equal(f.calls[0].url.pathname, "/rest/v1/rpc/mark_hoopchat_read");
  assert.equal(new Headers(f.calls[0].init.headers).get("authorization"), f.session.bearer);
  assert.deepEqual(f.calls[0].body, { p_request_id: thread, p_message_id: message });
  await assert.rejects(markServerChatRead(f.client, thread, "invalid", f.session));
  f.controller.abort();
  await assert.rejects(markServerChatRead(f.client, thread, message, f.session));
  assert.equal(f.calls.length, 1);
  const denied = fixture(false);
  await assert.rejects(markServerChatRead(denied.client, thread, message, denied.session));
});
