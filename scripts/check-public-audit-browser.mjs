import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against the built site with the CI Supabase URL and intercepted data.
const site = process.env.THEME_TEST_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : { channel: 'chrome' }),
  args: ['--no-sandbox'],
});
const id = '22222222-2222-4222-8222-222222222222';
const expected = [
  ['Monthly', '$4.99', '$9.99'],
  ['6 months', '$26.95', '$53.95'],
  ['Annual', '$50.90', '$101.90'],
];
try {
  for (const width of [390, 1440]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 920 }, colorScheme: theme, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.route('https://ci.invalid/**', async route => {
        const req = route.request();
        const { pathname } = new URL(req.url());
        const headers = {
          'access-control-allow-origin': site,
          'access-control-allow-methods': 'GET,OPTIONS,HEAD',
          'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*',
        };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const team = { id, name: 'Baku Falcons QA', country: 'Azerbaijan', city: 'Baku', league_name: 'QA League', logo_url: null, basketball_type: 'mens' };
        const response = pathname.endsWith('/teams') || pathname.endsWith('/womens_teams') ? [team] : [];
        return route.fulfill({ status: 200, headers, json: response });
      });
      await page.goto(site + '/membership');
      const group = page.getByRole('group', { name: 'Choose billing term' });
      for (const [period, pro, premium] of expected) {
        const button = group.getByRole('button', { name: new RegExp(period, 'i') });
        await button.click();
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await page.locator('.plan-card .price strong').allTextContents(), [pro, premium]);
      }

      if (width === 390) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        const mobileSignIn = page.getByRole('navigation', { name: 'Primary navigation' })
          .getByRole('link', { name: 'Sign in', exact: true });
        await mobileSignIn.waitFor();
        assert.equal(await mobileSignIn.getAttribute('href'), '/login');
      } else {
        const icon = page.locator('.hc-signin-button svg');
        await icon.waitFor();
        const iconBox = await icon.boundingBox();
        assert.ok(iconBox.width > 0 && iconBox.height > 0);
        assert.equal(await icon.getAttribute('aria-hidden'), 'true');
      }
      for (const prefix of ['teams', 'womens']) {
        await page.goto(site + '/' + prefix + '/' + id);
        const crest = page.locator('.hc-team-profile-topline .hc-team-logo__crest');
        await crest.waitFor();
        assert.equal(await crest.locator('text').textContent(), 'BF');
        assert.equal(await crest.locator('path').evaluate(el => getComputedStyle(el).fill), 'none');
        assert.equal(await crest.locator('text').evaluate(el => getComputedStyle(el).stroke), 'none');
        assert.match(await page.locator('.hc-team-profile-meta').textContent(), /🇦🇿 Azerbaijan/);
        assert.equal(await page.locator('html').evaluate(el => el.classList.contains('theme-' + (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))), true);
      }
      console.log('PASS ' + width + 'px ' + theme + ': six prices, sign-in navigation, both club flags and fallback crests');
      await context.close();
    }
  }
} finally {
  await browser.close();
}
