import assert from "node:assert/strict";
import test from "node:test";
import { createGroupOutbox } from "../src/native/hoopGroupsOutbox.ts";

const owner = "10000000-0000-4000-8000-000000000001";
const channel = "10000000-0000-4000-8000-000000000002";
const id = "10000000-0000-4000-8000-000000000003";
const other = "10000000-0000-4000-8000-000000000004";
const message = { owner, channel, id, body: "See you on court", replyTo: other };

function fixture() {
  const data = new Map();
  const storage = {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
    removeItem: async key => { data.delete(key); },
  };
  return { data, storage, outbox: createGroupOutbox(storage) };
}

test("restart recovers exact delivery identity and reply only in its original scope", async () => {
  const { storage, outbox } = fixture();
  await outbox.save(message);
  const restarted = createGroupOutbox(storage);
  assert.deepEqual(await restarted.load(owner, channel), message);
  assert.equal(await restarted.load(other, channel), null);
  assert.equal(await restarted.load(owner, other), null);
});

test("concurrent saves cannot replace an uncertain send and a stale removal cannot clear it", async () => {
  const { outbox } = fixture();
  const replacement = { ...message, id: other, replyTo: undefined, body: "New message" };
  const results = await Promise.allSettled([outbox.save(message), outbox.save(replacement)]);
  assert.deepEqual(results.map(row => row.status), ["fulfilled", "rejected"]);
  await outbox.remove(replacement);
  assert.deepEqual(await outbox.load(owner, channel), message);
  await outbox.remove(message);
  await outbox.save(replacement);
  assert.equal((await outbox.load(owner, channel)).id, other);
});

test("changed owner and corrupt persisted rows cannot be recovered", async () => {
  const { data, outbox } = fixture();
  await outbox.save(message);
  const [key] = data.keys();
  data.set(key, JSON.stringify({ ...message, owner: other }));
  await assert.rejects(outbox.load(owner, channel), /could not be verified/);
  data.set(key, "truncated");
  await assert.rejects(outbox.load(owner, channel));
});
