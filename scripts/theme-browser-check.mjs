import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000";
const artifactsDir = "artifacts/theme-check";
await mkdir(artifactsDir, { recursive: true });

const userId = "11111111-1111-4111-8111-111111111111";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "theme-test@hoopcheck.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Theme Test" },
  created_at: "2026-01-01T00:00:00.000Z",
};
const session = {
  access_token: "theme-test-access-token",
  refresh_token: "theme-test-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};
const profile = {
  id: userId,
  display_name: "Theme Test Player",
  first_name: "Theme",
  last_name: "Test",
  account_type: "player",
  player_verified: true,
  coach_verified: false,
  moderation_status: null,
  moderation_note: null,
  current_country: "Azerbaijan",
  current_country_public: true,
  current_team: "Theme Test Club",
  avatar_url: null,
  theme_preference: "system",
  preferred_language: "en",
  profile_visibility: "public",
  professional_experience: true,
  bio: null,
  position: "Guard",
  years_pro: 1,
  coach_profile_id: null,
  experience_summary: null,
  profile_claimed: true,
  avatar_moderation_status: "approved",
};
const subscription = {
  user_id: userId,
  plan: "pro",
  status: "active",
  access_status: "active",
  current_period_end: null,
  cancel_at_period_end: false,
};

let serverReady = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(baseURL);
    if (response.ok) { serverReady = true; break; }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.ok(serverReady, "Next production server did not become ready within 60 seconds.");

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  for (const theme of ["dark", "light"]) {
    for (const routeName of ["dashboard", "feed"]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const encodedSession = "base64-" + btoa(unescape(encodeURIComponent(JSON.stringify(session))))
        .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      await context.addCookies([
        { name: "hoopcheck-theme", value: theme, url: baseURL },
        { name: "sb-ci-auth-token", value: encodedSession, url: baseURL },
      ]);
      await page.addInitScript(({ themePreference, authSession }) => {
        localStorage.setItem("hoopcheck-theme", themePreference);
        localStorage.setItem("sb-ci-auth-token", JSON.stringify(authSession));
      }, { themePreference: theme, authSession: session });

      await page.route("https://ci.invalid/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const cors = {
          "access-control-allow-origin": baseURL,
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "authorization,apikey,content-type,prefer,accept,range,x-client-info",
        };
        if (request.method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: cors, body: "" });
          return;
        }
        let data = [];
        if (url.pathname === "/auth/v1/user") data = user;
        else if (url.pathname.includes("/rest/v1/profiles")) data = profile;
        else if (url.pathname.includes("/rest/v1/subscriptions")) data = subscription;
        else if (url.pathname.includes("/rest/v1/rpc/get_current_user_admin_role")) data = "member";
        else if (url.pathname.includes("/rest/v1/feed_posting_activity")) data = [];
        else if (url.pathname.includes("/rest/v1/player_contact_requests")) data = [];
        else if (url.pathname.includes("/rest/v1/follow_relationships")) data = [];
        else if (url.pathname.includes("/rest/v1/feed_posts")) data = [];
        else if (url.pathname.includes("/rest/v1/feed_post_comments")) data = [];
        else if (url.pathname.includes("/rest/v1/feed_post_checks")) data = [];
        else if (url.pathname.includes("/rest/v1/reviews")) data = [];
        else if (url.pathname.includes("/rest/v1/teams")) data = [];
        else if (url.pathname.includes("/rest/v1/coaches")) data = [];
        else if (url.pathname.includes("/rest/v1/leagues")) data = [];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: cors,
          body: JSON.stringify(data),
        });
      });

      const path = routeName === "dashboard" ? "/dashboard" : "/feed";
      await page.goto(baseURL + path, { waitUntil: "domcontentloaded", timeout: 30000 });
      console.log("THEME_BROWSER_PAGE", JSON.stringify({ routeName, theme, url: page.url(), title: await page.title(), body: (await page.locator("body").innerText().catch(() => "")).slice(0, 240) }));
      const wrapperSelector = routeName === "dashboard" ? "main.hc-dashboard-shell" : "main.hc-feed-page";
      await page.locator(wrapperSelector).waitFor({ state: "visible", timeout: 30000 });
      if (routeName === "feed") {
        await page.locator(".hc-feed-composer").waitFor({ state: "visible", timeout: 30000 });
        await page.locator(".hc-feed-topic-chip").first().waitFor({ state: "visible", timeout: 30000 });
        await page.locator(".hc-feed-filter-chip").first().waitFor({ state: "visible", timeout: 30000 });
      }

      const computed = await page.evaluate(({ wrapperSelector, routeName }) => {
        const color = (selector) => {
          const element = document.querySelector(selector);
          return element ? getComputedStyle(element).backgroundColor : null;
        };
        return {
          themeClass: document.documentElement.classList.contains("theme-dark") ? "dark" :
            document.documentElement.classList.contains("theme-light") ? "light" : "missing",
          body: color("body"),
          pageWrapper: color(wrapperSelector),
          composer: routeName === "feed" ? color(".hc-feed-composer") : null,
          topicChip: routeName === "feed" ? color(".hc-feed-topic-chip") : null,
          filterChip: routeName === "feed" ? color(".hc-feed-filter-chip") : null,
        };
      }, { wrapperSelector, routeName });

      assert.equal(computed.themeClass, theme, `${routeName}: expected html theme class ${theme}, got ${computed.themeClass}`);
      const expectedPage = theme === "dark" ? "rgb(10, 10, 10)" : "rgb(244, 244, 241)";
      const expectedCard = theme === "dark" ? "rgb(17, 17, 17)" : "rgb(255, 255, 255)";
      const expectedChip = theme === "dark" ? "rgb(27, 27, 27)" : "rgb(248, 248, 246)";
      assert.equal(computed.body, expectedPage, `${routeName}/${theme}: body background mismatch`);
      assert.equal(computed.pageWrapper, expectedPage, `${routeName}/${theme}: page wrapper background mismatch`);
      if (routeName === "feed") {
        assert.equal(computed.composer, expectedCard, `feed/${theme}: composer background mismatch`);
        assert.equal(computed.topicChip, expectedChip, `feed/${theme}: topic chip background mismatch`);
        assert.equal(computed.filterChip, expectedChip, `feed/${theme}: filter chip background mismatch`);
      }

      results.push({ route: path, theme, computed });
      await page.screenshot({
        path: `${artifactsDir}/${routeName}-${theme}-mobile.png`,
        fullPage: true,
        animations: "disabled",
      });
      await context.close();
    }
  }

  const mainRoutes = [
    "/", "/dashboard", "/feed", "/account", "/settings", "/profile", "/search",
    "/teams", "/coaches", "/leagues", "/players", "/womens", "/directory",
    "/reviews", "/membership", "/notifications", "/support", "/verification",
    "/privacy-center", "/privacy", "/terms", "/community-guidelines", "/login",
    "/signup", "/onboarding", "/fan-live", "/live-games", "/partners", "/copyright",
  ];
  const routeSweepResults = [];
  for (const theme of ["dark", "light"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const encodedSession = "base64-" + btoa(unescape(encodeURIComponent(JSON.stringify(session))))
      .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    await context.addCookies([
      { name: "hoopcheck-theme", value: theme, url: baseURL },
      { name: "sb-ci-auth-token", value: encodedSession, url: baseURL },
    ]);
    const page = await context.newPage();
    await page.addInitScript(({ themePreference, authSession }) => {
      localStorage.setItem("hoopcheck-theme", themePreference);
      localStorage.setItem("sb-ci-auth-token", JSON.stringify(authSession));
    }, { themePreference: theme, authSession: session });
    await page.route("https://ci.invalid/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const cors = {
        "access-control-allow-origin": baseURL,
        "access-control-allow-credentials": "true",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "authorization,apikey,content-type,prefer,accept,range,x-client-info",
      };
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: cors, body: "" });
        return;
      }
      let data = [];
      if (url.pathname === "/auth/v1/user") data = user;
      else if (url.pathname.includes("/rest/v1/profiles")) data = request.headers()["accept"]?.includes("vnd.pgrst.object") ? profile : [];
      else if (url.pathname.includes("/rest/v1/subscriptions")) data = request.headers()["accept"]?.includes("vnd.pgrst.object") ? subscription : [];
      else if (url.pathname.includes("/rest/v1/rpc/get_current_user_admin_role")) data = "member";
      await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
    });
    for (const requestedPath of mainRoutes) {
      let navigationError = null;
      try {
        await page.goto(baseURL + requestedPath, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(300);
      } catch (error) {
        navigationError = error instanceof Error ? error.message : String(error);
      }
      const result = await page.evaluate(({ requestedPath, navigationError }) => {
        const main = document.querySelector("main");
        const color = (element) => element ? getComputedStyle(element).backgroundColor : null;
        return {
          requestedPath,
          resolvedPath: location.pathname,
          themeClass: document.documentElement.classList.contains("theme-dark") ? "dark" :
            document.documentElement.classList.contains("theme-light") ? "light" : "missing",
          body: color(document.body),
          pageWrapper: color(main),
          mainClass: main?.className || null,
          navigationError,
        };
      }, { requestedPath, navigationError });
      const expectedPage = theme === "dark" ? "rgb(10, 10, 10)" : "rgb(244, 244, 241)";
      const errors = [];
      if (result.themeClass !== theme) errors.push("html theme class mismatch");
      if (result.body !== expectedPage) errors.push("body background mismatch");
      if (result.pageWrapper && result.pageWrapper !== expectedPage) errors.push("main background mismatch");
      if (result.navigationError) errors.push("navigation error");
      routeSweepResults.push({ theme, ...result, status: errors.length ? "FAIL" : result.pageWrapper ? "PASS" : "NO_MAIN", reason: errors.join("; ") || (result.pageWrapper ? "" : "route rendered no main element") });
    }
    await context.close();
  }
  console.log("THEME_ROUTE_SWEEP=" + JSON.stringify(routeSweepResults, null, 2));

} finally {
  await browser.close();
}
console.log("THEME_COMPUTED_STYLES=" + JSON.stringify(results, null, 2));
