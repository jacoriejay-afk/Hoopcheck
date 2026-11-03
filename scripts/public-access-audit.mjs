#!/usr/bin/env node
/**
 * Public browsing and authentication return-flow audit.
 *
 * Required:
 *   BASE_URL=https://hoopcheck.online
 *   ROUTES_JSON='["/teams","/womens","/coaches","/leagues","/players","/search","/teams/REAL_ID","/coaches/REAL_ID","/leagues/REAL_ID","/players/REAL_ID","/reviews","/live-games"]'
 * Optional signed-in regression:
 *   TEST_EMAIL=... TEST_PASSWORD=...
 *
 * Uses Playwright installed in the repository's test environment.
 */
import fs from "node:fs";
import path from "node:path";

const baseURL = process.env.BASE_URL;
if (!baseURL) throw new Error("Set BASE_URL.");
if (!process.env.ROUTES_JSON) throw new Error("Set ROUTES_JSON with the actual public routes and detail IDs to test.");
const routes = JSON.parse(process.env.ROUTES_JSON);
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { throw new Error("Install Playwright and Chromium in the test environment."); }

const browser = await chromium.launch({ headless: true });
const report = { baseURL, guestRoutes: [], homeSearch: null, signedIn: null, failures: [] };
const outDir = process.env.AUDIT_OUTPUT_DIR || "artifacts/public-access-audit";
fs.mkdirSync(outDir, { recursive: true });
try {
  const guest = await browser.newPage();
  for (const route of routes) {
    try {
      const response = await guest.goto(new URL(route, baseURL).toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
      await guest.waitForTimeout(900);
      const result = await guest.evaluate(() => ({
        path: location.pathname,
        search: location.search,
        title: document.title,
        heading: document.querySelector("h1")?.textContent?.trim() || "",
        text: (document.querySelector("main")?.innerText || document.body.innerText).slice(0, 1200),
      }));
      const redirectedToLogin = result.path === "/login";
      const hasGate = /sign in|sign-in|create account|membership required|available for signed-in members/i.test(result.text);
      const row = { requested: route, status: response?.status() ?? null, result: redirectedToLogin ? "redirected-to-login" : hasGate ? "gate-message-shown" : "content-shown", ...result };
      report.guestRoutes.push(row);
      if (redirectedToLogin) report.failures.push({ route, issue: "Bare login redirect" });
      await guest.screenshot({ path: path.join(outDir, "guest-" + route.replace(/[^a-z0-9]+/gi, "-") + ".png"), fullPage: true });
    } catch (error) {
      report.guestRoutes.push({ requested: route, result: "error", error: String(error) });
      report.failures.push({ route, issue: String(error) });
    }
  }

  const home = await browser.newPage();
  await home.goto(new URL("/", baseURL).toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
  const searchInput = home.locator('form[role="search"] input[name="q"]').first();
  await searchInput.fill("Azerbaijan");
  await searchInput.press("Enter");
  await home.waitForURL(url => url.pathname === "/search" && url.searchParams.get("q") === "Azerbaijan", { timeout: 15000 });
  await home.waitForTimeout(1800);
  report.homeSearch = await home.evaluate(() => ({
    path: location.pathname,
    query: new URLSearchParams(location.search).get("q"),
    resultsVisible: /results|teams|coaches|players|leagues/i.test(document.querySelector("main")?.innerText || ""),
    text: (document.querySelector("main")?.innerText || "").slice(0, 800),
  }));
  if (report.homeSearch.path !== "/search" || report.homeSearch.query !== "Azerbaijan") {
    report.failures.push({ route: "/", issue: "Homepage search query was not preserved in /search?q=" });
  }
  await home.screenshot({ path: path.join(outDir, "guest-home-search.png"), fullPage: true });

  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    const member = await browser.newPage();
    await member.goto(new URL("/login", baseURL).toString(), { waitUntil: "domcontentloaded" });
    await member.locator("#email").fill(process.env.TEST_EMAIL);
    await member.locator("#password").fill(process.env.TEST_PASSWORD);
    await member.locator('form button[type="submit"]').click();
    await member.waitForURL(url => url.pathname !== "/login", { timeout: 30000 });
    const signedInRoutes = [];
    for (const route of routes) {
      await member.goto(new URL(route, baseURL).toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
      await member.waitForTimeout(700);
      const state = await member.evaluate(() => ({ path: location.pathname, heading: document.querySelector("h1")?.textContent?.trim() || "", text: (document.querySelector("main")?.innerText || "").slice(0, 900) }));
      signedInRoutes.push({ requested: route, ...state });
    }
    report.signedIn = { authenticated: true, routes: signedInRoutes };
    await member.close();
  } else {
    report.signedIn = { skipped: true, reason: "Set TEST_EMAIL and TEST_PASSWORD to run the signed-in regression." };
  }

  fs.writeFileSync(path.join(outDir, "public-access-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ guestRoutes: report.guestRoutes.length, homepageSearch: report.homeSearch, signedIn: report.signedIn?.authenticated ? "passed-login-flow-and-route-visits" : "skipped", failures: report.failures.length, reportPath: path.join(outDir, "public-access-report.json") }, null, 2));
  if (report.failures.length) process.exitCode = 1;
} finally { await browser.close(); }
