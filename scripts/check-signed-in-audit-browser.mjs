import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const site = process.env.THEME_TEST_BASE_URL || 'http://127.0.0.1:3000';
const userId = '11111111-1111-4111-8111-111111111111';
const teamId = '22222222-2222-4222-8222-222222222222';
const user = { id: userId, email: 'audit@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const profile = { id: userId, account_type: 'player', basketball_type: 'mens', profile_visibility: 'players_only', display_name: 'QA Player', player_verified: true };
const team = { id: teamId, name: 'QA Club', country: 'Azerbaijan', basketball_type: 'mens' };
const now = Math.floor(Date.now() / 1000);
const claims = Buffer.from(JSON.stringify({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now })).toString('base64url');
const session = { access_token: 'eyJhbGciOiJIUzI1NiJ9.' + claims + '.fixture', refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user };

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  let plan = 'premium';
  await page.route('https://ci.invalid/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'access-control-allow-origin': site,
      'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] || '*',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let data = [];
    if (url.pathname === '/auth/v1/token') data = session;
    if (url.pathname === '/auth/v1/user') data = user;
    if (url.pathname === '/rest/v1/profiles') data = profile;
    if (url.pathname === '/rest/v1/subscriptions') data = { plan, status: 'active', access_status: 'active', current_period_end: null, stripe_subscription_id: null };
    if (url.pathname === '/rest/v1/teams') data = [team];
    if (url.pathname === '/rest/v1/rpc/can_user_review_team') data = true;
    return route.fulfill({ status: 200, headers, json: data });
  });

  // Leave the App Router transition unresolved until after the document retry.
  // This models the live sign-in form that showed success without navigating.
  let allowClientNavigation;
  const clientNavigation = new Promise(resolve => { allowClientNavigation = resolve; });
  await page.route(url => url.origin === site && url.pathname === '/dashboard', async route => {
    if (route.request().headers().rsc === '1') {
      await clientNavigation;
      return route.abort().catch(() => {});
    }
    return route.continue();
  });
  await page.goto(site + '/login?returnTo=%2Fdashboard');
  await page.getByLabel('Email', { exact: true }).fill('audit@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  const documentRequest = page.waitForRequest(request => request.isNavigationRequest() && new URL(request.url()).pathname === '/dashboard');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  const destination = await documentRequest;
  allowClientNavigation();
  assert.match((await destination.allHeaders()).cookie || '', /sb-ci-auth-token=/);
  await page.getByText(/^signed in as$/i).waitFor();
  console.log('PASS stalled client navigation recovers with an authenticated document request');

  await page.locator('details.hc-header-more > summary').click();
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Reviews', exact: true }).click();
  await page.getByRole('heading', { name: 'Reviews & Analytics' }).waitFor();
  assert.equal(await page.locator('details.hc-header-more').evaluate(el => el.open), false);
  console.log('PASS the desktop More menu closes after selecting a destination');

  await page.goto(site + '/membership#manage-subscription');
  const complimentary = page.getByRole('region', { name: 'HoopCheck Premium' });
  await complimentary.waitFor();
  assert.match(await complimentary.innerText(), /Complimentary access is active/);
  assert.match(await complimentary.innerText(), /Paid plans below are optional/);
  assert.equal(await complimentary.getAttribute('id'), 'manage-subscription');

  await page.goto(site + '/account');
  const passportLink = page.getByRole('link', { name: 'Player Passport', exact: true });
  await passportLink.click();
  await page.getByRole('heading', { name: /My Journey/i }).waitFor();
  assert.equal(new URL(page.url()).hash, '#player-passport');
  const publicToggle = page.getByRole('checkbox', { name: /Show this stop publicly/i });
  await publicToggle.waitFor();
  assert.equal(await publicToggle.isChecked(), false);
  plan = 'pro';
  await page.reload();
  await page.getByRole('link', { name: 'Unlock My Journey' }).waitFor();
  assert.equal(await publicToggle.count(), 0);
  plan = 'premium';
  console.log('PASS complimentary Premium status and private Passport access, including the Pro gate');

  let releaseReviews;
  const reviewWait = new Promise(resolve => { releaseReviews = resolve; });
  let failReviews = false;
  await page.route('**/api/review-access?*', async route => {
    await reviewWait;
    if (failReviews) return route.fulfill({ status: 500, json: { error: 'Fixture error' } });
    return route.fulfill({ json: { tier: 'premium', canReadFull: true, canWrite: false, summary: { review_count: 0 }, reviews: [] } });
  });
  await page.goto(site + '/teams/' + teamId);
  const reviewSection = page.locator('#reviews');
  await reviewSection.getByText(/Loading reviews/i).waitFor();
  assert.equal(await reviewSection.getByText(/membership required/i).count(), 0);
  releaseReviews();
  await reviewSection.getByRole('heading', { name: 'No approved reviews yet.' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Check review eligibility' }).getAttribute('href'), '/account#team-review-checklist');
  failReviews = true;
  await page.reload();
  await reviewSection.getByRole('button', { name: 'Retry reviews' }).waitFor();
  assert.equal(await reviewSection.getByText(/membership required/i).count(), 0);
  console.log('PASS review loading, eligibility destination and error handling');

  await page.goto(site + '/teams/' + teamId + '/review');
  const agreement = page.getByRole('checkbox', { name: /read and agree to these review rules/i });
  await agreement.waitFor();
  assert.deepEqual(await agreement.evaluate(el => [el.form?.id, el.validity.valueMissing]), ['hc-team-review-form', true]);
  assert.ok((await agreement.boundingBox()).width <= 24, 'The checkbox stays aligned beside its label');
  await agreement.check();
  assert.equal(await agreement.evaluate(el => el.validity.valueMissing), false);
  console.log('PASS review agreement is associated with the form and required before submission');
} finally {
  await browser.close();
}
