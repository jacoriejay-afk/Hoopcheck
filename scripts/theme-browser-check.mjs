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

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  for (const theme of ["dark", "light"]) {
    for (const routeName of ["dashboard", "feed", "admin"]) {
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
      const wrapperSelector = routeName === "dashboard" ? "main.hc-ia-home, main.hc-dashboard-shell" : routeName === "feed" ? "main.hc-feed-page" : "main.admin-directory-shell";
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
          pageWrapper: color(wrapperSelector.split(",")[0]),
          composer: routeName === "feed" ? color(".hc-feed-composer") : null,
          topicChip: routeName === "feed" ? color(".hc-feed-topic-chip") : null,
          filterChip: routeName === "feed" ? color(".hc-feed-filter-chip:not(.is-active)") : null,
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
      const expectedPage = theme === "dark" ? "rgb(10, 10, 10)" : "rgb(244, 244, 241)";
      const expectedCard = theme === "dark" ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)";
      const expectedChip = theme === "dark" ? "rgb(27, 27, 27)" : "rgb(248, 248, 246)";
      assert.equal(computed.body, expectedPage, `${routeName}/${theme}: body background mismatch`);
      assert.equal(computed.pageWrapper, expectedPage, `${routeName}/${theme}: page wrapper background mismatch`);
      if (routeName === "feed") {
        assert.equal(computed.composer, expectedCard, `feed/${theme}: composer background mismatch`);
        assert.equal(computed.topicChip, expectedChip, `feed/${theme}: topic chip background mismatch`);
        assert.equal(computed.filterChip, expectedChip, `feed/${theme}: filter chip background mismatch`);
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
    "/teams", "/teams/b79a5635-4531-4cc9-981d-103f9b61b9c2", "/teams/a2f9b1c4-92a3-4c89-bdd4-1d8e57a7c8f0", "/admin/team-logos", "/coaches", "/coaches/11111111-1111-4111-8111-111111111111", "/leagues", "/players", "/womens", "/directory",
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
      else if (url.pathname.includes("/rest/v1/profiles")) data = single || (url.searchParams.get("id") || "").startsWith("eq.") ? profile : [profile];
      else if (url.pathname.includes("/rest/v1/subscriptions")) data = single || (url.searchParams.get("user_id") || "").startsWith("eq.") ? subscription : [subscription];
      else if (url.pathname.includes("/rest/v1/teams")) { const requestedId = (url.searchParams.get("id") || "").replace(/^eq\./, ""); data = requestedId ? (requestedId === fallbackTeamFixture.id ? fallbackTeamFixture : teamFixture) : [teamFixture, fallbackTeamFixture]; }
      else if (url.pathname.includes("/rest/v1/leagues")) data = single ? leagueFixture : [leagueFixture];
      else if (url.pathname.includes("/rest/v1/coaches")) data = single ? coachFixture : [coachFixture];
      else if (url.pathname.includes("/rest/v1/fan_live_games")) data = [{
        id: "22222222-2222-4222-8222-222222222222",
        team_id: teamFixture.id,
        opponent_team_id: null,
        opponent_name: "Upcoming QA Opponent",
        status: "scheduled",
        home_score: null,
        away_score: null,
        started_at: null,
        ends_at: null,
        scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        league_id: leagueFixture.id,
        league_name: leagueFixture.name,
        country: "Türkiye",
        period_label: null,
      }];
      else if (url.pathname.includes("/rest/v1/team_league_memberships")) data = [];
      else if (url.pathname.includes("/rest/v1/reviews")) data = [];
      else if (url.pathname.includes("/rest/v1/team_roster_spots")) data = [];
      else if (url.pathname.includes("/rest/v1/follow_relationships")) data = single ? null : [];
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
      try {
        await page.goto(baseURL + requestedPath, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(300);
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
      if (requestedPath === "/dashboard") {
        await page.locator(".hc-ia-identity").waitFor({ state: "visible", timeout: 15000 });
        await page.locator(".hc-ia-completion").waitFor({ state: "visible", timeout: 15000 });
        await page.locator(".hc-ia-door").first().waitFor({ state: "visible", timeout: 15000 });
      }
      if (requestedPath === "/feed") await page.locator(".hc-feed-composer").waitFor({ state: "visible", timeout: 15000 });
      if (requestedPath === "/live-games") {
        await page.locator(".hc-live-state").waitFor({ state: "visible", timeout: 15000 });
        await page.locator(".hc-remind-button").waitFor({ state: "visible", timeout: 15000 });
      }
      if (requestedPath === "/teams/" + teamFixture.id) await page.locator(".hc-team-profile-hero h1").waitFor({ state: "visible", timeout: 15000 });
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
          headerPair: (() => { const el=document.querySelector(".site-header-global"); if(!el)return null; const st=getComputedStyle(el); const label=el.querySelector("a,button"); return {background:st.backgroundColor,color:st.color,labelColor:label?getComputedStyle(label).color:null}; })(),
          bottomNavPair: (() => { const el=document.querySelector(".hc-lm2f-bottom-nav,.hc-bottom-tab-bar,.bottom-nav"); if(!el)return null; const st=getComputedStyle(el); const tab=el.querySelector(".hc-lm2f-tab:not(.active),a:not(.active)"); const active=el.querySelector(".hc-lm2f-tab.active,a.active"); return {background:st.backgroundColor,color:st.color,tabColor:tab?getComputedStyle(tab).color:null,activeColor:active?getComputedStyle(active).color:null}; })(),
          quickAccessRow: (() => { const el=document.querySelector(".hc-ia-door"); if(!el)return null; const st=getComputedStyle(el); const title=el.querySelector("strong"); return {background:st.backgroundColor,color:st.color,borderColor:st.borderTopColor,title:title?getComputedStyle(title).color:null,titleText:title?.textContent?.trim()||null}; })(),
          identityChip: (() => { const el=document.querySelector(".hc-ia-identity"); if(!el)return null; const st=getComputedStyle(el); const title=el.querySelector("strong"); return {background:st.backgroundColor,color:st.color,title:title?getComputedStyle(title).color:null}; })(),
          completionCard: (() => { const el=document.querySelector(".hc-ia-completion"); if(!el)return null; const st=getComputedStyle(el); const title=el.querySelector("strong"); return {background:st.backgroundColor,color:st.color,title:title?getComputedStyle(title).color:null}; })(),
          homeLiveCard: (() => { const el=document.querySelector(".hc-ia-live-strip"); if(!el)return null; const st=getComputedStyle(el); const title=el.querySelector("strong"); return {background:st.backgroundColor,color:st.color,title:title?getComputedStyle(title).color:null}; })(),
          teamProfileHeader: (() => { const el=document.querySelector(".hc-team-profile-hero"); if(!el)return null; const st=getComputedStyle(el); const title=el.querySelector("h1"); const meta=el.querySelector(".hc-team-profile-meta"); return {background:st.backgroundColor,color:st.color,borderColor:st.borderTopColor,title:title?getComputedStyle(title).color:null,meta:meta?getComputedStyle(meta).color:null}; })(),
          liveEmpty: (() => { const el=document.querySelector(".hc-live-no-games,.hc-live-empty"); if(!el)return null; const st=getComputedStyle(el); return {background:st.backgroundColor,color:st.color,borderColor:st.borderTopColor}; })(),
          remindButton: (() => { const el=document.querySelector(".hc-remind-button"); if(!el)return null; const st=getComputedStyle(el); return {background:st.backgroundColor,color:st.color,borderColor:st.borderTopColor,text:el.textContent?.trim()||null}; })(),
          upcomingPill: (() => { const el=document.querySelector(".hc-live-state"); if(!el)return null; const st=getComputedStyle(el); return {background:st.backgroundColor,color:st.color,text:el.textContent?.trim()||null}; })(),
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
              if (/(logo|avatar|photo|portrait|image)/i.test(cls)) return false;
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
      const expectedPage = theme === "dark" ? "rgb(10, 10, 10)" : "rgb(244, 244, 241)";
      const errors = [];
      if (result.themeClass !== theme) errors.push("html theme class mismatch");
      if (result.body !== expectedPage) errors.push("body background mismatch");
      if (result.pageWrapper && result.pageWrapper !== expectedPage) errors.push("main background mismatch");
      if (result.navigationError) errors.push("navigation error");
      if (result.bodyTopPadding < result.safeAreaTop - 1) errors.push("top safe-area padding missing");
      if (result.headerTop !== null && result.headerTop < result.safeAreaTop - 1) errors.push("header overlaps the status-bar safe area");
      if (result.mainTop !== null && result.mainTop < result.safeAreaTop - 1) errors.push("main content overlaps the status-bar safe area");
      if (result.tabBarBottomPadding !== null && result.tabBarBottomPadding < result.safeAreaBottom - 1) errors.push("bottom tab bar overlaps the home-indicator safe area");
      if (result.criticalControlContrast.length) errors.push("low contrast critical controls: " + JSON.stringify(result.criticalControlContrast));
      if (theme === "dark" && result.whiteSurfaceOffenders.length) errors.push("white surface offenders: " + JSON.stringify(result.whiteSurfaceOffenders));
      if (result.lowContrastText.length) errors.push("low contrast text: " + JSON.stringify(result.lowContrastText));
      const expectedNavSurface = theme === "dark" ? "rgb(23, 23, 23)" : "rgb(247, 247, 245)";
      const expectedNavText = theme === "dark" ? "rgb(245, 245, 240)" : "rgb(34, 34, 31)";
      if (result.headerPair && result.headerPair.background !== expectedNavSurface) errors.push("Global header surface mismatch: " + JSON.stringify(result.headerPair));
      if (result.bottomNavPair && result.bottomNavPair.background !== expectedNavSurface) errors.push("Bottom tab bar surface mismatch: " + JSON.stringify(result.bottomNavPair));
      if (result.bottomNavPair && result.bottomNavPair.tabColor !== expectedNavText) errors.push("Bottom tab bar label mismatch: " + JSON.stringify(result.bottomNavPair));
      const expectedActiveNavText = theme === "dark" ? "rgb(255, 138, 92)" : "rgb(184, 62, 20)";
      if (result.bottomNavPair && result.bottomNavPair.activeColor && result.bottomNavPair.activeColor !== expectedActiveNavText) errors.push("Bottom tab bar active label mismatch: " + JSON.stringify(result.bottomNavPair));
      if (requestedPath === "/dashboard") {
        const expectedSurface = theme === "dark" ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)";
        const expectedText = theme === "dark" ? "rgb(245, 245, 240)" : "rgb(21, 21, 21)";
        if (result.quickAccessRow?.background !== expectedSurface) errors.push("Quick Access surface mismatch: " + JSON.stringify(result.quickAccessRow));
        if (result.quickAccessRow?.title !== expectedText) errors.push("Quick Access title mismatch: " + JSON.stringify(result.quickAccessRow));
        if (result.identityChip?.background !== expectedSurface) errors.push("Signed-in chip surface mismatch: " + JSON.stringify(result.identityChip));
        if (result.identityChip?.title !== expectedText) errors.push("Signed-in chip text mismatch: " + JSON.stringify(result.identityChip));
        if (result.completionCard?.background !== expectedSurface || result.completionCard?.title !== expectedText) errors.push("Profile completion pair mismatch: " + JSON.stringify(result.completionCard));
        if (result.homeLiveCard?.background !== expectedSurface || result.homeLiveCard?.title !== expectedText) errors.push("Home Live Games pair mismatch: " + JSON.stringify(result.homeLiveCard));
      }
      if (requestedPath === "/teams/" + teamFixture.id) {
        const expectedSurface = theme === "dark" ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)";
        const expectedText = theme === "dark" ? "rgb(245, 245, 240)" : "rgb(21, 21, 21)";
        if (result.teamProfileHeader?.background !== expectedSurface) errors.push("Team profile header surface mismatch: " + JSON.stringify(result.teamProfileHeader));
        if (result.teamProfileHeader?.title !== expectedText) errors.push("Team profile title mismatch: " + JSON.stringify(result.teamProfileHeader));
      }
      if (requestedPath === "/live-games") {
        const expectedEmpty = theme === "dark" ? "rgb(20, 20, 20)" : "rgb(248, 248, 246)";
        const expectedReminder = theme === "dark" ? "rgb(32, 32, 32)" : "rgb(255, 255, 255)";
        if (result.liveEmpty?.background !== expectedEmpty) errors.push("Live empty state surface mismatch: " + JSON.stringify(result.liveEmpty));
        if (result.remindButton?.background !== expectedReminder) errors.push("REMIND ME surface mismatch: " + JSON.stringify(result.remindButton));
        const expectedUpcomingSurface = theme === "dark" ? "rgb(36, 36, 36)" : "rgb(241, 241, 237)";
        const expectedUpcomingText = theme === "dark" ? "rgb(231, 231, 225)" : "rgb(76, 76, 70)";
        const expectedReminderText = theme === "dark" ? "rgb(245, 245, 240)" : "rgb(21, 21, 21)";
        if (result.upcomingPill?.background !== expectedUpcomingSurface || result.upcomingPill?.color !== expectedUpcomingText) errors.push("UPCOMING pill pair mismatch: " + JSON.stringify(result.upcomingPill));
        if (result.remindButton?.color !== expectedReminderText) errors.push("REMIND ME text mismatch: " + JSON.stringify(result.remindButton));
        if (!result.remindButton?.text?.toUpperCase().includes("REMIND ME")) errors.push("REMIND ME label missing: " + JSON.stringify(result.remindButton));
        if (!result.upcomingPill?.text?.toUpperCase().includes("UPCOMING")) errors.push("Upcoming status pill missing: " + JSON.stringify(result.upcomingPill));
      }
      if (["/dashboard", "/search", "/teams/b79a5635-4531-4cc9-981d-103f9b61b9c2"].includes(requestedPath)) {
        const visibleText = await page.locator("body").innerText();
        const expectedText = testLanguage === "es"
          ? requestedPath === "/dashboard" ? ["YOUR SHORTCUTS", "QUICK ACCESS", "SIGNED IN AS", "COMPLETE YOUR PROFILE", "LIVE GAMES"]
            : requestedPath === "/search" ? ["CONEXIÓN ENTRE JUGADORES", "EMPIEZA A INVESTIGAR"]
            : ["TABLERO DE PLANTILLA", "AÚN NO HAY RESEÑAS APROBADAS"]
          : requestedPath === "/dashboard" ? ["YOUR SHORTCUTS", "Quick Access"]
            : requestedPath === "/search" ? ["PLAYER CONNECT", "Start Researching"]
            : ["ROSTER BOARD", "No approved reviews yet"];
        const missingText = expectedText.filter((expected) => !visibleText.toLocaleUpperCase().includes(expected.toLocaleUpperCase()));
        if (missingText.length) errors.push("language assertions missing: " + missingText.join(", "));
        if (testLanguage === "en" && requestedPath === "/dashboard") {
          const requiredHomeCopy = ["SIGNED IN AS","COMPLETE YOUR PROFILE","LIVE GAMES","MEN'S TEAMS","WOMEN'S TEAMS","COACHES","LEAGUES"];
          const normalizedHomeText = visibleText.toLocaleUpperCase().replace(/[’‘]/g, "'");
          const missingHomeCopy = requiredHomeCopy.filter((label) => !normalizedHomeText.includes(label));
          if (missingHomeCopy.length) errors.push("Home card copy missing: " + missingHomeCopy.join(", "));
        }
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
        await page.locator("select").first().waitFor({ state: "visible", timeout: 10000 });
        await page.locator("select").first().selectOption({ index: 1 });
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
      await page.locator(".hc-ia-identity").waitFor({ state: "visible", timeout: 15000 });
      await page.locator(".hc-ia-door").first().waitFor({ state: "visible", timeout: 15000 });
      await page.screenshot({ path: `${artifactsDir}/language-live-03-dashboard-es.png`, fullPage: true, animations: "disabled" });
      assert.equal(await page.evaluate(() => performance.timeOrigin), beforeSwitchOrigin, "dashboard navigation performed a full document reload");
      await page.locator('a[href="/teams"]').first().click();
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
  const requiredScreens = ["/dashboard", "/feed", "/search", "/notifications", "/account", "/live-games", "/teams/" + teamFixture.id];
  const requiredFailures = routeSweepResults.filter((result) => requiredScreens.includes(result.requestedPath) && result.status !== "PASS");
  assert.equal(requiredFailures.length, 0, "DM-2 required screen regression: " + JSON.stringify(requiredFailures));
  console.log("DM2_REQUIRED_SCREEN_SWEEP=PASS " + JSON.stringify(requiredScreens));
  console.log("THEME_ROUTE_SWEEP=" + JSON.stringify(routeSweepResults, null, 2));

} finally {
  await browser.close();
}
console.log("THEME_COMPUTED_STYLES=" + JSON.stringify(results, null, 2));
