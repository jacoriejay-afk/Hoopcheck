import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000";
const uid = "11111111-1111-4111-8111-111111111111";
const peer = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const thread = "44444444-4444-4444-8444-444444444444";
const deniedThread = "55555555-5555-4555-8555-555555555555";
const created_at = "2026-11-25T12:00:00+00:00";
const user = { id: uid, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at };
const exp = Math.floor(Date.now() / 1000) + 3600;
const part = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${part({ alg: "HS256" })}.${part({ sub: uid, role: user.role, exp })}.fixture`;
const session = { user, access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_at: exp, expires_in: 3600 };
const requests = [
  { id: thread, requester_id: uid, player_id: peer, status: "accepted", message: null, created_at },
  { id: deniedThread, requester_id: uid, player_id: other, status: "accepted", message: null, created_at },
];
const messages = Array.from({ length: 51 }, (_, index) => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${(51 - index).toString(16).padStart(12, "0")}`,
  request_id: thread, sender_id: peer, body: `Fixture message ${index + 1}`, created_at,
}));
const scopedReads = [];
let failNext = true;
let blocks = [];
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : { channel: "chrome" }),
  headless: true, args: ["--no-sandbox"],
});

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 850 }, serviceWorkers: "block" });
  await context.addCookies([{ name: "sb-ci-auth-token", value: "base64-" + part(session), url: baseURL }]);
  const page = await context.newPage();
  await page.route("https://ci.invalid/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const query = url.searchParams;
    const headers = {
      "access-control-allow-origin": baseURL,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": request.headers()["access-control-request-headers"] || "*",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    let data = [];
    let status = 200;
    if (url.pathname === "/auth/v1/user") data = user;
    if (url.pathname.endsWith("/player_contact_requests")) {
      // Simulate a thread revoked after loading the inbox.
      data = query.has("id") ? (query.get("id") === `eq.${thread}` ? [requests[0]] : []) : requests;
    }
    if (url.pathname.endsWith("/user_blocks") && query.get("blocker_id") === `eq.${uid}`) {
      data = blocks.filter(row => !query.has("blocked_id") || query.get("blocked_id") === `eq.${row.blocked_id}`);
    }
    if (url.pathname.endsWith("/profiles") && query.get("id")?.startsWith("in.")) {
      data = [{ id: peer, display_name: "Fixture Teammate" }, { id: other, display_name: "Fixture Revoked" }];
    }
    if (url.pathname.endsWith("/player_contact_messages") && query.has("request_id")) {
      scopedReads.push({ id: query.get("request_id"), order: query.get("order"), cursor: query.get("or"), bearer: request.headers().authorization });
      if (!query.get("request_id").startsWith("eq.")) data = messages.slice(0, 1);
      else if (failNext) {
        failNext = false;
        status = 503;
        data = { message: "Temporary fixture outage" };
      } else data = query.has("or") ? messages.slice(50) : messages.slice(0, 50);
    }
    await route.fulfill({ status, headers, json: data });
  });
  await page.goto(`${baseURL}/messages?thread=${thread}`);
  const history = page.getByRole("log");
  const loadOlder = history.getByRole("button", { name: "Load older messages" });
  await history.getByRole("button", { name: "Retry history" }).click();
  await loadOlder.click();
  await history.getByText("Fixture message 51", { exact: true }).waitFor();
  assert.equal(await history.locator("article").count(), 51);
  const pages = scopedReads.filter(read => read.id.startsWith("eq."));
  assert.equal(pages.length, 3);
  assert.ok(pages.every(read => read.id === `eq.${thread}` && read.order === "created_at.desc,id.desc" && read.bearer === `Bearer ${token}`));
  assert.ok(pages[2].cursor.includes(`id.lt.${messages[49].id}`));
  await page.getByRole("button", { name: /Fixture Revoked/ }).click();
  await history.getByText("Conversation unavailable.", { exact: true }).waitFor();
  assert.equal(await history.locator("article").count(), 0);
  assert.ok(!scopedReads.some(read => read.id === `eq.${deniedThread}`));
  blocks = [{ blocked_id: peer }];
  await page.getByRole("button", { name: /Fixture Teammate/ }).click();
  await history.getByText(/Check your blocked accounts/).waitFor();
  assert.equal(await history.locator("article").count(), 0);
  assert.equal(scopedReads.filter(read => read.id === `eq.${thread}`).length, 3);
  console.log("PASS web HoopChat pagination, retry, fixed caller, participant revocation and block handling");
} finally {
  await browser.close();
}
