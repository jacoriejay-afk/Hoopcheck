import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000";
const testLanguage = process.env.THEME_TEST_LANGUAGE || "en";
const teamFixture = {
  id: "b79a5635-4531-4cc9-981d-103f9b61b9c2",
  name: "A.B.B Ego Spor",
  country: "Türkiye",
  league_name: "Turkish Basketball League",
  league_id: "c8d92f50-20d6-4b13-a6c8-9a7b3c1b2001",
  city: "Istanbul",
  logo_url: "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect width=%27100%27 height=%27100%27 rx=%2718%27 fill=%27%23FF5A1F%27/%3E%3Ctext x=%2750%27 y=%2763%27 font-size=%2742%27 font-weight=%27900%27 text-anchor=%27middle%27 fill=%27white%27%3EEG%3C/text%3E%3C/svg%3E",
  logo_bg: "light",
};
const fallbackTeamFixture = {
  id: "a2f9b1c4-92a3-4c89-bdd4-1d8e57a7c8f0",
  name: "Baku Falcons QA",
  country: "Azerbaijan",
  league_name: "QA League",
  league_id: "c8d92f50-20d6-4b13-a6c8-9a7b3c1b2001",
  city: "Baku",
  logo_url: null,
  logo_bg: "transparent",
};
const leagueFixture = {
  id: "c8d92f50-20d6-4b13-a6c8-9a7b3c1b2001",
  name: "Turkish Basketball League",
  country: "Türkiye",
  level: "Top division",
};
const coachFixture = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Coach QA Fixture",
  country: "Azerbaijan",
  city: "Baku",
  current_team_id: teamFixture.id,
  active: true,
};
const artifactsDir = "artifacts/theme-check";
await mkdir(artifactsDir, { recursive: true });
await mkdir(`${artifactsDir}/routes`, { recursive: true });

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
const sessionIssuedAt = Math.floor(Date.now() / 1000);
const sessionJwtPayload = btoa(JSON.stringify({
  sub: userId,
  aud: "authenticated",
  role: "authenticated",
  iat: sessionIssuedAt,
  exp: sessionIssuedAt + 3600,
})).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const session = {
  // Supabase Auth decodes exp from the access-token JWT before accepting a
  // persisted session. A plain fixture string is treated as an invalid token,
  // which triggers refresh and leaves the dashboard stuck in its loading state.
  access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${sessionJwtPayload}.theme-test-signature`,
  refresh_token: "theme-test-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: sessionIssuedAt + 3600,
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
  preferred_language: testLanguage,
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

const browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : { channel: "chrome" }), headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  // Public routes must not expose member-only mobile navigation when there is
  // no session. Keep this separate from the authenticated screenshot fixtures.
  for (const theme of ["light", "dark", "system"]) {
    const guestContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: theme === "light" ? "light" : "dark",
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });
    const guestPage = await guestContext.newPage();
    await guestContext.addCookies([{ name: "hoopcheck-theme", value: theme, url: baseURL }]);
    await guestPage.addInitScript((preference) => {
      localStorage.setItem("hoopcheck-theme", preference);
      localStorage.removeItem("sb-ci-auth-token");
    }, theme);
    await guestPage.route("https://ci.invalid/**", async route => {
      const req = route.request();
      const headers = {
        "access-control-allow-origin": baseURL,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": req.headers()["access-control-request-headers"] || "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      return route.fulfill({ status: 401, headers, contentType: "application/json", body: JSON.stringify({ message: "Guest fixture: no session" }) });
    });
    for (const route of ["/login", "/signup", "/search"]) {
      await guestPage.goto(baseURL + route);
      await guestPage.locator("body").waitFor({ state: "visible" });
      await guestPage.waitForTimeout(400);
      assert.equal(await guestPage.locator("nav.bottom-nav").count(), 0,
        `Guest ${theme} ${route}: member bottom navigation must not render`);
      assert.equal(await guestPage.locator('a.hc-signin-button').count() > 0, true,
        `Guest ${theme} ${route}: sign-in action must be available`);
    }
    for (const width of [390, 1024, 1440]) {
      await guestPage.setViewportSize({ width, height: 844 });
      await guestPage.goto(baseURL + "/");
      const input = guestPage.locator("main .hc-searchbar__input:visible");
      await input.fill("Basketball");
      const readColors = () => input.evaluate((element) => {
        const style = getComputedStyle(element);
        const tokenColor = (token) => {
          const sample = document.createElement("span");
          sample.style.setProperty("color", `var(${token})`, "important");
          element.parentElement.append(sample);
          const color = getComputedStyle(sample).color;
          sample.remove();
          return color;
        };
        return {
          text: style.webkitTextFillColor,
          placeholder: getComputedStyle(element, "::placeholder").webkitTextFillColor,
          expectedText: tokenColor("--hc-input-fg"),
          expectedPlaceholder: tokenColor("--hc-foreground-muted"),
        };
      });
      // System mode can transition from the server-rendered theme during hydration.
      const deadline = Date.now() + 2000;
      let colors = await readColors();
      while ((colors.text !== colors.expectedText || colors.placeholder !== colors.expectedPlaceholder) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
        colors = await readColors();
      }
      assert.equal(colors.text, colors.expectedText, `Guest ${theme} home at ${width}px: typed search text must follow the input theme`);
      assert.equal(colors.placeholder, colors.expectedPlaceholder, `Guest ${theme} home at ${width}px: search placeholder must follow the muted theme`);
    }
    if (theme === "system") {
      await guestPage.locator("html.theme-dark").waitFor({ state: "attached", timeout: 10000 });
      await guestPage.emulateMedia({ colorScheme: "light" });
      await guestPage.locator("html.theme-light").waitFor({ state: "attached", timeout: 10000 });
    }
    await guestContext.close();
  }
  console.log("GUEST_MOBILE_NAV=PASS; routes=login,signup,search; themes=light,dark,system");

  for (const theme of ["dark", "light"]) {
    for (const routeName of ["dashboard", "feed", "admin"]) {
      const context = await browser.newContext({
        // Fixture routes must reach Playwright rather than a service worker.
        serviceWorkers: "block",
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
      await page.addInitScript(({ themePreference, authSession, language }) => {
        localStorage.setItem("hoopcheck-theme", themePreference);
        localStorage.setItem("hoopcheck-language", language);
        localStorage.setItem("sb-ci-auth-token", JSON.stringify(authSession));
      }, { themePreference: theme, authSession: session, language: testLanguage });

      await page.route("https://ci.invalid/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const cors = {
          "access-control-allow-origin": baseURL,
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "authorization,apikey,content-type,prefer,accept,range,x-client-info",
        "cache-control": "no-store",
        };
        if (request.method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: cors, body: "" });
          return;
        }
        let data = [];
        if (url.pathname === "/auth/v1/user") data = user;
        else if (url.pathname.includes("/rest/v1/profiles")) data = profile;
        else if (url.pathname.includes("/rest/v1/subscriptions")) data = subscription;
        else if (url.pathname.includes("/rest/v1/rpc/is_current_user_admin_or_moderator")) data = true;
        else if (url.pathname.includes("/rest/v1/rpc/get_current_user_admin_role")) data = "admin";
        else if (url.pathname.includes("/rest/v1/feed_posting_activity")) data = [];
        else if (url.pathname.includes("/rest/v1/player_contact_requests")) data = [];
        else if (url.pathname.includes("/rest/v1/follow_relationships")) data = [];
        else if (url.pathname.includes("/rest/v1/feed_posts")) data = [];
        else if (url.pathname.includes("/rest/v1/feed_post_comments")) data = [];
        else if (url.pathname.includes("/rest/v1/feed_post_checks")) data = [];
        else if (url.pathname.includes("/rest/v1/reviews")) data = [];
        else if (url.pathname.includes("/rest/v1/womens_teams")) {
        const idFilter = url.searchParams.get("id") || "";
        data = idFilter.startsWith("eq.") ? (single ? teamFixture : [teamFixture]) : [teamFixture];
      }
      else if (url.pathname.includes("/rest/v1/teams")) { const requestedId = (url.searchParams.get("id") || "").replace(/^eq\./, ""); data = requestedId ? [requestedId === fallbackTeamFixture.id ? fallbackTeamFixture : teamFixture] : [teamFixture, fallbackTeamFixture]; }
        else if (url.pathname.includes("/rest/v1/coaches")) data = [coachFixture];
        else if (url.pathname.includes("/rest/v1/leagues")) data = [leagueFixture];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: cors,
          body: JSON.stringify(data),
        });
      });

      const path = routeName === "dashboard" ? "/dashboard" : routeName === "feed" ? "/feed" : "/admin/directory";
      await page.goto(baseURL + path, { waitUntil: "domcontentloaded", timeout: 30000 });
      console.log("THEME_BROWSER_PAGE", JSON.stringify({ routeName, theme, url: page.url(), title: await page.title(), body: (await page.locator("body").innerText().catch(() => "")).slice(0, 240) }));
      const wrapperSelector = routeName === "dashboard" ? "main.hc-home3" : routeName === "feed" ? "main.hc-feed-page" : "main.admin-directory-shell";
      await page.locator(wrapperSelector).waitFor({ state: "visible", timeout: 30000 });
      if (routeName === "feed") {
        await page.locator(".hc-feed-composer").waitFor({ state: "visible", timeout: 30000 });
        await page.locator(".hf5-type-chip").first().waitFor({ state: "visible", timeout: 30000 });
      }

      // Auth/profile hydration can redirect /dashboard after its loading shell first
      // appears. Wait for that navigation to settle before reading computed styles.
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      // Give client-side auth redirects a brief chance to complete after the
      // dashboard's initial loading shell becomes visible.
      await page.waitForTimeout(750);
      await page.locator(wrapperSelector).waitFor({ state: "visible", timeout: 30000 });
      if (routeName === "dashboard") {
        await page.locator(".hc-home3-greeting").waitFor({ state: "visible", timeout: 30000 });
        await page.locator(".hc-home3-search").first().waitFor({ state: "visible", timeout: 30000 });
      }
      const computed = await page.evaluate(({ wrapperSelector, routeName }) => {
        const color = (selector) => {
          const element = document.querySelector(selector);
          return element ? getComputedStyle(element).backgroundColor : null;
        };
        const probe = document.createElement("span");
        probe.style.backgroundColor = "var(--surface)";
        document.body.append(probe);
        const glassSurface = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          themeClass: document.documentElement.classList.contains("theme-dark") ? "dark" :
            document.documentElement.classList.contains("theme-light") ? "light" : "missing",
          body: color("body"),
          glassSurface,
          pageWrapper: color(wrapperSelector),
          composer: routeName === "feed" ? color(".hc-feed-composer") : null,
          discoveryHeading: routeName === "feed" ? getComputedStyle(document.querySelector(".hf5-hero__title")).color : null,
          composerBorder: routeName === "feed" ? getComputedStyle(document.querySelector(".hc-feed-composer")).borderTopWidth : null,
          filterChip: routeName === "feed" ? color(".hf5-type-chip:not(.is-active)") : null,
          dashboardHeroHeadline: routeName === "dashboard" ? (() => { const element = document.querySelector("main.hc-home3 .hc-home3-greeting-line strong"); return element ? getComputedStyle(element).color : null; })() : null,
          homePairs: routeName === "dashboard" ? [".hc-home3-greeting", ".hc-home3-section", ".hc-home3-search"].map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return { selector, missing: true };
            const style = getComputedStyle(element);
            const title = element.querySelector("strong, h2, span");
            return { selector, background: style.backgroundColor, color: style.color, title: title && getComputedStyle(title).color };
          }) : [],
          whiteSurfaceOffenders: Array.from(document.querySelectorAll("main *, .global-back-button"))
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.backgroundColor === "rgb(255, 255, 255)" && rect.width > 16 && rect.height > 12 &&
                style.display !== "none" && style.visibility !== "hidden";
            })
            .slice(0, 30)
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === "string" ? element.className : "",
              text: (element.textContent || "").trim().slice(0, 40),
            })),
        };
      }, { wrapperSelector, routeName });

      assert.equal(computed.themeClass, theme, `${routeName}: expected html theme class ${theme}, got ${computed.themeClass}`);
      const expectedPage = theme === "dark" ? "rgb(0, 0, 0)" : "rgb(244, 244, 241)";
      const expectedChip = theme === "dark" ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)";
      assert.equal(computed.body, expectedPage, `${routeName}/${theme}: body background mismatch`);
      assert.equal(computed.pageWrapper, expectedPage, `${routeName}/${theme}: page wrapper background mismatch`);
      if (routeName === "dashboard") {
        assert.ok(computed.dashboardHeroHeadline && (() => { const channel = (color) => color.match(/\d+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4); const luminance = (color) => channel(color).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0); const a = luminance(computed.dashboardHeroHeadline); const b = luminance(computed.body); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5; })(), `dashboard/${theme}: greeting headline contrast must be >= 4.5:1 against page background, got ${computed.dashboardHeroHeadline}`);
        assert.ok(computed.homePairs.some(pair => !pair.missing && pair.title), `dashboard/${theme}: dashboard greeting and search must render`);
        for (const pair of computed.homePairs.filter(pair => !pair.missing && pair.title)) {
          assert.ok(pair.background && pair.color && pair.title, `dashboard/${theme}: visible section styles must resolve: ${JSON.stringify(pair)}`);
        }
      }
      if (routeName === "feed") {
        assert.ok(computed.composer !== null, `feed/${theme}: composer renders`);
        assert.ok(computed.discoveryHeading && computed.discoveryHeading !== "rgba(0, 0, 0, 0)", `feed/${theme}: community heading has a computed color`);
        assert.ok(computed.composerBorder !== null, `feed/${theme}: composer border style computed`);
        assert.equal(computed.filterChip, expectedChip, `feed/${theme}: type chip background mismatch`);
      }
      if (theme === "dark") {
        assert.equal(
          computed.whiteSurfaceOffenders.length,
          0,
          `${routeName}/dark: remaining fixed white surfaces: ${JSON.stringify(computed.whiteSurfaceOffenders)}`,
        );
      }

      results.push({ route: path, theme, computed });
      await page.screenshot({
        path: `${artifactsDir}/${routeName}-${theme}-${testLanguage}-mobile.png`,
        fullPage: true,
        animations: "disabled",
      });
      await context.close();
    }
  }

  const mainRoutes = [
    "/", "/dashboard", "/feed", "/account", "/settings", "/profile", "/search", "/search?q=Baku",
    "/teams", "/teams/b79a5635-4531-4cc9-981d-103f9b61b9c2", "/teams/a2f9b1c4-92a3-4c89-bdd4-1d8e57a7c8f0", "/womens/" + teamFixture.id, "/admin/team-logos", "/coaches", "/coaches/11111111-1111-4111-8111-111111111111", "/leagues", "/players", "/womens", "/directory",
    "/reviews", "/membership", "/notifications", "/support", "/verification",
    "/privacy-center", "/privacy", "/terms", "/community-guidelines", "/login",
    "/signup", "/onboarding", "/fan-live", "/fan-feed", "/team-hub",
    "/team-hub/groups/" + teamFixture.id, "/live-games", "/theme-card-audit", "/partners", "/copyright",
  ];
  const themeComponentInventory = [
    { route: "/live-games", selector: ".hc-live-hub-hero", surface: "Hub hero surface/foreground pair" },
    { route: "/live-games", selector: ".hc-live-empty", surface: "Live and upcoming empty-state card" },
    { route: "/live-games", selector: ".hc-live-empty__icon", surface: "Empty-state icon chip" },
    { route: "/live-games", selector: ".hc-live-section-heading h2 span", surface: "Live/upcoming/recent count badge (including zero)" },
    { route: "/live-games", selector: ".hc-live-recent-empty", surface: "Recently Finished dashed empty state" },
    { route: "/live-games", selector: ".hc-live-hub-filters", surface: "Hub filter card; regression sentinel" },
    { route: "/live-games", selector: ".hc-live-hub-card", surface: "Populated game card; regression sentinel" },
    { route: "/live-games", selector: ".hc-live-card__crest", surface: "Game-card team logo chip" },
    { route: "/live-games", selector: ".hc-live-join", surface: "Live chat entry" },
    { route: "/live-games", selector: ".hc-live-card__meta", surface: "Game-card metadata" },
  ];
  const routeSweepResults = [];
  for (const theme of ["dark", "light"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const encodedSession = "base64-" + btoa(unescape(encodeURIComponent(JSON.stringify(session))))
      .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    await context.addCookies([
      { name: "hoopcheck-theme", value: theme, url: baseURL },
      { name: "sb-ci-auth-token", value: encodedSession, url: baseURL },
    ]);
    const page = await context.newPage();
    let activeRoutePath = "";
    let moderatorViewingGroup = false;
    let liveGameFixtureMode = "empty";
    const fixtureNow = Date.now();
    const liveGameFixtures = [
      {
        id: "33333333-3333-4333-8333-333333333331", team_id: teamFixture.id, opponent_team_id: fallbackTeamFixture.id,
        opponent_name: fallbackTeamFixture.name, status: "live", home_score: 52, away_score: 48,
        started_at: new Date(fixtureNow - 20 * 60_000).toISOString(), ends_at: new Date(fixtureNow + 35 * 60_000).toISOString(),
        scheduled_at: new Date(fixtureNow - 20 * 60_000).toISOString(), league_id: leagueFixture.id,
        league_name: "QA League", country: "Azerbaijan", period_label: "Q3",
      },
      {
        id: "33333333-3333-4333-8333-333333333332", team_id: teamFixture.id, opponent_team_id: fallbackTeamFixture.id,
        opponent_name: fallbackTeamFixture.name, status: "scheduled", home_score: null, away_score: null,
        started_at: null, ends_at: null, scheduled_at: new Date(fixtureNow + 2 * 60 * 60_000).toISOString(),
        league_id: leagueFixture.id, league_name: "QA League", country: "Azerbaijan", period_label: null,
      },
      {
        id: "33333333-3333-4333-8333-333333333333", team_id: teamFixture.id, opponent_team_id: fallbackTeamFixture.id,
        opponent_name: fallbackTeamFixture.name, status: "final", home_score: 80, away_score: 74,
        started_at: new Date(fixtureNow - 2 * 60 * 60_000).toISOString(), ends_at: new Date(fixtureNow - 60 * 60_000).toISOString(),
        scheduled_at: new Date(fixtureNow - 2 * 60 * 60_000).toISOString(), league_id: leagueFixture.id,
        league_name: "QA League", country: "Azerbaijan", period_label: null,
      },
    ];
    await page.addInitScript(({ themePreference, authSession, language }) => {
      localStorage.setItem("hoopcheck-theme", themePreference);
      localStorage.setItem("hoopcheck-language", language);
      document.documentElement.style.setProperty("--hc-safe-area-top", "47px");
      document.documentElement.style.setProperty("--hc-safe-area-bottom", "34px");
      localStorage.setItem("sb-ci-auth-token", JSON.stringify(authSession));
    }, { themePreference: theme, authSession: session, language: testLanguage });
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
      const single = request.headers()["accept"]?.includes("vnd.pgrst.object");
      if (url.pathname === "/auth/v1/user") data = user;
      else if (url.pathname.includes("/rest/v1/profiles")) {
        const fanSurfaceRoute = activeRoutePath === "/fan-feed" || activeRoutePath === "/team-hub" || activeRoutePath.startsWith("/team-hub/groups/") || activeRoutePath.startsWith("/womens/");
        const accountTypeQuery = (url.searchParams.get("select") || "").includes("account_type") && (url.searchParams.get("id") || "").startsWith("eq.");
        const fanProfile = { ...profile, account_type: "fan", preferred_basketball_side: "mens" };
        data = accountTypeQuery ? (fanSurfaceRoute ? fanProfile : profile) : single ? profile : [];
      }
      else if (url.pathname.includes("/rest/v1/subscriptions")) {
        const subscriptionQuery = (url.searchParams.get("select") || "").includes("plan") && (url.searchParams.get("user_id") || "").startsWith("eq.");
        data = subscriptionQuery ? subscription : single ? subscription : [];
      }
      else if (url.pathname.includes("/rest/v1/fan_live_games")) {
        data = activeRoutePath === "/live-games" && liveGameFixtureMode === "populated" ? liveGameFixtures : [];
      }
      else if (url.pathname.includes("/rest/v1/womens_teams")) {
        const idFilter = url.searchParams.get("id") || "";
        if (idFilter.startsWith("eq.")) data = single ? teamFixture : [teamFixture];
        else if (idFilter.startsWith("in.")) data = [teamFixture];
        else data = [teamFixture];
      }
      else if (url.pathname.includes("/rest/v1/teams")) {
        const idFilter = url.searchParams.get("id") || "";
        if (idFilter.startsWith("eq.")) {
          const id = idFilter.slice(3);
          const row = id === fallbackTeamFixture.id ? fallbackTeamFixture : teamFixture;
          data = single ? row : [row];
        } else if (idFilter.startsWith("in.")) {
          const ids = idFilter.slice(3).replace(/^\(|\)$/g, "").split(",");
          data = [teamFixture, fallbackTeamFixture].filter(row => ids.includes(row.id));
        } else data = [teamFixture, fallbackTeamFixture];
      }
      else if (url.pathname.includes("/rest/v1/leagues")) data = single ? leagueFixture : [leagueFixture];
      else if (url.pathname.includes("/rest/v1/coaches")) data = single ? coachFixture : [coachFixture];
      else if (url.pathname.includes("/rest/v1/team_league_memberships")) data = [];
      else if (url.pathname.includes("/rest/v1/reviews")) data = [];
      else if (url.pathname.includes("/rest/v1/team_roster_spots")) data = [];
      else if (url.pathname.includes("/rest/v1/follow_relationships")) {
        const isFanTeamFollow = activeRoutePath === "/fan-feed" && url.searchParams.get("target_type") === "eq.team";
        data = isFanTeamFollow ? [{ target_id: teamFixture.id, target_type: "team" }] : single ? null : [];
      }
      else if (url.pathname.includes("/rest/v1/team_fan_groups")) data = single ? { team_id: teamFixture.id, group_name: teamFixture.name + " Fan Group" } : [{ team_id: teamFixture.id, group_name: teamFixture.name + " Fan Group" }];
      else if (url.pathname.includes("/rest/v1/team_fan_group_members")) data = moderatorViewingGroup ? (single ? null : []) : single ? { team_id: teamFixture.id, user_id: userId } : [{ team_id: teamFixture.id, user_id: userId }];
      else if (url.pathname.includes("/rest/v1/team_fan_group_moderators")) data = single ? null : [];
      else if (url.pathname.includes("/rest/v1/rpc/is_team_fan_group_moderator")) data = moderatorViewingGroup;
      else if (url.pathname.includes("/rest/v1/team_fan_group_posts")) data = moderatorViewingGroup ? [{
        id: "a2f9b1c4-92a3-4c89-bdd4-1d8e57a7c8f1",
        team_id: teamFixture.id,
        author_id: userId,
        body: "Post visible to the group moderator",
        image_url: null,
        is_pinned: false,
        created_at: "2026-01-01T00:00:00.000Z",
      }] : [];
      else if (url.pathname.includes("/rest/v1/team_fan_group_comments")) data = [];
      else if (url.pathname.includes("/rest/v1/rpc/get_team_fan_group_summary")) {
        const summary = {
          group_name: teamFixture.name + " Fan Group",
          member_count: 12,
          join_mode: "open",
          is_member: true,
          has_pending_request: false,
        };
        data = single ? summary : [summary];
      }
      else if (url.pathname.includes("/rest/v1/rpc/get_follow_count")) data = 0;
      else if (url.pathname.includes("/rest/v1/rpc/get_review_verification")) data = [];
      else if (url.pathname.includes("/rest/v1/rpc/is_current_user_admin_or_moderator")) data = true;
      else if (url.pathname.includes("/rest/v1/rpc/get_current_user_admin_role")) data = "member";
      await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
    });

    // Exercise the real Settings language control before capturing every route.
    await page.goto(baseURL + "/settings", { waitUntil: "domcontentloaded", timeout: 20000 });
    const languageSelect = page.locator("select.language-select");
    await languageSelect.waitFor({ state: "visible", timeout: 10000 });
    if (testLanguage === "en") {
      await languageSelect.selectOption("es");
      await page.waitForFunction(() => document.documentElement.lang === "es", null, { timeout: 10000 });
      await page.locator("select.language-select").selectOption("en");
    } else {
      await languageSelect.selectOption("es");
    }
    await page.waitForFunction((expected) => document.documentElement.lang === expected, testLanguage, { timeout: 10000 });
    await page.waitForTimeout(150);

    for (const requestedPath of mainRoutes) {
      let navigationError = null;
      activeRoutePath = requestedPath;
      try {
        await page.goto(baseURL + requestedPath, { waitUntil: "domcontentloaded", timeout: 20000 });
        if (requestedPath === "/fan-feed") {
          await page.waitForURL("**/feed", { timeout: 15000 });
          await page.locator("main.hc-feed-page .hc-feed-composer").waitFor({ state: "visible", timeout: 15000 });
        }
        // A route shell can render before its fixture data and controls. Audit
        // the populated page so timing does not hide contrast/copy findings.
        await page.locator("main").waitFor({ state: "visible", timeout: 15000 });
        await page.locator("main .hc-brand-loader--screen").waitFor({ state: "hidden", timeout: 15000 });
        await page.waitForTimeout(300);
        if (requestedPath === "/live-games") {
          await page.locator("main.hc-live-hub-page .hc-live-hub-hero").waitFor({ state: "visible", timeout: 15000 });
        }
        if (requestedPath === "/theme-card-audit") {
          await page.locator("main.hc-card-audit-page .hc-card-audit-preview[data-theme-preview='light']").first().waitFor({ state: "visible", timeout: 15000 });
          await page.locator("main.hc-card-audit-page .hc-card-audit-preview[data-theme-preview='dark']").first().waitFor({ state: "visible", timeout: 15000 });
        }
      } catch (error) {
        navigationError = error instanceof Error ? error.message : String(error);
      }
      if (requestedPath === "/account") {
        const expectedAccountHeading = testLanguage === "es" ? "PREFERENCIAS DE LA CUENTA" : "ACCOUNT PREFERENCES";
        await page.waitForFunction((expected) => document.body.innerText.toLocaleUpperCase().includes(expected), expectedAccountHeading, { timeout: 15000 });
      }
      if (requestedPath === "/search") {
        const expectedSearchHeading = testLanguage === "es" ? "CONEXIÓN ENTRE JUGADORES" : "PLAYER CONNECT";
        await page.waitForFunction((expected) => document.body.innerText.toLocaleUpperCase().includes(expected), expectedSearchHeading, { timeout: 15000 });
      }
      const result = await page.evaluate(({ requestedPath, navigationError }) => {
        const main = document.querySelector("main");
        const routeRoot = document.body;
        const color = (element) => element ? getComputedStyle(element).backgroundColor : null;
        const scaffoldTerms = ["KICKER", "TITLE", "Subtitle", "TEAM FIRST", "Fan Only Note", "Composer Placeholder", "EMPTY TITLE", "EMPTY KICKER", "Empty Body", "Lorem", "TODO", "Placeholder"];
        const renderedCopy = routeRoot?.innerText || "";
        const renderedAttributes = Array.from(routeRoot?.querySelectorAll("*") || []).flatMap((element) =>
          ["placeholder", "aria-label", "title", "alt"].map((name) => element.getAttribute(name) || "")
        ).join("\\n");
        const scaffoldMatches = scaffoldTerms.filter((term) => renderedCopy.includes(term) || renderedAttributes.includes(term));
        return {
          scaffoldMatches,
          requestedPath,
          resolvedPath: location.pathname,
          themeClass: document.documentElement.classList.contains("theme-dark") ? "dark" :
            document.documentElement.classList.contains("theme-light") ? "light" : "missing",
          body: color(document.body),
          pageWrapper: color(main),
          mainClass: main?.className || null,
          safeAreaTop: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hc-safe-area-top")) || 0,
          bodyTopPadding: parseFloat(getComputedStyle(document.body).paddingTop) || 0,
          headerTop: document.querySelector(".site-header-global") ? document.querySelector(".site-header-global").getBoundingClientRect().top : null,
          mainTop: main ? main.getBoundingClientRect().top : null,
          safeAreaBottom: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hc-safe-area-bottom")) || 0,
          tabBarBottomPadding: document.querySelector(".bottom-nav") ? parseFloat(getComputedStyle(document.querySelector(".bottom-nav")).paddingBottom) || 0 : null,
          criticalControlContrast: Array.from(document.querySelectorAll(".hc-dashboard-edit-profile,.hc-dashboard-avatar,.player-avatar-fallback,.hc-mobile-menu-toggle,.quick-access-count,.quick-card-count,.count-badge,.hc-count-badge,.hc-mobile-section-count"))
            .filter((element) => element.getClientRects().length)
            .map((element) => {
              const style = getComputedStyle(element);
              const rgb = (value) => { const m=value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/); return m ? [Number(m[1]),Number(m[2]),Number(m[3])] : null; };
              const lum = (c) => c.slice(0,3).map(v=>{const x=v/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[0.2126,0.7152,0.0722][i],0);
              const fg=rgb(style.color); let node=element; let bg=null;
              while(node && node!==document.documentElement){const candidate=rgb(getComputedStyle(node).backgroundColor);if(candidate && getComputedStyle(node).backgroundColor!=="rgba(0, 0, 0, 0)"){bg=candidate;break;}node=node.parentElement;}
              if(!fg || !bg)return {selector:typeof element.className==="string"?element.className:element.tagName,ratio:0,color:style.color,background:bg};
              const a=lum(fg),b=lum(bg);return {selector:typeof element.className==="string"?element.className:element.tagName,ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),color:style.color,background:bg};
            })
            .filter((item) => item.ratio < 4.5),
          whiteSurfaceOffenders: Array.from(document.querySelectorAll("main *"))
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              const cls = typeof element.className === "string" ? element.className : "";
              if (/(logo|avatar|photo|portrait|image)/i.test(cls) || element.closest(".hc-card-audit-preview")) return false;
              return style.backgroundColor === "rgb(255, 255, 255)" && rect.width > 16 && rect.height > 12 &&
                style.display !== "none" && style.visibility !== "hidden";
            })
            .slice(0, 20)
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === "string" ? element.className : "",
              text: (element.textContent || "").trim().slice(0, 50),
            })),
          lowContrastText: Array.from(document.querySelectorAll("main *"))
            .filter((element) => {
              if (element.children.length || !(element.textContent || "").trim()) return false;
              const cls = typeof element.className === "string" ? element.className : "";
              if (/(logo|avatar|photo|portrait|image)/i.test(cls) || element.closest("[aria-hidden='true']")) return false;
              const style = getComputedStyle(element);
              if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.6) return false;
              const rgb = (value) => {
                const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
                return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])] : null;
              };
              const luminance = (c) => c.slice(0, 3).map(v => { const x=v/255; return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4; }).reduce((a,v,i)=>a+v*[0.2126,0.7152,0.0722][i],0);
              const foreground = rgb(style.color);
              if (!foreground) return false;
              let node = element;
              let background = null;
              while (node && node !== document.documentElement) {
                const candidate = rgb(getComputedStyle(node).backgroundColor);
                if (candidate && candidate[3] >= 0.95) { background = candidate; break; }
                node = node.parentElement;
              }
              if (!background) background = rgb(getComputedStyle(document.body).backgroundColor);
              if (!background) return false;
              const l1=luminance(foreground), l2=luminance(background);
              const ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
              const fontSize=parseFloat(style.fontSize)||14;
              const large=fontSize>=24 || (fontSize>=18 && Number(style.fontWeight)>=700);
              return ratio < (large ? 3 : 4.5);
            })
            .slice(0, 20)
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === "string" ? element.className : "",
              text: (element.textContent || "").trim().slice(0, 60),
              color: getComputedStyle(element).color,
              background: (() => { let n=element; while(n && n!==document.documentElement){const c=getComputedStyle(n).backgroundColor;if(c!=="rgba(0, 0, 0, 0)")return c;n=n.parentElement;} return getComputedStyle(document.body).backgroundColor; })(),
            })),
          navigationError,
        };
      }, { requestedPath, navigationError });
      const expectedPage = theme === "dark" ? "rgb(0, 0, 0)" : "rgb(244, 244, 241)";
      const errors = [];
      if (requestedPath.startsWith("/womens/")) {
        await page.getByRole("tab", { name: "Fan Group" }).click();
        await page.locator("main.hc-womens-profile-page .hc-team-fan-group-entry").waitFor({ state: "visible", timeout: 15000 });
        const fanGroupEntry = (await page.locator("main.hc-womens-profile-page .hc-team-fan-group-entry").innerText()).trim();
        if (!fanGroupEntry.includes("Fan Group") || !fanGroupEntry.includes("Joined")) errors.push("women team profile: Fan Group entry is missing or not joined: " + fanGroupEntry);
      }
      if (requestedPath === "/fan-feed") {
        // HF-5: Fan Feed now redirects into the shared HoopFeed community.
        await page.waitForURL("**/feed", { timeout: 15000 });
        const destination = new URL(page.url()).pathname;
        if (destination !== "/feed") errors.push("fan-feed: legacy route must redirect to unified HoopFeed: " + destination);
      }
      if (requestedPath.startsWith("/team-hub/groups/")) {
        await page.locator("main.hc-team-fan-group-page .hc-feed-hero").waitFor({ state: "visible", timeout: 15000 });
        await page.locator("main.hc-team-fan-group-page .hc-team-fan-group-composer textarea").waitFor({ state: "visible", timeout: 15000 });
        await page.locator("main.hc-team-fan-group-page .hc-feed-empty").waitFor({ state: "visible", timeout: 15000 });
        const lockedTarget = (await page.locator("main.hc-team-fan-group-page .hc-team-group-posting-target").innerText()).trim();
        if (!lockedTarget.includes("Posting to") || !lockedTarget.includes(teamFixture.name) || !lockedTarget.includes("Fan Group")) errors.push("team-hub group: composer does not explain its locked club/group destination: " + lockedTarget);
        const groupEmpty = (await page.locator("main.hc-team-fan-group-page .hc-feed-empty").innerText()).trim();
        if (!groupEmpty.includes("No posts yet — be the first to post for " + teamFixture.name + ".")) errors.push("team-hub group: real club-specific empty state is missing");
        if (!groupEmpty.includes("Be the first to post")) errors.push("team-hub group: empty-state composer action is missing");
        await page.locator("main.hc-team-fan-group-page .hc-feed-empty button").click();
        const composerFocused = await page.locator("#fan-group-post-body").evaluate(element => element === document.activeElement);
        if (!composerFocused) errors.push("team-hub group: empty-state action did not focus the locked group composer");
        moderatorViewingGroup = true;
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByText("Post visible to the group moderator").waitFor({ state: "visible", timeout: 15000 });
        assert.ok(await page.getByRole("button", { name: "Pin", exact: true }).isVisible());
        assert.equal(await page.locator("#fan-group-post-body").count(), 0);
        assert.equal(await page.getByPlaceholder("Write a comment…").count(), 0);
        assert.equal(await page.getByRole("button", { name: "Report", exact: true }).count(), 0);
        moderatorViewingGroup = false;
      }
      if (requestedPath === "/theme-card-audit") {
        const previews = await page.locator("main.hc-card-audit-page .hc-card-audit-preview").count();
        if (previews !== 4) errors.push("theme-card-audit: expected light and dark card and live hub specimens; got " + previews);
        for (const themePreview of ["light", "dark"]) {
          const preview = page.locator(".hc-card-audit-preview[data-theme-preview='" + themePreview + "']");
          assert.equal(await preview.count(), 2, `theme-card-audit: expected both ${themePreview} specimens`);
          for (const selector of [".hc-live-empty", ".hc-live-empty__icon", ".hc-live-section-heading h2 span", ".hc-live-hub-filters", ".hc-live-hub-card"]) {
            if (await preview.locator(selector).count() === 0) errors.push("theme-card-audit/" + themePreview + ": missing " + selector);
          }
          const chip = await preview.locator(".hc-live-state").evaluate((element) => {
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, color: style.color };
          });
          const expected = themePreview === "dark"
            ? { background: "rgb(27, 27, 27)", color: "rgb(245, 245, 240)" }
            : { background: "rgb(248, 248, 246)", color: "rgb(21, 21, 21)" };
          assert.deepEqual(chip, expected, `theme-card-audit: ${themePreview} status chip must use its preview's paired tokens`);
        }
      }
      if (requestedPath === "/live-games") {
        const audit = await page.evaluate(() => {
          const read = (value) => {
            const element = typeof value === "string" ? document.querySelector(value) : value;
            if (!element) return null;
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, color: style.color, text: (element.textContent || "").trim() };
          };
          return {
            emptyCards: Array.from(document.querySelectorAll(".hc-live-empty")).map((element) => {
              const heading = element.querySelector("h3");
              const body = element.querySelector("p");
              const icon = element.querySelector(".hc-live-empty__icon");
              const style = (node) => node ? getComputedStyle(node) : null;
              return {
                background: style(element).backgroundColor,
                color: style(element).color,
                headingColor: style(heading)?.color || null,
                bodyColor: style(body)?.color || null,
                iconBackground: style(icon)?.backgroundColor || null,
                iconColor: style(icon)?.color || null,
              };
            }),
            countBadges: Array.from(document.querySelectorAll(".hc-live-section-heading h2 span")).map(read),
            filterCard: read(".hc-live-hub-filters"),
            recentEmpty: (() => {
              const element = document.querySelector(".hc-live-recent-empty");
              if (!element) return null;
              const style = getComputedStyle(element);
              return { background: style.backgroundColor, color: style.color, borderStyle: style.borderStyle };
            })(),
            populatedGameCards: document.querySelectorAll(".hc-live-hub-card").length,
          };
        });
        const raised = theme === "dark" ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)";
        const soft = theme === "dark" ? "rgb(27, 27, 27)" : "rgb(248, 248, 246)";
        const foreground = theme === "dark" ? "rgb(245, 245, 240)" : "rgb(21, 21, 21)";
        const muted = theme === "dark" ? "rgb(184, 184, 179)" : "rgb(102, 102, 97)";
        const accent = "rgb(255, 90, 31)";
        if (audit.emptyCards.length !== 2) errors.push("live-games: expected two empty-state cards; got " + audit.emptyCards.length);
        for (const [index, card] of audit.emptyCards.entries()) {
          if (card.background !== raised || card.color !== foreground || card.headingColor !== foreground || card.bodyColor !== muted) {
            errors.push("live-games: empty card " + index + " has unpaired surface/foreground tokens: " + JSON.stringify(card));
          }
          if (card.iconBackground !== soft || card.iconColor !== accent) {
            errors.push("live-games: empty card icon chip lost its paired tint: " + JSON.stringify(card));
          }
        }
        if (audit.countBadges.length !== 3) errors.push("live-games: expected three section count badges; got " + audit.countBadges.length);
        for (const [index, badge] of audit.countBadges.entries()) {
          if (badge.text !== "0" || badge.background !== soft || badge.color !== foreground) {
            errors.push("live-games: count badge " + index + " is blank or has an unpaired theme: " + JSON.stringify(badge));
          }
        }
        if (audit.filterCard?.background !== raised) errors.push("live-games: filter card surface regressed: " + JSON.stringify(audit.filterCard));
        if (audit.recentEmpty?.borderStyle !== "dashed" || audit.recentEmpty?.color !== muted) errors.push("live-games: Recently Finished empty state lost its readable dashed treatment: " + JSON.stringify(audit.recentEmpty));
        if (audit.populatedGameCards !== 0) errors.push("live-games: empty-fixture test unexpectedly rendered game cards");
        result.liveHubPairing = audit;

        liveGameFixtureMode = "populated";
        await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
        await page.locator("main.hc-live-hub-page").waitFor({ state: "visible", timeout: 15000 });
        await page.waitForFunction(() => document.querySelectorAll("main.hc-live-hub-page .hc-live-hub-card").length >= 3, null, { timeout: 15000 });
        const populatedAudit = await page.evaluate(() => {
          const read = (value) => {
            const element = typeof value === "string" ? document.querySelector(value) : value;
            if (!element) return null;
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, color: style.color, text: (element.textContent || "").trim() };
          };
          return {
            cards: Array.from(document.querySelectorAll("main.hc-live-hub-page .hc-live-hub-card")).map(read),
            counts: Array.from(document.querySelectorAll("main.hc-live-hub-page .hc-live-section-heading h2 span")).map(read),
            filter: read(document.querySelector("main.hc-live-hub-page .hc-live-hub-filters")),
            hero: read(document.querySelector("main.hc-live-hub-page .hc-live-hub-hero")),
            heroTitle: read(document.querySelector("main.hc-live-hub-page .hc-live-hub-hero h1")),
            heroEyebrow: read(document.querySelector("main.hc-live-hub-page .hc-live-hub-hero .eyebrow")),
            heroSubtitle: read(document.querySelector("main.hc-live-hub-page .hc-live-hub-hero > div:first-child > p:last-child")),
            crests: Array.from(document.querySelectorAll("main.hc-live-hub-page .hc-live-card__crest")).map(read),
            mutedLabels: Array.from(document.querySelectorAll("main.hc-live-hub-page .hc-live-card__league, main.hc-live-hub-page .hc-live-card__meta, main.hc-live-hub-page .hc-live-card__muted, main.hc-live-hub-page .hc-live-card__vs, main.hc-live-hub-page .hc-live-card__middle small")).map(read),
            liveChatEntry: read(document.querySelector("main.hc-live-hub-page .hc-live-join")),
            liveChatLinks: document.querySelectorAll('main.hc-live-hub-page a[href^="/fan-live?gameId="]').length,
            renderedText: document.querySelector("main.hc-live-hub-page")?.innerText || "",
          };
        });
        if (populatedAudit.cards.length !== 3) errors.push("live-games: populated fixture did not render three real GameCard rows");
        for (const [index, card] of populatedAudit.cards.entries()) {
          if (card.background !== raised || card.color !== foreground) errors.push("live-games: populated GameCard " + index + " has an unpaired theme: " + JSON.stringify(card));
        }
        if (populatedAudit.counts.length !== 3 || populatedAudit.counts.some(badge => badge.text !== "1" || badge.background !== soft || badge.color !== foreground)) {
          errors.push("live-games: populated section badges are not visibly paired: " + JSON.stringify(populatedAudit.counts));
        }
        if (populatedAudit.filter?.background !== raised || populatedAudit.filter?.color !== foreground) errors.push("live-games: populated filter card surface/foreground regressed");
        if (populatedAudit.hero?.background !== raised || populatedAudit.hero?.color !== foreground || populatedAudit.heroTitle?.color !== foreground ||
            populatedAudit.heroEyebrow?.color !== accent || populatedAudit.heroSubtitle?.color !== muted) {
          errors.push("live-games: hero dark-surface/light-ink pairing regressed: " + JSON.stringify({hero:populatedAudit.hero, title:populatedAudit.heroTitle, eyebrow:populatedAudit.heroEyebrow, subtitle:populatedAudit.heroSubtitle}));
        }
        if (populatedAudit.crests.length !== 6 || populatedAudit.crests.some(crest => crest.background !== soft || crest.color !== foreground)) {
          errors.push("live-games: team logo chips lost their paired surface/foreground tokens: " + JSON.stringify(populatedAudit.crests));
        }
        if (populatedAudit.mutedLabels.some(label => label.color !== muted)) errors.push("live-games: populated card metadata is not using readable muted foreground: " + JSON.stringify(populatedAudit.mutedLabels));
        if (populatedAudit.liveChatLinks < 1 || populatedAudit.liveChatEntry?.background !== "rgb(255, 90, 31)" || populatedAudit.liveChatEntry?.color !== "rgb(17, 17, 17)") {
          errors.push("live-games: live chat entry is missing or its text/surface pair is unreadable: " + JSON.stringify(populatedAudit.liveChatEntry));
        }
        if (["KICKER", "TITLE", "Subtitle", "TEAM FIRST", "Fan Only Note", "Composer Placeholder", "EMPTY TITLE", "EMPTY KICKER", "Empty Body", "Lorem", "TODO", "Placeholder"].some(term => populatedAudit.renderedText.includes(term))) {
          errors.push("live-games: populated route rendered scaffold text");
        }
        result.liveHubPopulated = populatedAudit;
        liveGameFixtureMode = "empty";
      }
      if (result.themeClass !== theme) errors.push("html theme class mismatch");
      if (result.body !== expectedPage) errors.push("body background mismatch");
      if (result.pageWrapper && result.pageWrapper !== expectedPage) errors.push("main background mismatch");
      if (result.navigationError) errors.push("navigation error");
      if (result.scaffoldMatches?.length) errors.push("rendered scaffold strings: " + result.scaffoldMatches.join(", "));
      const isFanRoute = requestedPath === "/fan-feed" || requestedPath === "/team-hub" || requestedPath.startsWith("/team-hub/groups/") || requestedPath.startsWith("/womens/");
      if (isFanRoute) {
        const fanScaffoldCount = result.scaffoldMatches?.length || 0;
        console.log("FAN_ROUTE_SCAFFOLD_HITS=" + fanScaffoldCount + " route=" + requestedPath);
        if (fanScaffoldCount) errors.push("fan route scaffold hits: " + requestedPath + " -> " + result.scaffoldMatches.join(", "));
      }
      if (result.bodyTopPadding < result.safeAreaTop - 1) errors.push("top safe-area padding missing");
      if (result.headerTop !== null && result.headerTop < result.safeAreaTop - 1) errors.push("header overlaps the status-bar safe area");
      if (result.mainTop !== null && result.mainTop < result.safeAreaTop - 1) errors.push("main content overlaps the status-bar safe area");
      if (result.tabBarBottomPadding !== null && result.tabBarBottomPadding < result.safeAreaBottom - 1) errors.push("bottom tab bar overlaps the home-indicator safe area");
      if (result.criticalControlContrast.length) errors.push("low contrast critical controls: " + JSON.stringify(result.criticalControlContrast));
      if (theme === "dark" && result.whiteSurfaceOffenders.length) errors.push("white surface offenders: " + JSON.stringify(result.whiteSurfaceOffenders));
      if (result.lowContrastText.length) errors.push("low contrast text: " + JSON.stringify(result.lowContrastText));
      if (["/dashboard", "/search", "/teams/b79a5635-4531-4cc9-981d-103f9b61b9c2"].includes(requestedPath)) {
        const visibleText = await page.locator("body").innerText();
        const expectedText = testLanguage === "es"
          ? requestedPath === "/dashboard" ? ["ACCIONES RÁPIDAS", "CONSULTAR UN EQUIPO"]
            : requestedPath === "/search" ? ["CONEXIÓN ENTRE JUGADORES", "EMPIEZA A INVESTIGAR"]
            : ["TABLERO DE PLANTILLA", "AÚN NO HAY RESEÑAS APROBADAS"]
          : requestedPath === "/dashboard" ? ["QUICK ACTIONS", "Check a Team"]
            : requestedPath === "/search" ? ["PLAYER CONNECT", "Start Researching"]
            : ["ROSTER BOARD", "No approved reviews yet"];
        const missingText = expectedText.filter((expected) => !visibleText.toLocaleUpperCase().includes(expected.toLocaleUpperCase()));
        if (missingText.length) errors.push("language assertions missing: " + missingText.join(", "));
      }
      // Directory results hydrate after the route shell. Capture populated content,
      // not the temporary scanning/loading placeholder.
      if (requestedPath === "/teams" || requestedPath === "/search?q=Baku") {
        await page.locator(".hc-team-logo--image").first().waitFor({ state: "visible", timeout: 15000 });
        await page.locator(".hc-team-logo--fallback").first().waitFor({ state: "visible", timeout: 15000 });
      }
      await page.screenshot({
        path: `${artifactsDir}/routes/${requestedPath.replace(/[^a-z0-9-]+/gi, "_")}-${theme}-${testLanguage}-mobile.png`,
        fullPage: true,
        animations: "disabled",
      });
      if (requestedPath === "/search?q=Baku") {
        await page.locator(".hc-team-logo--image").first().waitFor({ state: "visible", timeout: 10000 });
        await page.locator(".hc-team-logo--fallback").first().waitFor({ state: "visible", timeout: 10000 });
        await page.screenshot({ path: `${artifactsDir}/search-results-approved-and-fallback-${theme}.png`, fullPage: true, animations: "disabled" });
      }
      if (requestedPath === "/teams") {
        await page.locator(".hc-team-logo--image").first().waitFor({ state: "visible", timeout: 10000 });
        await page.locator(".hc-team-logo--fallback").first().waitFor({ state: "visible", timeout: 10000 });
        await page.screenshot({ path: `${artifactsDir}/team-directory-approved-and-fallback-${theme}.png`, fullPage: true, animations: "disabled" });
      }
      if (requestedPath === "/teams/b79a5635-4531-4cc9-981d-103f9b61b9c2") {
        await page.locator(".hc-team-logo--image").first().waitFor({ state: "visible", timeout: 10000 });
        await page.screenshot({ path: `${artifactsDir}/team-profile-approved-logo-${theme}.png`, fullPage: true, animations: "disabled" });
      }
      if (requestedPath === "/teams/a2f9b1c4-92a3-4c89-bdd4-1d8e57a7c8f0") {
        await page.locator(".hc-team-logo--fallback").first().waitFor({ state: "visible", timeout: 10000 });
        await page.screenshot({ path: `${artifactsDir}/team-profile-hexagon-fallback-${theme}.png`, fullPage: true, animations: "disabled" });
      }
      if (requestedPath === "/admin/team-logos" && testLanguage === "en") {
        await page.getByRole("button", { name: "Search teams by name, city or country" }).click();
        const teamSearch = page.getByRole("dialog").locator("input").first();
        await teamSearch.waitFor({ state: "visible", timeout: 10000 });
        await teamSearch.fill("A.B.B Ego Spor");
        await page.getByRole("button", { name: /A\.B\.B Ego Spor/ }).click();
        await page.getByRole("button", { name: "Fetch candidate previews" }).waitFor({ state: "visible", timeout: 10000 });
        await page.locator("select").first().waitFor({ state: "visible", timeout: 10000 });
        await page.locator("select").first().selectOption("light");
        await page.locator("textarea").first().fill("https://official.example/club");
        await page.route("**/api/admin/team-logo-candidate", route => route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            imageData: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23FF5A1F%22%2F%3E%3C%2Fsvg%3E",
            mimeType: "image/svg+xml",
            imageUrl: "https://official.example/logo.svg",
          }),
        }));
        await page.getByRole("button", { name: "Fetch candidate previews" }).click();
        await page.locator('img[alt="Logo candidate preview"]').waitFor({ state: "visible", timeout: 10000 });
        await page.screenshot({ path: `${artifactsDir}/admin-logo-candidate-approval-flow-${theme}.png`, fullPage: true, animations: "disabled" });
      }
      routeSweepResults.push({ theme, ...result, status: errors.length ? "FAIL" : result.pageWrapper ? "PASS" : "NO_MAIN", reason: errors.join("; ") || (result.pageWrapper ? "" : "route rendered no main element") });
    }
    if (testLanguage === "en") {
      await page.goto(baseURL + "/settings", { waitUntil: "domcontentloaded" });
      await page.locator(".language-select").waitFor({ state: "visible", timeout: 30000 });
      const beforeSwitchOrigin = await page.evaluate(() => performance.timeOrigin);
      await page.screenshot({ path: `${artifactsDir}/language-live-01-settings-en.png`, fullPage: true, animations: "disabled" });
      await page.locator(".language-select").selectOption("es");
      await page.waitForFunction(() => document.documentElement.lang === "es", null, { timeout: 10000 });
      await page.getByRole("heading", { name: "AJUSTES" }).waitFor({ state: "visible", timeout: 10000 });
      await page.screenshot({ path: `${artifactsDir}/language-live-02-settings-es.png`, fullPage: true, animations: "disabled" });
      assert.equal(await page.evaluate(() => performance.timeOrigin), beforeSwitchOrigin, "language selection reloaded the document");
      await page.locator("a.site-header-brand").click();
      await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
      await page.getByRole("heading", { name: "ACCIONES RÁPIDAS" }).waitFor({ state: "visible", timeout: 15000 });
      await page.getByText("Consultar un equipo", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
      await page.screenshot({ path: `${artifactsDir}/language-live-03-dashboard-es.png`, fullPage: true, animations: "disabled" });
      assert.equal(await page.evaluate(() => performance.timeOrigin), beforeSwitchOrigin, "dashboard navigation performed a full document reload");
      await page.locator('a[href="/teams"]:visible').first().click();
      await page.waitForURL(/\/teams$/, { timeout: 15000 });
      await page.locator('a[href="/teams/' + teamFixture.id + '"]').first().click();
      await page.waitForURL(new RegExp("/teams/" + teamFixture.id + "$"), { timeout: 15000 });
      await page.waitForFunction(() => document.body.innerText.toLocaleUpperCase().includes("TABLERO DE PLANTILLA"), null, { timeout: 15000 });
      const translatedTeamText = (await page.locator("body").innerText()).toLocaleUpperCase();
      assert.ok(translatedTeamText.includes("TABLERO DE PLANTILLA"), "team page did not retain Spanish after client-side navigation");
      await page.screenshot({ path: `${artifactsDir}/language-live-04-team-es.png`, fullPage: true, animations: "disabled" });
      assert.equal(await page.evaluate(() => performance.timeOrigin), beforeSwitchOrigin, "team navigation performed a full document reload");
      console.log("LANGUAGE_LIVE_SWITCH=PASS; reloads=0; screenshots=4");
    }
    await context.close();
  }
  console.log("THEME_COMPONENT_INVENTORY=" + JSON.stringify(themeComponentInventory, null, 2));
  console.log("THEME_ROUTE_SWEEP=" + JSON.stringify(routeSweepResults, null, 2));

} finally {
  await browser.close();
}
console.log("THEME_COMPUTED_STYLES=" + JSON.stringify(results, null, 2));
