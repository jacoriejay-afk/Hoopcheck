import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000";
const testReadSync = process.env.HOOPCHECK_TEST_CHAT_READ_SYNC === "true";
if (testReadSync && !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)) {
  throw Error("Use a loopback server for the read-sync fixture.");
}
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
const reports = [], blockWrites = [], messageWrites = [];
const markerWrites = [];
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
    if (url.pathname.endsWith("/rpc/get_hoopchat_unread")) {
      assert.equal(testReadSync, true);
      assert.equal(request.headers().authorization, `Bearer ${token}`);
      const { p_request_ids } = request.postDataJSON();
      assert.ok(p_request_ids.every(id => [thread, deniedThread].includes(id)));
      data = p_request_ids.includes(thread) ? [{ request_id: thread, unread_count: markerWrites.length ? 0 : 7 }] : [];
    }
    if (url.pathname.endsWith("/rpc/mark_hoopchat_read")) {
      assert.equal(testReadSync, true);
      assert.equal(request.headers().authorization, `Bearer ${token}`);
      markerWrites.push(request.postDataJSON());
      data = true;
    }
    if (url.pathname.endsWith("/player_contact_requests")) {
      // Simulate a thread revoked after loading the inbox.
      data = query.has("id") ? (query.get("id") === `eq.${thread}` ? [requests[0]] : []) : requests;
    }
    if (url.pathname.endsWith("/support_tickets") && request.method() === "POST") {
      assert.equal(request.headers().authorization, `Bearer ${token}`);
      reports.push(request.postDataJSON());
      return route.fulfill({ status: 201, headers, json: [] });
    }
    if (url.pathname.endsWith("/user_blocks") && request.method() === "POST") {
      assert.equal(request.headers().authorization, `Bearer ${token}`);
      const row = request.postDataJSON();
      assert.deepEqual(row, { blocker_id: uid, blocked_id: peer });
      blockWrites.push(row); blocks.push({ blocked_id: row.blocked_id });
      return route.fulfill({ status: 201, headers, json: [] });
    }
    if (url.pathname.endsWith("/user_blocks") && query.get("blocker_id") === `eq.${uid}`) {
      data = blocks.filter(row => !query.has("blocked_id") || query.get("blocked_id") === `eq.${row.blocked_id}`);
    }
    if (url.pathname.endsWith("/profiles") && query.get("id")?.startsWith("in.")) {
      data = [{ id: peer, display_name: "Fixture Teammate" }, { id: other, display_name: "Fixture Revoked" }];
    }
    if (url.pathname.endsWith("/player_contact_messages") && request.method() === "POST") {
      messageWrites.push(request.postDataJSON());
      return route.fulfill({ status: 201, headers, json: [] });
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
  if (testReadSync) {
    const badge = page.locator(".hc-courtside-unread");
    await page.getByText("7 new in loaded inbox", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Mark read", exact: true }).click();
    await badge.waitFor({ state: "hidden" });
    assert.deepEqual(markerWrites, [{ p_request_id: thread, p_message_id: messages[0].id }]);
  }
  const composer = page.locator("#hc-courtside-compose");
  await composer.fill("My unsent reply");
  await history.locator("article").filter({ has: page.getByText("Fixture message 51", { exact: true }) }).getByRole("button", { name: /Quote message from/ }).click();
  assert.equal(await composer.inputValue(), "> Fixture message 51\n\nMy unsent reply");
  assert.equal(messageWrites.length, 0, "Quote action must not publish a message");
  await composer.fill("");
  const safety = page.getByRole("region", { name: "Conversation safety" });
  await safety.getByRole("button", { name: "Report conversation" }).click();
  await safety.getByLabel("Conversation report reason").fill("Fixture safety concern");
  await safety.getByRole("button", { name: "Submit confidential report" }).click();
  await safety.getByRole("status").filter({ hasText: "Confidential report submitted" }).waitFor();
  assert.equal(reports.length, 1);
  assert.equal(reports[0].requester_id, uid);
  assert.match(reports[0].description, new RegExp(thread));
  assert.match(reports[0].description, new RegExp(peer));
  await page.getByRole("button", { name: /Fixture Revoked/ }).click();
  await history.getByText("Conversation unavailable.", { exact: true }).waitFor();
  assert.equal(await history.locator("article").count(), 0);
  assert.ok(!scopedReads.some(read => read.id === `eq.${deniedThread}`));
  await safety.getByRole("button", { name: "Report conversation" }).click();
  await safety.getByLabel("Conversation report reason").fill("Revoked thread fixture");
  await safety.getByRole("button", { name: "Submit confidential report" }).click();
  await safety.getByRole("status").filter({ hasText: "Action could not be confirmed" }).waitFor();
  assert.equal(reports.length, 1);
  const beforeBlockedRead = scopedReads.filter(read => read.id === `eq.${thread}`).length;
  blocks = [{ blocked_id: peer }];
  await page.getByRole("button", { name: /Fixture Teammate/ }).click();
  await history.getByText(/Check your blocked accounts/).waitFor();
  assert.equal(await history.locator("article").count(), 0);
  assert.equal(scopedReads.filter(read => read.id === `eq.${thread}`).length, beforeBlockedRead, "Blocked selection cannot read new history, including after background refresh");
  blocks = [];
  await safety.getByRole("button", { name: "Block account" }).click();
  await safety.getByRole("button", { name: "Confirm block" }).click();
  await page.getByRole("button", { name: /Fixture Teammate/ }).waitFor({ state: "hidden" });
  assert.equal(blockWrites.length, 1);
  assert.equal(await page.getByText("Fixture message 1", { exact: true }).count(), 0);
  console.log("PASS web HoopChat pagination, retry, fixed caller, participant revocation, confidential report and confirmed block handling");
} finally {
  await browser.close();
}
