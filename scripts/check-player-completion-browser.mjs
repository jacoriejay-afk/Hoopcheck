import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000";
const uid = "11111111-1111-4111-8111-111111111111";
const user = { id: uid, aud: "authenticated", role: "authenticated", email: "profile-test@hoopcheck.invalid", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const now = Math.floor(Date.now() / 1000);
const jwt = Buffer.from(JSON.stringify({ sub: uid, aud: "authenticated", role: "authenticated", iat: now, exp: now + 3600 })).toString("base64url");
const session = { access_token: ["eyJhbGciOiJub25lIn0", jwt, "fixture"].join("."), refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user };
let profile = { id: uid, account_type: "player", basketball_type: "mens", display_name: "QA Player", avatar_url: "https://ci.invalid/photo", position: "SG", current_team: null, free_agent: false, current_country: "Country", favorite_leagues: null, height: "193 cm", bio: "A player", hometown: "City", profile_visibility: "players_only", player_verified: false, avatar_moderation_status: "approved" };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext();
try {
  await context.addCookies([{ name: "sb-ci-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url: baseURL }]);
  await context.addInitScript(value => localStorage.setItem("sb-ci-auth-token", JSON.stringify(value)), session);
  const page = await context.newPage();
  await page.route("https://ci.invalid/**", async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { "access-control-allow-origin": baseURL, "access-control-allow-methods": "GET,POST,PATCH,OPTIONS", "access-control-allow-headers": request.headers()["access-control-request-headers"] || "*" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    let data = [];
    if (url.pathname === "/auth/v1/user") data = user;
    else if (url.pathname.endsWith("/profiles")) {
      if (request.method() === "PATCH") profile = { ...profile, ...request.postDataJSON() };
      data = profile;
    } else if (url.pathname.includes("/rpc/get_public_player_profile")) data = [{ ...profile, player_position: profile.position }];
    else if (url.pathname.includes("/rpc/get_current_user_admin_role")) data = null;
    else if (url.pathname.includes("/rpc/is_current_user_admin_or_moderator")) data = false;
    else if (url.pathname.includes("/rpc/get_follow_count") || url.pathname.includes("/rpc/get_public_following_count")) data = 0;
    return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(data) });
  });
  // Next.js may abort a document navigation while the prior page is still
  // settling; retry only that transient Chromium error, not test assertions.
  const navigate = async path => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(baseURL + path, { waitUntil: "domcontentloaded" });
        return;
      } catch (error) {
        if (!String(error).includes("net::ERR_ABORTED") || attempt === 2) throw error;
        await page.waitForTimeout(200 * (attempt + 1));
      }
    }
  };
  for (const path of ["/dashboard", "/account", "/profile", `/players/${uid}`]) {
    await navigate(path);
    const progress = page.getByRole("progressbar", { name: "Player profile completion" });
    await progress.waitFor();
    assert.equal(await progress.getAttribute("aria-valuenow"), "86", path);
  }
  await navigate("/complete-profile");
  await page.getByRole("button", { name: /Current team/ }).click();
  await page.getByLabel("Free agent").check();
  await page.getByRole("button", { name: "Save detail" }).click();
  await page.getByText("Current team saved.").waitFor();
  assert.equal(profile.free_agent, true);
  assert.equal(profile.current_team, null);
  assert.equal(profile.profile_visibility, "players_only");
  assert.equal(await page.getByRole("progressbar", { name: "Player profile completion" }).getAttribute("aria-valuenow"), "100");
  await navigate("/account");
  const progress = page.getByRole("progressbar", { name: "Player profile completion" });
  await progress.waitFor();
  assert.equal(await progress.getAttribute("aria-valuenow"), "100");
  await page.getByRole("button", { name: /Make Public/ }).click();
  await page.getByText("Profile visible to everyone").waitFor();
  assert.equal(profile.profile_visibility, "public");
  console.log("Player completion browser checks passed.");
} finally {
  await browser.close();
}
