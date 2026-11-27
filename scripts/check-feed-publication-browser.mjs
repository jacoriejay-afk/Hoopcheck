import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000";
if (!["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)) throw new Error("Loopback fixture required.");
const uid = "11111111-1111-4111-8111-111111111111";
const author = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const postId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const commentId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const fixturePost = { id: postId, author_id: author, body: "Fixture post to report", created_at: new Date().toISOString(), video_url: null, post_kind: "discussion" };
const videoPath = uid + "/22222222-2222-4222-8222-222222222222.mp4";
const user = { id: uid, aud: "authenticated", role: "authenticated", user_metadata: {}, app_metadata: {} };
const part = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const expires_at = Math.floor(Date.now() / 1000) + 3600;
const access_token = `${part({ alg: "HS256" })}.${part({ sub: uid, role: user.role, exp: expires_at })}.fixture`;
const session = { user, access_token, refresh_token: "fixture", token_type: "bearer", expires_at, expires_in: 3600 };
const subscription = { plan: "pro", status: "active", access_status: "active", current_period_end: null };
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : { channel: "chrome" }),
  headless: true, args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 850 }, serviceWorkers: "block" });
  await context.addCookies([{ name: "sb-ci-auth-token", value: "base64-" + part(session), url: baseURL }]);
  const page = await context.newPage();
  let responseStatus = 503;
  let posts = 0, uploads = 0, cleanup = 0;
  let allowReport = false;
  const tickets = [];
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === baseURL) {
      if (url.pathname === "/api/membership") return route.fulfill({
        json: { owner: uid, subscription: { ...subscription, cancel_at_period_end: false, billing_interval: "month", provider: "stripe" } },
      });
      if (url.pathname === "/api/hoopfeed/video-upload") {
        assert.equal(request.headers().authorization, "Bearer " + access_token);
        return route.fulfill({ json: { mode: "private", bucket: "hoopfeed-private-videos", path: videoPath, token: "fixture-upload" } });
      }
      if (url.pathname === "/api/hoopfeed/moderate") {
        posts++;
        assert.equal(request.headers().authorization, "Bearer " + access_token);
        assert.ok(request.postData().includes("hoopfeed-private-videos/" + videoPath));
        return route.fulfill({ status: responseStatus, json: { allowed: false } });
      }
      if (url.pathname === "/api/hoopfeed/video-cleanup") {
        cleanup++;
        assert.deepEqual(request.postDataJSON(), { path: videoPath });
        return route.fulfill({ json: { removed: true } });
      }
      return route.continue();
    }
    if (url.origin !== "https://ci.invalid") return route.abort();
    const headers = {
      "access-control-allow-origin": baseURL,
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      "access-control-allow-headers": request.headers()["access-control-request-headers"] || "*",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    let data = [];
    if (url.pathname === "/auth/v1/user") data = user;
    if (url.pathname.endsWith("/profiles") && url.searchParams.has("id")) data = [{ id: uid, account_type: "player", display_name: "Fixture Player" }];
    if (url.pathname.endsWith("/get_current_user_admin_role")) data = null;
    if (url.pathname.endsWith("/feed_posts")) data = url.searchParams.has("id") && !allowReport ? [] : [fixturePost];
    if (url.pathname.endsWith("/feed_post_comments")) {
      assert.equal(url.searchParams.get("post_id"), "eq." + postId);
      data = [{ id: commentId, post_id: postId, author_id: author, body: "Fixture comment", created_at: fixturePost.created_at }];
    }
    if (url.pathname.endsWith("/support_tickets") && request.method() === "POST") {
      assert.equal(request.headers().authorization, "Bearer " + access_token);
      tickets.push(request.postDataJSON());
      return route.fulfill({ headers, status: 201 });
    }
    if (url.pathname.startsWith("/storage/v1/object/upload/sign/")) { uploads++; data = { Key: videoPath }; }
    return route.fulfill({ headers, json: data });
  });
  await page.goto(baseURL + "/feed");
  await page.locator(".hc-feed-slim-composer").click();
  const draft = page.locator("#hc-feed-composer-fields textarea");
  const publish = page.locator(".hc-feed-post-button");
  async function attach() {
    await draft.fill("Fixture caption");
    await page.locator("#hoopfeed-video").setInputFiles({ name: "fixture.mp4", mimeType: "video/mp4", buffer: Buffer.from("synthetic fixture") });
  }
  await attach();
  await publish.evaluate(button => { button.click(); button.click(); });
  await page.getByText(/Publication could not be confirmed/).waitFor();
  assert.equal(await draft.inputValue(), "Fixture caption");
  assert.ok(await publish.isDisabled());
  assert.deepEqual([posts, uploads, cleanup], [1, 1, 0]);
  await page.getByRole("button", { name: "Discard uncertain draft" }).click();
  assert.equal(await draft.inputValue(), "");
  responseStatus = 400;
  await attach();
  await publish.click();
  await page.getByText(/This post could not be published/).waitFor();
  await page.waitForFunction(() => !document.querySelector(".hc-feed-post-button").disabled);
  assert.equal(await draft.inputValue(), "Fixture caption");
  assert.deepEqual([posts, uploads, cleanup], [2, 2, 1]);
  console.log("PASS web HoopFeed double-submit guard, retained draft, and safe cleanup");
  async function report(kind) {
    await page.getByRole("button", { name: "Report this " + kind, exact: true }).click();
    await page.getByLabel("Why are you reporting this content?", { exact: true }).filter({ visible: true })
      .fill("Synthetic moderation report");
    await page.getByRole("button", { name: "Submit confidential report", exact: true }).click();
  }
  await report("post");
  await page.getByText(/Report could not be confirmed/).waitFor();
  assert.deepEqual(tickets, []);
  allowReport = true;
  await page.getByRole("button", { name: "Submit confidential report", exact: true }).click();
  await page.getByText("Confidential report submitted to HoopCheck staff.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "View comments", exact: true }).click();
  await report("comment");
  await page.getByRole("dialog").getByText("Confidential report submitted to HoopCheck staff.", { exact: true }).waitFor();
  assert.deepEqual(tickets.map(ticket => ticket.subject), ["Report a HoopFeed post", "Report a HoopFeed comment"]);
  assert.ok(tickets.every(ticket => ticket.requester_id === uid && ticket.category === "security"));
  assert.ok(tickets[1].description.includes("Comment ID: " + commentId));
  console.log("PASS web HoopFeed reports, caller scoping and removed-post denial");
} finally {
  await browser.close();
}
