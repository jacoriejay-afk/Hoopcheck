import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(source) {
  return "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText).toString("base64");
}
const source = name => readFileSync(new URL("../lib/server/" + name + ".ts", import.meta.url), "utf8");
const { createStoryVideoCleanupTick } = await import(moduleUrl(
  source("story-video-cleanup").replace('"./account-deletion-cleanup"', JSON.stringify(moduleUrl(source("account-deletion-cleanup")))),
));

const ownerId = "10000000-0000-4000-8000-000000000001";
const jobId = "10000000-0000-4000-8000-000000000002";
const fence = "10000000-0000-4000-8000-000000000003";
const path = `story-quarantine/${ownerId}/${jobId}.mp4`;
const bucket = "hoopfeed-private-videos";
const original = { id: fence, ownerId, bucket, path, version: "immutable" };
const signal = new AbortController().signal;

function fixture(overrides = {}) {
  const files = new Map([[path, original]]);
  const calls = { deletes: [], claims: 0, finished: 0 };
  const job = { id: jobId, ownerId, fence, eligibleAt: new Date(Date.now() - 1000).toISOString(),
    policyVersion: "fixture-policy", reason: "rejected", objects: [original], ...overrides };
  const repository = {
    async claim() { calls.claims++; return job; },
    async assertLease() {},
    async assertClosedForWrites() {},
    async readObject(_job, key) { return files.get(key) ?? null; },
    async assertNoRemainingObjects() { assert.equal(files.size, 0); },
    async finish(_job, receipt) { assert.equal(receipt, "media_verified"); calls.finished++; return true; },
  };
  const client = { storage: { from(name) {
    assert.equal(name, bucket);
    return { async remove([key]) { calls.deletes.push(key); files.delete(key); return { error: null }; } };
  } } };
  return { client, repository, calls, files };
}

test("job-scoped purge is default-off, verifies absence and retries without repeating deletion", async () => {
  const { client, repository, calls } = fixture();
  assert.equal(await createStoryVideoCleanupTick(client, repository)(signal), "disabled");
  assert.equal(calls.claims, 0);
  const tick = createStoryVideoCleanupTick(client, repository, true);
  assert.equal(await tick(signal), "completed");
  assert.equal(await tick(signal), "completed");
  assert.deepEqual(calls.deletes, [path]);
  assert.equal(calls.finished, 2);
});

test("unexpired, out-of-scope, unclosed and replaced assets cannot be removed", async () => {
  const scenarios = [
    fixture({ eligibleAt: new Date(Date.now() + 60000).toISOString() }),
    fixture({ objects: [{ ...original, path: path.replace(jobId, fence) }] }),
    fixture(),
    fixture(),
  ];
  scenarios[2].repository.assertClosedForWrites = async () => { throw Error("Outstanding upload"); };
  scenarios[3].files.set(path, { ...original, version: "replacement" });
  for (const { client, repository, calls } of scenarios) {
    assert.equal(await createStoryVideoCleanupTick(client, repository, true)(signal), "unconfirmed");
    assert.deepEqual(calls.deletes, []);
    assert.equal(calls.finished, 0);
  }
});
