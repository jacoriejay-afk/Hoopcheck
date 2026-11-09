import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const site = process.env.THEME_TEST_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : { channel: 'chrome' }),
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  let releaseInstall;
  const installGate = new Promise(resolve => { releaseInstall = resolve; });
  const offlineRequested = context.waitForEvent('request', { predicate: request => new URL(request.url()).pathname === '/offline' });
  await context.route('**/offline', async route => {
    await installGate;
    await route.continue();
  });
  await page.goto(site + '/login');
  await offlineRequested;
  const email = page.getByLabel('Email', { exact: true });
  await email.fill('first-install@example.invalid');
  const origin = await page.evaluate(() => performance.timeOrigin);
  releaseInstall();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  // A controllerchange-triggered reload would replace the document and form.
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin, 'First service worker installation must preserve the current document');
  assert.equal(await email.inputValue(), 'first-install@example.invalid', 'First installation must preserve form input');
  console.log('PASS first service worker installation preserves the login document and entered email');
  await context.close();
} finally {
  await browser.close();
}
