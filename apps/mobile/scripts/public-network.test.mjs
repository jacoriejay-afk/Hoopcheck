import test from "node:test";
import assert from "node:assert/strict";
import { filterPublicNetwork, parsePublicNetwork, readPublicNetwork } from "../src/native/publicNetwork.ts";
const id = "12345678-1234-4123-8123-123456789abc";
const id2 = "12345678-1234-4123-8123-123456789abd";
const agent = { id, display_name: "Court Agency", country: "Portugal", account_type: "agent", agency_name: "Court", experience_summary: "Placement", identity_checked: true, professionally_reviewed: false };
const creator = { profile_id: id, category: "podcast", headline: "Basketball stories", profiles: { id, display_name: "Court Talk", country: "USA", private_email: "private@example.test" }, identity_checked: true };
test("public projections retain explicit review status and exclude private or unrecognized fields", () => {
  const [entry] = parsePublicNetwork({ people: [{ ...agent, private_email: "private@example.test" }] }, "agents");
  assert.equal(entry.identityChecked, true);
  assert.equal(entry.professionallyReviewed, false);
  assert.equal(entry.agency, "Court");
  assert.equal("private_email" in entry, false);
  const [showcase] = parsePublicNetwork({ creators: [creator] }, "creators");
  assert.equal(showcase.name, "Court Talk");
  assert.equal(showcase.identityChecked, false);
  assert.equal(showcase.professionallyReviewed, false);
  assert.equal("profiles" in showcase, false);
});
test("only matching opted-in API records are searchable and reviewed is not inferred from identity", () => {
  const rows = parsePublicNetwork({ people: [agent, { ...agent, id: id2, display_name: "Reviewed Scout", account_type: "scout", professionally_reviewed: true }] }, "agents");
  assert.deepEqual(filterPublicNetwork(rows, "portugal", "reviewed").map(x => x.id), [id2]);
  assert.deepEqual(filterPublicNetwork(rows, "court", "agent").map(x => x.id), [id]);
  assert.deepEqual(filterPublicNetwork(parsePublicNetwork({ creators: [creator] }, "creators"), "podcaster", "all").map(x => x.id), [id]);
});
test("malformed, duplicated, mismatched and unsupported profiles fail closed", () => {
  for (const payload of [{}, { people: [agent, agent] }, { people: [{ ...agent, account_type: "player" }] }, { people: [{ ...agent, id: "invalid" }] }]) assert.throws(() => parsePublicNetwork(payload, "agents"));
  assert.throws(() => parsePublicNetwork({ creators: [{ ...creator, profiles: { ...creator.profiles, id: id2 } }] }, "creators"));
  assert.throws(() => parsePublicNetwork({ creators: [{ ...creator, category: "__proto__" }] }, "creators"));
});
test("public directory read omits credentials, rejects redirects, validates HTTPS and fails on unavailable API", async () => {
  const controller = new AbortController();
  const result = await readPublicNetwork("https://hoopcheck.online", "agents", controller.signal, async (url, options) => {
    assert.equal(url, "https://hoopcheck.online/api/network/agents");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    assert.equal(options.signal, controller.signal);
    assert.equal(options.headers, undefined);
    return Response.json({ people: [agent] });
  });
  assert.equal(result.length, 1);
  const never = async () => { throw new Error("unexpected"); };
  for (const origin of ["http://hoopcheck.online", "https://a:b@hoopcheck.online", "https://hoopcheck.online/other"]) await assert.rejects(readPublicNetwork(origin, "agents", undefined, never), /Invalid directory/);
  await assert.rejects(readPublicNetwork("https://hoopcheck.online", "creators", undefined, async () => new Response("", { status: 503 })), /unavailable/);
});
