// Run against the CI-configured local server. All records below are test fixtures.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const baseURL = process.env.THEME_TEST_BASE_URL || 'http://127.0.0.1:3000';
let ready = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try { ready = (await fetch(`${baseURL}/robots.txt`, { signal: AbortSignal.timeout(2000) })).ok; } catch { /* server may still be starting */ }
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(ready, 'Local production server became ready');
const browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : { channel: 'chrome' }), headless: true, args: ['--no-sandbox'] });
const men = { id: '11111111-1111-4111-8111-111111111111', name: 'Discovery Men QA', city: 'Baku', country: 'Azerbaijan', league_name: 'QA League', basketball_type: 'mens', logo_url: null };
const women = { ...men, id: '22222222-2222-4222-8222-222222222222', name: 'Discovery Women QA International Basketball Club With A Long Team Name'  };
try {
  for (const width of [390, 1440]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => { localStorage.setItem('hoopcheck-theme', theme); localStorage.setItem('hoopcheck-language', 'en'); }, theme);
      let failCoaches = false;
      let releaseTeam;
      let holdTeam = false;
      const teamGate = new Promise(resolve => { releaseTeam = resolve; });
      const page = await context.newPage();
      await page.route('https://ci.invalid/**', async route => {
        const req = route.request(), url = new URL(req.url());
        const headers = { 'access-control-allow-origin': baseURL, 'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'cache-control': 'no-store' };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.includes('/coaches') && failCoaches) return route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture category failure' }) });
        let data = [];
        if (url.pathname.includes('/womens_teams')) { if (holdTeam) await teamGate; data = [women]; }
        else if (url.pathname.includes('/teams')) data = [men];
        const single = req.headers().accept?.includes('vnd.pgrst.object');
        await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(single ? data[0] || null : data) });
      });
      await page.goto(`${baseURL}/search?q=Discovery`);
      const maleLink = page.locator(`.result-group a[href="/teams/${men.id}"]`).first();
      const femaleLink = page.locator(`.result-group a[href="/womens/${women.id}"]`).first();
      await maleLink.waitFor(); await femaleLink.waitFor();
      await page.getByRole('button', { name: 'Women’s Teams', exact: true }).click();
      await femaleLink.waitFor();
      await page.waitForFunction(() => !document.querySelector('.result-group a[href^="/teams/"]'));
      // The search can briefly refetch after the category changes. Wait until
      // results are settled before navigating; a stale link may disappear.
      await page.waitForFunction(() => !document.body.innerText.includes('Searching HoopCheck...'));
      await femaleLink.waitFor({ state: 'visible' });
      holdTeam = true;
      try {
        await femaleLink.click({ timeout: 15000 });
      } catch (error) {
        const state = await page.evaluate(() => ({
          url: location.href,
          viewport: innerWidth,
          links: [...document.querySelectorAll('.result-group a[href^="/womens/"]')].map(el => ({
            href: el.getAttribute('href'),
            visible: !!el.getClientRects().length,
            text: el.textContent?.trim().slice(0, 120),
          })),
          bodyText: document.body.innerText.slice(0, 900),
        }));
        console.error('TEAM_DISCOVERY_CLICK_DIAGNOSTIC', JSON.stringify({ width, theme, state }));
        throw error;
      }
      const loader = page.locator('.hc-brand-loader--screen');
      await loader.waitFor({ state: 'visible' });
      await page.waitForFunction(() => {
        const el = document.querySelector('.hc-brand-loader--screen');
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const bounds = await loader.boundingBox();
      assert.ok(bounds && Math.abs(bounds.x + bounds.width / 2 - width / 2) < 8, 'HoopCheck loader is horizontally centered');
      assert.ok(bounds && Math.abs(bounds.y + bounds.height / 2 - 450) < 120, 'HoopCheck loader is vertically centered in available content');
      await loader.getByRole('img', { name: 'HoopCheck', exact: true }).waitFor();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await loader.locator('.hc-brand-loader__orbit i').first().evaluate(el => getComputedStyle(el).animationName), 'none', 'Reduced motion stops the loader animation');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      releaseTeam();
      holdTeam = false;
      await page.locator('.hc-womens-branded-hero').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'Long team name fits the profile viewport');
      const art = await page.locator('.hc-womens-branded-hero').evaluate(el => getComputedStyle(el).backgroundImage);
      assert.ok(art.includes('basketball-arena-ai.webp'), 'Women’s team uses the AI arena background');
      const logo = await page.locator('.hc-team-profile-logo').first().boundingBox();
      assert.ok(logo && logo.width >= 48 && logo.height >= 48, 'Club logo remains visible');
      failCoaches = true;
      await page.goto(`${baseURL}/search?q=Discovery`);
      await maleLink.waitFor(); await femaleLink.waitFor();
      await page.getByText('Some directories are temporarily unavailable.', { exact: false }).waitFor();
      assert.equal(await maleLink.count(), 1); assert.equal(await femaleLink.count(), 1);
      await page.getByRole('button', { name: 'Men’s Teams', exact: true }).click();
      await maleLink.waitFor();
      await page.waitForFunction(() => !document.querySelector('.result-group a[href^="/womens/"]'));
      await page.getByRole('button', { name: 'All', exact: true }).click();
      await femaleLink.waitFor();
      assert.equal(await page.locator('.hc-team-directory-row').first().evaluate(el => getComputedStyle(el).borderTopWidth), '0px', 'Result content has no decorative frame');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
      assert.equal(overflow, false, `Search does not overflow at ${width}px`);
      console.log(`PASS ${width}px ${theme}: both team searches, women’s navigation, long names, frameless results, centered loader, reduced motion, AI art, partial failure recovery`);
      await context.close();
    }
  }
} finally { await browser.close(); }
