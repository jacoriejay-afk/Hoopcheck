import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000";
const artifacts = "artifacts/stabilization";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const uid = "11111111-1111-4111-8111-111111111111";
const user = { id: uid, aud: "authenticated", role: "authenticated", email: "release-fixture@hoopcheck.invalid", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const now = Math.floor(Date.now() / 1000);
const jwt = Buffer.from(JSON.stringify({ sub: uid, aud: "authenticated", role: "authenticated", iat: now, exp: now + 3600 })).toString("base64url");
const session = { access_token: ["eyJhbGciOiJub25lIn0", jwt, "fixture"].join("."), refresh_token: "fixture", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user };
try {
  for (const width of [390, 1440]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(theme => { localStorage.setItem("hoopcheck-theme", theme); localStorage.setItem("hoopcheck-language", "en"); }, theme);
    const page = await context.newPage();
    await page.route("https://ci.invalid/**", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]", headers: { "access-control-allow-origin": baseURL } }));
    await page.goto(baseURL + "/company");
    await page.locator('main nav a[href="/about"]').click();
    await page.waitForURL(baseURL + "/about");
    await page.locator("main h1").waitFor();
    assert.equal(await page.evaluate(() => history.state.idx), undefined, "App Router provides no idx");
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.waitForURL(baseURL + "/company");
    await page.goForward();
    await page.waitForURL(baseURL + "/about");
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.waitForURL(baseURL + "/company");
    await page.screenshot({ path: `${artifacts}/company-${width}-${theme}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    // A full navigation establishes a new boundary, even with unrelated browser history.
    await page.goto(baseURL + "/login");
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.waitForURL(baseURL + "/");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(baseURL + "/partners");
    assert.equal(await page.locator(".hc-route-transition").evaluate(el => el.getAnimations().length), 0);
    console.log(`PASS ${width}px ${theme}: real App Router Back/Forward, direct-entry fallback, company overflow, reduced motion`);
    await context.close();
  }
  for (const role of ["player", "fan", "agent", "scout", "manager", "coach", "admin"]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: "sb-ci-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url: baseURL }]);
    await context.addInitScript(({ session, theme }) => { localStorage.setItem("sb-ci-auth-token", JSON.stringify(session)); localStorage.setItem("hoopcheck-theme", theme); }, { session, theme });
    const page = await context.newPage();
    await page.route("https://ci.invalid/**", async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { "access-control-allow-origin": baseURL, "access-control-allow-headers": req.headers()["access-control-request-headers"] || "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      let data = [];
      if (url.pathname === "/auth/v1/user") data = user;
      if (url.pathname.endsWith("/profiles")) data = { id: uid, account_type: role === "admin" ? "player" : role, display_name: "Release Fixture", player_verified: false };
      if (url.pathname.endsWith("/subscriptions")) data = role === "admin" ? null : { plan: "premium", status: "active", access_status: "active", current_period_end: null };
      if (url.pathname.includes("/rpc/is_current_user_admin_or_moderator")) data = role === "admin";
      if (url.pathname.includes("/rpc/get_current_user_admin_role")) data = role === "admin" ? "admin" : null;
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(baseURL + "/company");
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await nav.waitFor();
    await page.waitForFunction(() => !document.querySelector('nav[aria-label="Mobile navigation"] a[aria-disabled="true"]'));
    assert.equal(await nav.locator("a").count(), 5);
    assert.equal(await nav.locator("svg").count(), 5);
    const boxes = await nav.locator("svg").evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; }));
    assert.ok(boxes.every(r => r.w === 24 && r.h === 24), JSON.stringify(boxes));
    const destination = role === "fan" ? "/fan-feed" : "/feed";
    await nav.locator(`a[href="${destination}"]`).click();
    await page.waitForURL(baseURL + destination);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.screenshot({ path: `${artifacts}/nav-${role}-${theme}.png`, fullPage: true });
    if (role === "admin") {
      await page.goto(baseURL + "/membership");
      await page.getByRole("heading", { name: "Administrative Premium access is included." }).waitFor();
      assert.equal(await page.getByText("CHOOSE YOUR ACCESS", { exact: true }).count(), 0);
      await page.screenshot({ path: `${artifacts}/membership-admin-${theme}.png`, fullPage: true });
    }
    console.log(`PASS 390px ${role} ${theme}: 5 visible 24px SVG icons, role feed tap, no horizontal overflow (synthetic session)`);
    await context.close();
  }
} finally { await browser.close(); }
