import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compileFunction } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

const source = readFileSync(new URL("../app/api/admin/reel-moderation/route.ts", import.meta.url), "utf8");
const compiled = compileFunction(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, ["require", "exports", "process", "console"]);
const POST_ID = "11111111-1111-4111-8111-111111111111";
const TICKET_ID = "22222222-2222-4222-8222-222222222222";
const REASON = "Independently reviewed the reported video and documented a clear community-rule violation.";
const requestBody = { postId: POST_ID, ticketId: TICKET_ID, reason: REASON };

function fixture({
  bearer = "signed-test-session", authenticated = true, moderator = true,
  roleError = null, serviceResult = true, serviceError = null,
  hasEnv = true, payload = requestBody, contentLength, invalidJson = false,
} = {}) {
  const events = [];
  const publicDb = {
    auth: { getUser: async (token) => {
      events.push(["getUser", token]);
      return { data: { user: authenticated ? { id: "fixture-moderator" } : null },
        error: authenticated ? null : { code: "expired" } };
    } },
    rpc: async (functionName) => {
      events.push(["role", functionName]);
      return { data: moderator, error: roleError };
    },
  };
  const staffDb = {
    rpc: async (functionName, args) => {
      events.push(["service", functionName, args]);
      return { data: serviceResult, error: serviceError };
    },
  };
  const outputs = {};
  compiled((id) => {
    if (id === "next/server") return { NextResponse };
    if (id === "@supabase/supabase-js") return { createClient: (_url, key, options) => {
      events.push(["createClient", key]);
      if (key === "test-publishable") {
        assert.equal(options.global.headers.Authorization, "Bearer " + bearer);
        return publicDb;
      }
      if (key === "server-only-service") return staffDb;
      throw new Error("Unknown fixture key");
    } };
    throw new Error("Unexpected import: " + id);
  }, outputs, { env: {
    NEXT_PUBLIC_SUPABASE_URL: hasEnv ? "https://example.invalid" : undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: hasEnv ? "test-publishable" : undefined,
    SUPABASE_SERVICE_ROLE_KEY: hasEnv ? "server-only-service" : undefined,
  } }, { error() { events.push(["server-error"]); } });

  const request = new Request("https://localhost/api/admin/reel-moderation", {
    method: "POST",
    headers: {
      ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
      "Content-Type": "application/json",
      ...(contentLength ? { "Content-Length": String(contentLength) } : {}),
    },
    body: invalidJson ? "{invalid" : JSON.stringify(payload),
  });
  return { events, submit: () => outputs.POST(request) };
}

test("an unauthenticated request is rejected without any database access", async () => {
  const app = fixture({ bearer: "" });
  const response = await app.submit();
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(app.events, []);
});

test("missing server configuration fails closed", async () => {
  const app = fixture({ hasEnv: false });
  assert.equal((await app.submit()).status, 503);
  assert.deepEqual(app.events, []);
});

test("expired or invalid sessions never create a service-role client", async () => {
  const app = fixture({ authenticated: false });
  assert.equal((await app.submit()).status, 401);
  assert.ok(app.events.some(event => event[0] === "getUser"));
  assert.ok(!app.events.some(event => event[0] === "service" || event[1] === "server-only-service"));
});

test("ordinary users and authorization RPC failures cannot moderate", async () => {
  for (const config of [{ moderator: false }, { moderator: true, roleError: { code: "PGRST" } }]) {
    const app = fixture(config);
    assert.equal((await app.submit()).status, 403);
    assert.ok(!app.events.some(event => event[0] === "service" || event[1] === "server-only-service"));
  }
});

test("moderation requires a valid reported Reel and substantive evidence", async () => {
  for (const payload of [
    { ...requestBody, postId: "not-a-uuid" },
    { ...requestBody, ticketId: "bad" },
    { ...requestBody, reason: "short" },
    { ...requestBody, reason: "a".repeat(1001) },
    { ...requestBody, reason: 5 },
    [],
  ]) {
    const app = fixture({ payload });
    assert.equal((await app.submit()).status, 400);
    assert.ok(!app.events.some(event => event[0] === "service"));
  }
  const malformed = fixture({ invalidJson: true });
  assert.equal((await malformed.submit()).status, 400);
  assert.ok(!malformed.events.some(event => event[0] === "service"));
});

test("oversized request is rejected before JWT and database work", async () => {
  const app = fixture({ contentLength: 4097 });
  assert.equal((await app.submit()).status, 413);
  assert.deepEqual(app.events, []);
});

test("verified staff can request one atomic, audited hide with exact actor and ticket", async () => {
  const app = fixture();
  const response = await app.submit();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).hidden, true);
  const calls = app.events.filter(event => event[0] === "service");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "hide_approved_reel_for_moderation");
  assert.deepEqual(calls[0][2], {
    p_reel_id: POST_ID,
    p_moderator_id: "fixture-moderator",
    p_reason: REASON,
    p_support_ticket_id: TICKET_ID,
  });
});

test("already-hidden or absent videos never report successful moderation", async () => {
  const app = fixture({ serviceResult: false });
  assert.equal((await app.submit()).status, 409);
});

test("database failures return a generic service error without leaking details", async () => {
  const app = fixture({ serviceError: { code: "PGRST202", message: "internal secret" } });
  const response = await app.submit();
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("internal secret"));
  assert.equal(app.events.filter(event => event[0] === "service").length, 1);
});
