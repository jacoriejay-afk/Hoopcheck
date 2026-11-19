/* eslint-disable @typescript-eslint/no-require-imports -- Isolated local browser regression harness. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.NATIVE_TEST_URL || 'http://127.0.0.1:8090';
if (!['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) throw new Error('This fixture harness only runs against localhost');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const uid = '11111111-1111-4111-8111-111111111111';
const teamId = '22222222-2222-4222-8222-222222222222';
const leagueId = '33333333-3333-4333-8333-333333333333';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', user_metadata: { account_type: 'player' } };
const token = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.fixture';
const rows = {
  profiles: [{ id: uid, display_name: 'Olympia Player', username: 'olympia', country: 'France' }],
  teams: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Olympia Men', country: 'France', city: 'Paris', league_name: 'Fixture League' }],
  womens_teams: [{ id: teamId, name: 'Olympia Women', country: 'France', city: 'Paris', league_id: leagueId, league_name: 'Olympia Women League' }],
  leagues: [{ id: '55555555-5555-4555-8555-555555555555', name: 'Olympia Men League', country: 'France', level: 'Professional' }],
  womens_leagues: [{ id: leagueId, name: 'Olympia Women League', country: 'France', level: 'Professional' }],
  coaches: [{ id: '66666666-6666-4666-8666-666666666666', name: 'Olympia Coach', country: 'France' }],
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/hoopcheck-native-ui', { recursive: true });
  try {
    for (const theme of ['light','dark']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
      const requests = [];
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(baseUrl).origin) return route.continue();
        requests.push(url.hostname+url.pathname);
        const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: {'access-control-allow-origin':'*'}, body: JSON.stringify(body) });
        if (url.hostname === 'fixture.supabase.co') {
          if (url.pathname === '/auth/v1/user') return json(user);
          if (url.pathname.startsWith('/rest/v1/')) return json(rows[url.pathname.split('/').pop()] || []);
        }
        if (url.hostname === 'api.test' && url.pathname === '/api/review-access') return json({canReadFull:false,canWrite:false,reviews:[{id:'secret',body:'MUST NOT RENDER PRIVATE REVIEW',title:'Secret',overall_rating:5,created_at:'2026-11-18'}]});
        return route.abort();
      });
      await context.addInitScript(({token,user}) => {
        localStorage.setItem('sb-fixture-auth-token', JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user}));
        localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({haptics:false,appLock:false,onboardingDone:true}));
      }, {token,user});
      const page = await context.newPage();
      page.on('pageerror', error => console.log('PAGEERROR',error.message));
      await page.goto(baseUrl);
      await page.getByText('Explore basketball',{exact:true}).waitFor({timeout:15000}).catch(async e=>{console.log('URL',page.url());console.log('BODY',await page.locator('body').innerText()); console.log('REQUESTS',requests); await page.screenshot({path:'/tmp/hoopcheck-native-ui/failure.png'}); throw e;});
      await page.getByRole('textbox',{name:'Search basketball directory'}).fill('Olympia');
      await page.getByRole('textbox',{name:'Search basketball directory'}).press('Enter');
      await page.getByText('Search basketball',{exact:true}).waitFor();
      await page.getByText('Olympia Women',{exact:true}).filter({visible:true}).waitFor();
      await page.screenshot({path:`/tmp/hoopcheck-native-ui/search-${theme}.png`,fullPage:true});
      await page.getByText('Olympia Women',{exact:true}).filter({visible:true}).click();
      await page.getByRole('heading',{name:'Olympia Women',exact:true}).waitFor();
      await page.getByText('Review access follows your HoopCheck membership and account permissions.',{exact:true}).waitFor();
      assert.equal(await page.getByText('MUST NOT RENDER PRIVATE REVIEW').count(),0);
      await page.screenshot({path:`/tmp/hoopcheck-native-ui/womens-profile-${theme}.png`,fullPage:true});
      await page.getByText('Open league profile',{exact:true}).click();
      await page.getByRole('heading',{name:'Olympia Women League',exact:true}).waitFor();
      await page.screenshot({path:`/tmp/hoopcheck-native-ui/womens-league-${theme}.png`,fullPage:true});
      await page.getByText('Olympia Women',{exact:true}).filter({visible:true}).click();
      await page.getByRole('heading',{name:'Olympia Women',exact:true}).waitFor();
      await page.getByRole('tab',{name:'Home',exact:true}).click();
      await page.getByText('Teams',{exact:true}).filter({visible:true}).click();
      await page.getByText('Explore men’s professional basketball teams before you sign.',{exact:true}).waitFor();
      await page.getByText('Browse women’s teams',{exact:true}).click();
      await page.getByText('Explore women’s professional basketball teams before you sign.',{exact:true}).filter({visible:true}).waitFor();
      await page.getByText('Olympia Women',{exact:true}).filter({visible:true}).waitFor();
      await page.screenshot({path:`/tmp/hoopcheck-native-ui/womens-${theme}.png`,fullPage:true});
      assert.ok(requests.every(x=>x.startsWith('fixture.supabase.co/')||x.startsWith('api.test/')), 'Unexpected outbound request attempted');
      console.log(`PASS ${theme}: homepage/search/team/league/tab/directory/permission guard`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
