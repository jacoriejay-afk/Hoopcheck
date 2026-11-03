#!/usr/bin/env node
/**
 * Desktop DOM overlap audit. Run against a seeded HoopCheck deployment:
 * BASE_URL=https://... node scripts/desktop-overlap-check.mjs
 * Optional ROUTES_JSON='["/","/teams","/teams/<real-slug>",...]' supplies real detail routes.
 * Requires Playwright to be installed in the invoking environment.
 */
import fs from "node:fs";
import path from "node:path";

const baseURL = process.env.BASE_URL;
if (!baseURL) throw new Error("Set BASE_URL to the deployment under test.");
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  throw new Error("Playwright is required. Install it in the test environment (npm i -D playwright) and install Chromium.");
}
if (!process.env.ROUTES_JSON) throw new Error("Set ROUTES_JSON to the 16 real, accessible route paths (including real entity slugs) for this environment.");
const routes = JSON.parse(process.env.ROUTES_JSON);
const widths = [1920, 1440, 1280, 1024];
const outDir = process.env.SCREENSHOT_DIR || "artifacts/desktop-layout";
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];
const allowedAnchors = "[data-overlap-allowed],.hc-trust-score-ring,.hc-live-dot,.hc-status-dot,.badge,.pill,.notification-count";
try {
  for (const theme of ["dark", "light"]) {
    for (const width of widths) {
      for (const route of routes) {
        const page = await browser.newPage({ viewport: { width, height: 1100 }, deviceScaleFactor: 1 });
        await page.addCookies([{ name: "hoopcheck-theme", value: theme, url: baseURL }]);
        const url = new URL(route, baseURL).toString();
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
          await page.evaluate(() => document.fonts.ready.then(() => true));
          const audit = await page.evaluate((allowed) => {
            const visible = (el) => {
              const s = getComputedStyle(el), r = el.getBoundingClientRect();
              return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0 &&
                r.width > 1 && r.height > 1 && !el.closest(allowed) &&
                !el.matches("[aria-hidden='true'],script,style,template");
            };
            const overlaps = [];
            for (const parent of document.querySelectorAll("body *")) {
              const children = [...parent.children].filter(visible);
              for (let i = 0; i < children.length; i++) for (let j = i + 1; j < children.length; j++) {
                const a = children[i].getBoundingClientRect(), b = children[j].getBoundingClientRect();
                const w = Math.min(a.right,b.right)-Math.max(a.left,b.left);
                const h = Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
                if (w > 1 && h > 1) overlaps.push({
                  parent: parent.tagName.toLowerCase() + (parent.className && typeof parent.className === "string" ? "." + parent.className.trim().split(/\\s+/).slice(0,2).join(".") : ""),
                  a: children[i].tagName.toLowerCase() + "." + String(children[i].className || "").trim().split(/\\s+/).slice(0,2).join("."),
                  b: children[j].tagName.toLowerCase() + "." + String(children[j].className || "").trim().split(/\\s+/).slice(0,2).join("."),
                  intersection: [Math.round(w), Math.round(h)]
                });
              }
            }
            const header = document.querySelector(".hc-desktop-header");
            return { title: document.title, overlapCount: overlaps.length, overlaps: overlaps.slice(0,40),
              headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
              horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
          }, allowedAnchors);
          const safeRoute = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
          const shot = path.join(outDir, `${theme}-${width}-${safeRoute}.png`);
          await page.screenshot({ path: shot, fullPage: true, animations: "disabled" });
          const row = { theme, width, route, ...audit, screenshot: shot };
          results.push(row);
          if (audit.overlapCount || audit.horizontalOverflow || (width >= 1024 && audit.headerHeight !== 64)) failures.push(row);
        } catch (error) {
          const row = { theme, width, route, error: String(error) };
          results.push(row); failures.push(row);
        } finally { await page.close(); }
      }
    }
  }
  // Mobile regression spot-check: verify desktop header hidden; bottom nav remains present.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.addCookies([{ name: "hoopcheck-theme", value: "dark", url: baseURL }]);
  await mobile.goto(new URL("/", baseURL).toString(), { waitUntil: "networkidle", timeout: 45000 });
  const mobileState = await mobile.evaluate(() => ({
    desktopHeaderVisible: !!document.querySelector(".hc-desktop-header") && getComputedStyle(document.querySelector(".hc-desktop-header")).display !== "none",
    bottomNavVisible: !!document.querySelector(".bottom-nav, .hc-bottom-nav, nav[aria-label*='Bottom']") &&
      getComputedStyle(document.querySelector(".bottom-nav, .hc-bottom-nav, nav[aria-label*='Bottom']")).display !== "none"
  }));
  results.push({ mobileWidth: 390, mobileState });
  if (mobileState.desktopHeaderVisible) failures.push({ mobileWidth: 390, mobileState });
  fs.writeFileSync(path.join(outDir, "overlap-report.json"), JSON.stringify({ baseURL, routes, widths, results, failures }, null, 2));
  console.log(JSON.stringify({ pagesChecked: results.length - 1, mobileState, failures: failures.length, report: path.join(outDir, "overlap-report.json") }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally { await browser.close(); }
