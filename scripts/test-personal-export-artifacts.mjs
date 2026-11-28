import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPersonalExportArtifacts } from "../lib/server/personal-export-staging.ts";

const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const requestId = "10000000-0000-4000-8000-000000000003";
const signal = new AbortController().signal;

async function collect(reader) {
  const buffers = [];
  for await (const buffer of reader) buffers.push(buffer);
  return Buffer.concat(buffers);
}

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "hoopcheck-artifact-test-"));
  const plan = { ownerId: owner, requestId, expiresAt: new Date(Date.now() + 60000).toISOString(),
    byteLimit: 262144, policyVersion: "fixture", sections: [{ name: "account", fields: ["name"] }] };
  const readers = { account: async () => ({ hasMore: false, rows: [{ id: "1", ownerId: owner, data: { name: "Personal fixture" } }] }) };
  try { await run({ root, plan, readers }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test("persistent export survives worker restart and concurrent generators publish one receipt", async () => {
  await fixture(async ({ root, plan, readers }) => {
    const authorize = async () => true;
    const worker = createPersonalExportArtifacts(root, authorize);
    const first = await worker.generate(plan, readers, signal);
    const retry = createPersonalExportArtifacts(root, authorize);
    assert.deepEqual(await retry.generate(plan, {}, signal), first);
    const body = await collect(retry.read(plan, owner, signal));
    assert.match(body.toString(), /Personal fixture/);
    assert.equal(createHash("sha256").update(body).digest("hex"), first.sha256);

    const second = { ...plan, requestId: other };
    const concurrent = await Promise.all([worker.generate(second, readers, signal), retry.generate(second, readers, signal)]);
    assert.deepEqual(concurrent, [first, first]);
    assert.equal((await readdir(root)).length, 2);
  });
});

test("wrong owner, changed plan, revoked authorization and cancellation fail closed", async () => {
  await fixture(async ({ root, plan, readers }) => {
    let allowed = true;
    const worker = createPersonalExportArtifacts(root, async () => allowed);
    await worker.generate(plan, readers, signal);
    await assert.rejects(collect(worker.read(plan, other, signal)), /^Error: Personal export unavailable\.$/);
    await assert.rejects(collect(worker.read({ ...plan, policyVersion: "different" }, owner, signal)), /unavailable/);
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(collect(worker.read(plan, owner, cancelled.signal)), /unavailable/);
    allowed = false;
    await assert.rejects(collect(worker.read(plan, owner, signal)), /unavailable/);
    await assert.rejects(worker.generate(plan, readers, signal), /unavailable/);
  });
});

test("only approved recorded expiration permits cleanup and closes delivery immediately", async () => {
  await fixture(async ({ root, plan, readers }) => {
    let now = Date.now();
    const worker = createPersonalExportArtifacts(root, async () => true, () => now);
    await worker.generate(plan, readers, signal);
    assert.equal(await worker.expire(plan, signal), false);
    now = Date.parse(plan.expiresAt);
    await assert.rejects(collect(worker.read(plan, owner, signal)), /unavailable/);
    assert.equal(await worker.expire(plan, signal), true);
    assert.equal(await worker.expire(plan, signal), true);
    assert.deepEqual(await readdir(root), []);
  });
});
