import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.LIVE_GAMES_TEST_BASE_URL || "http://127.0.0.1:3000";
const out = "artifacts/shared-motion";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      recordVideo: { dir: out, size: { width: 1280, height: 1000 } },
      reducedMotion: "no-preference",
    });
    await context.addCookies([{ name: "hoopcheck-theme", value: theme, url: baseURL }]);
    await context.addInitScript((value) => {
      localStorage.setItem("hoopcheck-theme", value);
      localStorage.setItem("hoopcheck-theme-preference", value);
    }, theme);
    const page = await context.newPage();
    await page.goto(baseURL + "/motion-preview", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByRole("heading", { name: "Shared Motion System" }).waitFor({ timeout: 15000 });
    await page.getByRole("heading", { name: /Trust Score reveal/ }).waitFor();
    await page.waitForTimeout(1050);
    await page.getByRole("button", { name: "Reveal confirmations" }).click();
    await page.waitForTimeout(650);
    assert.equal(await page.locator(".hc-motion-check__path").count(), 3, "Three confirmation checks should be visible.");
    await page.getByRole("button", { name: "Play tab transition" }).click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".hc-motion-swoosh").count(), 1, "Swoosh should render when motion is allowed.");
    await page.waitForTimeout(370);
    await page.evaluate(() => {
      const target = document.querySelector(".hc-motion-preview-pull");
      if (!target) throw new Error("Pull-to-refresh preview surface missing");
      const makeTouch = (y) => new Touch({ identifier: 1, target, clientX: 40, clientY: y });
      target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [makeTouch(20)] }));
    });
    await page.waitForTimeout(50);
    await page.evaluate(() => {
      const target = document.querySelector(".hc-motion-preview-pull");
      const touch = new Touch({ identifier: 1, target, clientX: 40, clientY: 220 });
      target.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [touch] }));
    });
    await page.waitForTimeout(50);
    await page.evaluate(() => {
      const target = document.querySelector(".hc-motion-preview-pull");
      const touch = new Touch({ identifier: 1, target, clientX: 40, clientY: 220 });
      target.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [touch], touches: [] }));
    });
    await page.waitForTimeout(900);
    assert.match(await page.locator(".hc-motion-preview-pull").innerText(), /Refreshes: 1/);
    assert.equal(await page.locator(".hc-motion-preview-counts strong").count(), 2);
    await page.screenshot({ path: `${out}/motion-${theme}.png`, fullPage: true, animations: "disabled" });
    await context.close();
  }

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await reduced.addCookies([{ name: "hoopcheck-theme", value: "dark", url: baseURL }]);
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(baseURL + "/motion-preview", { waitUntil: "domcontentloaded", timeout: 30000 });
  await reducedPage.getByRole("heading", { name: "Shared Motion System" }).waitFor({ timeout: 15000 });
  await reducedPage.getByRole("button", { name: "Play tab transition" }).click();
  assert.equal(await reducedPage.locator(".hc-motion-swoosh").count(), 0, "Reduced-motion preference should suppress swoosh.");
  await reduced.close();
  console.log("SHARED_MOTION_BROWSER_CHECK=PASS");
} finally {
  await browser.close();
}
