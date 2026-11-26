import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { nativeDestination } from "../src/native/deepLinks.ts";
import { legalDocuments } from "../src/native/legalDocuments.ts";
import { bindAuthIntents, createAuthIntents } from "../../../lib/auth/auth-intents.ts";

test("implemented account and legal destinations never bounce to the website", () => {
  for (const path of ["/account/network", "/account/career-history", "/account/owner-hq", "/account/ambassador-hq", "/messages", "/about", "/forgot-password", "/sign-in", "/sign-up"]) {
    assert.equal(nativeDestination("https://hoopcheck.online" + path), path);
  }
  assert.equal(nativeDestination("/owner-hq"), "/account/owner-hq");
  assert.equal(nativeDestination("/ambassador-hq"), "/account/ambassador-hq");
  for (const document of Object.keys(legalDocuments)) {
    assert.equal(nativeDestination("/" + document), "/legal?document=" + document);
  }
});
test("recovery links preserve only recognized fields", () => {
  assert.equal(nativeDestination("hoopcheck://reset-password?token_hash=fixture&type=recovery&redirect=https://evil.example"), "/reset-password?token_hash=fixture&type=recovery");
  assert.equal(nativeDestination("hoopcheck://reset-password?token_hash=fixture&type=signup"), "/reset-password");
  assert.equal(nativeDestination("hoopcheck://auth/callback?token_hash=fixture&type=recovery"), "/auth/callback");
  assert.equal(nativeDestination("hoopcheck://reset-password#access_token=secret&error_code=otp_expired"), "/reset-password?error_code=otp_expired");
  assert.equal(nativeDestination("hoopcheck://reset-password?code=a&code=b"), "/reset-password");
});
test("bundled legal wording matches the website", () => {
  for (const [key, policy] of Object.entries(legalDocuments)) {
    const source = readFileSync(new URL("../../../app/" + key + "/page.tsx", import.meta.url), "utf8");
    const card = source.split('<div className="legal-card">')[1].split('<div className="legal-footer">')[0];
    const content = [...card.matchAll(/<(h2|p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map(m => ({ kind: m[1], text: m[2].replace(/\s+/g, " ").trim() }));
    assert.deepEqual(policy.content, content);
  }
});
test("recovery update is denied for a different user or session and signs out only on success", async () => {
  const session = (owner, id) => ({ user: { id: owner }, access_token: "fixture." + Buffer.from(JSON.stringify({ session_id: id })).toString("base64url") + ".fixture" });
  let current = session("A", "first"), updates = 0, signouts = 0;
  const auth = {
    signInWithPassword: async () => ({}), signUp: async () => ({}), setSession: async () => ({}), exchangeCodeForSession: async () => ({}),
    signOut: async () => { signouts++; return { error: null }; },
    getSession: async () => ({ data: { session: current }, error: null }),
    updateUser: async () => { updates++; return { error: null }; },
  };
  bindAuthIntents(auth, createAuthIntents());
  const update = auth[Symbol.for("hoopcheck.recovery-password")];
  assert.ok((await update("B", "first", "fixture-only")).error);
  assert.ok((await update("A", "second", "fixture-only")).error);
  current = session("A", "second");
  assert.ok((await update("A", "first", "fixture-only")).error);
  assert.equal(updates, 0);
  assert.equal(signouts, 0);
  assert.equal((await update("A", "second", "fixture-only")).error, null);
  assert.equal(updates, 1);
  assert.equal(signouts, 1);
});
