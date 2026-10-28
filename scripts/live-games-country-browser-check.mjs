import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.LIVE_GAMES_TEST_BASE_URL || "http://127.0.0.1:3000";
const artifactsDir = "artifacts/live-games-country";
await mkdir(artifactsDir, { recursive: true });

const userId = "11111111-1111-4111-8111-111111111111";
const user = {
  id: userId, aud: "authenticated", role: "authenticated",
  email: "live-games-country-test@hoopcheck.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Live Games QA" },
  created_at: "2026-01-01T00:00:00.000Z",
};
const session = {
  access_token: "live-games-country-test-access",
  refresh_token: "live-games-country-test-refresh",
  token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, user,
};
const now = Date.now();
const at = (deltaMinutes) => new Date(now + deltaMinutes * 60_000).toISOString();
const teams = [
  { id: "az-home", name: "Baku Falcons", country: "Azerbaijan", league_name: "Azerbaijan Women’s League", basketball_type: "womens", logo_url: null },
  { id: "az-away", name: "Caspian Stars", country: "Azerbaijan", league_name: "Azerbaijan Women’s League", basketball_type: "womens", logo_url: null },
  { id: "es-home", name: "Madrid Queens", country: "Spain", league_name: "Liga Femenina", basketball_type: "womens", logo_url: null },
  { id: "es-away", name: "Valencia Waves", country: "Spain", league_name: "Liga Femenina", basketball_type: "womens", logo_url: null },
  { id: "lt-home", name: "Vilnius Wolves", country: "Lithuania", league_name: "Women’s Baltic League", basketball_type: "womens", logo_url: null },
  { id: "lt-away", name: "Kaunas Comets", country: "Lithuania", league_name: "Women’s Baltic League", basketball_type: "womens", logo_url: null },
];
const games = [
  { id: "game-az-live", team_id: "az-home", opponent_team_id: "az-away", opponent_name: "Caspian Stars", status: "live", home_score: 42, away_score: 38, started_at: at(-35), ends_at: at(95), scheduled_at: at(-35), league_id: "league-az", league_name: "Azerbaijan Women’s League", country: "Azerbaijan", period_label: "Q3" },
  { id: "game-es-upcoming", team_id: "es-home", opponent_team_id: "es-away", opponent_name: "Valencia Waves", status: "scheduled", home_score: null, away_score: null, started_at: null, ends_at: null, scheduled_at: at(120), league_id: "league-es", league_name: "Liga Femenina", country: "Spain", period_label: null },
  { id: "game-lt-upcoming", team_id: "lt-home", opponent_team_id: "lt-away", opponent_name: "Kaunas Comets", status: "scheduled", home_score: null, away_score: null, started_at: null, ends_at: null, scheduled_at: at(240), league_id: "league-lt", league_name: "Women’s Baltic League", country: "Lithuania", period_label: null },
];

const cors = {
  "access-control-allow-origin": baseURL,
  "access-control-allow-credentials": "true",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,apikey,content-type,prefer,accept,range,x-client-info",
};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    const encodedSession = "base64-" + btoa(unescape(encodeURIComponent(JSON.stringify(session))))
      .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    await context.addCookies([
      { name: "hoopcheck-theme", value: theme, url: baseURL },
      { name: "sb-ci-auth-token", value: encodedSession, url: baseURL },
    ]);
    await context.addInitScript(({ themePreference, authSession }) => {
      localStorage.setItem("hoopcheck-theme", themePreference);
      localStorage.setItem("hoopcheck:fan-basketball-side", "womens");
      localStorage.setItem("sb-ci-auth-token", JSON.stringify(authSession));
    }, { themePreference: theme, authSession: session });

    const page = await context.newPage();
    await page.route("https://ci.invalid/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: cors, body: "" });
        return;
      }
      let data = [];
      if (url.pathname === "/auth/v1/user") data = user;
      else if (url.pathname.includes("/rest/v1/profiles")) data = { id: userId, account_type: "fan", preferred_basketball_side: "womens" };
      else if (url.pathname.includes("/rest/v1/subscriptions")) data = { user_id: userId, plan: "pro", status: "active", current_period_end: null };
      else if (url.pathname.includes("/rest/v1/follow_relationships")) data = [];
      else if (url.pathname.includes("/rest/v1/fan_live_game_reminders")) data = [];
      else if (url.pathname.includes("/rest/v1/fan_live_chat_presence")) data = [];
      else if (url.pathname.includes("/rest/v1/fan_live_games")) data = games;
      else if (url.pathname.includes("/rest/v1/teams")) {
        const select = url.searchParams.get("select") || "";
        if (select === "id") data = teams.map(({ id }) => ({ id }));
        else {
          const ids = (url.searchParams.get("id") || "").replace(/^in\\(|\\)$/g, "").split(",");
          data = ids.length > 1 && ids[0] ? teams.filter(team => ids.includes(team.id)) : teams;
        }
      }
      await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
    });

    await page.goto(baseURL + "/live-games", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator(".hc-live-country-section").first().waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("heading", { name: "BROWSE BY COUNTRY" }).waitFor();
    await page.getByRole("button", { name: "WOMEN'S" }).waitFor();
    assert.equal(await page.locator('.hc-fan-side-switch button[aria-pressed="true"]').innerText(), "WOMEN'S");
    assert.equal(await page.locator(".hc-live-country-section").count(), 3, "Expected three country sections in the test fixture.");
    assert.ok(await page.locator("#country-azerbaijan .hc-live-badge--visible").count() >= 1, "Azerbaijan must show a live game.");
    assert.ok(await page.locator("#country-spain .hc-live-country-league").count() >= 1, "Spain upcoming games should be grouped by league.");
    assert.ok(await page.locator("#country-lithuania .hc-live-country-league").count() >= 1, "Lithuania upcoming games should be grouped by league.");
    assert.ok(await page.getByRole("button", { name: /REMIND ME/i }).count() >= 2, "Upcoming games should keep Remind Me actions.");
    await page.screenshot({ path: `${artifactsDir}/live-games-${theme}-womens-desktop.png`, fullPage: true, animations: "disabled" });

    const countrySearch = page.getByRole("textbox", { name: "Search games by country, team, or league" });
    await countrySearch.fill("Lithuania");
    assert.equal(await page.locator(".hc-live-country-section").count(), 1, "Country-name search should filter to one country.");
    assert.equal(await page.locator(".hc-live-country-section h3").innerText(), "Lithuania");
    await context.close();
  }
  console.log("LIVE_GAMES_COUNTRY_CHECK=PASS");
} finally {
  await browser.close();
}
