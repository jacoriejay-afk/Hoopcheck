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
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
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
        if (url.pathname.endsWith('/rpc/search_directory_overview')) {
          return route.fulfill({ headers, json: { mens: 13, womens: 1, coaches: 0, leagues: 1, countries: [{ country: 'Azerbaijan', total: 14 }] } });
        }
        let data = [];
        if (url.pathname.includes('/womens_teams')) { if (holdTeam) await teamGate; data = [women]; }
        else if (url.pathname.includes('/teams')) {
          const pageOffset = Number(url.searchParams.get('offset') || 0);
          const paged = (url.searchParams.get('or') || '').includes('Paginated');
          const pageTwo = { ...men, id: '33333333-3333-4333-8333-333333333333', name: 'Page Two QA' };
          data = paged
            ? pageOffset > 0 ? [pageTwo] : Array.from({ length: 12 }, (_, index) => ({
                ...men, id: 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(index).padStart(12, '0'), name: 'Page One QA ' + (index + 1),
              })).concat(pageTwo)
            : [men];
        }
        const single = req.headers().accept?.includes('vnd.pgrst.object');
        await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(single ? data[0] || null : data) });
      });
      if (width === 390 && theme === 'light') {
        await page.goto(`${baseURL}/search`);
        await page.getByRole('heading', { name: 'Countries with the most teams' }).waitFor();
        await page.getByRole('link', { name: 'Azerbaijan 14' }).waitFor();
        for (const selector of ['.hc-live-search__form', '.hc-search-recent']) {
          assert.equal(await page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', selector + ' leaves the page visible outside the rounded controls');
        }
        await page.goto(`${baseURL}/search?q=Paginated&type=mens-teams`);
        await page.getByText('12 results on this page').waitFor();
        const borders = await page.locator('.hc-directory-compact-row').evaluateAll(rows =>
          rows.map(row => getComputedStyle(row).borderTopColor));
        assert.ok(new Set(borders).size > 1, 'Team cards cycle through different loader palette colors');
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByText('Page Two QA').waitFor();
        assert.equal(new URL(page.url()).searchParams.get('page'), '2');
        await page.getByRole('button', { name: 'Previous', exact: true }).click();
        await page.getByText('Page One QA 1', { exact: true }).waitFor();
      }
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
        // The result can re-render while category data refreshes. Dispatch the
        // navigation from the currently connected anchor without Playwright's
        // stability wait, which can race with React replacing that anchor.
        await page.waitForFunction((href) => {
          const anchor = document.querySelector(`.result-group a[href="${href}"]`);
          return anchor?.isConnected && anchor.getClientRects().length > 0;
        }, `/womens/${women.id}`);
        // React may replace the anchor between waitForFunction and evaluate.
        // Retry against a freshly connected anchor rather than failing on one stale frame.
        await page.waitForFunction((href) => {
          const anchor = document.querySelector(`.result-group a[href="${href}"]`);
          if (!anchor?.isConnected || !anchor.getClientRects().length) return false;
          anchor.click();
          return true;
        }, `/womens/${women.id}`, { timeout: 15000, polling: 100 });
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
      // Route transitions can replace the loader between locating it and reading
      // its style. Reacquire a connected node while the media change settles.
      await page.waitForFunction(() => {
        const orbit = document.querySelector('.hc-brand-loader--screen .hc-brand-loader__orbit i');
        return orbit?.isConnected && getComputedStyle(orbit).animationName === 'none';
      }, null, { timeout: 10000 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      releaseTeam();
      holdTeam = false;
      await page.locator('.hc-womens-branded-hero').waitFor();
      const overviewTab = page.getByRole("tab", { name: "Overview" });
      const reviewsTab = page.getByRole("tab", { name: "Reviews" });
      await overviewTab.focus();
      await overviewTab.press("ArrowRight");
      assert.equal(await page.getByRole("tab", { name: "Roster" }).getAttribute("aria-selected"), "true");
      await page.getByRole("tab", { name: "Roster" }).press("ArrowRight");
      assert.equal(await page.getByRole("tab", { name: "Coaches" }).getAttribute("aria-selected"), "true");
      await page.getByRole("tab", { name: "Coaches" }).press("ArrowRight");
      assert.equal(await reviewsTab.getAttribute("aria-selected"), "true");
      assert.equal(await page.getByRole("tabpanel", { name: "Reviews" }).isVisible(), true);
      assert.equal(await page.getByRole("tabpanel", { name: "Overview" }).isVisible(), false);
      await overviewTab.click();
      assert.equal(await overviewTab.getAttribute("aria-selected"), "true");
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
      for (const kind of ['mens', 'womens']) {
        const result = page.locator(`.result-group .hc-team-directory-row--${kind}`).first();
        const { border, radius, height, fitted } = await result.evaluate(el => {
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          const link = el.querySelector('.hc-directory-compact-link').getBoundingClientRect();
          return { border: style.borderTopWidth, radius: style.borderTopLeftRadius, height: box.height,
            fitted: link.left >= box.left - 1 && link.right <= box.right + 1 && el.scrollWidth <= el.clientWidth + 1 };
        });
        assert.equal(border, '1px', `${kind} team result has a visible border`);
        assert.equal(radius, '20px', `${kind} team result uses the shared card radius`);
        assert.ok(height < 155 && fitted, `${kind} team result is compact and fits its card at ${width}px (height ${height}, fitted ${fitted})`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
      assert.equal(overflow, false, `Search does not overflow at ${width}px`);
      await page.locator(".hc-live-search input").fill("Discovery Team");
      const option = page.getByRole("option", { name: /Discovery Men QA/ });
      await option.waitFor();
      await page.locator(".hc-live-search input").press("ArrowDown");
      assert.equal(await option.getAttribute("aria-selected"), "true");
      await page.locator(".hc-live-search input").press("Escape");
      await option.waitFor({ state: "hidden" });
      console.log(`PASS ${width}px ${theme}: both team searches, women’s navigation, long names, bordered results, centered loader, reduced motion, AI art, partial failure recovery`);
      await context.close();
    }
  }
} finally { await browser.close(); }
