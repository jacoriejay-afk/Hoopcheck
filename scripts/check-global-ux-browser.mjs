// Isolated UI fixtures. These checks do not establish production RLS or payment behavior.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const baseURL = process.env.THEME_TEST_BASE_URL || 'http://127.0.0.1:3000';
const artifacts = process.env.UX_ARTIFACTS_DIR || '/tmp/hoopcheck-ux-artifacts';
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const uid = '11111111-1111-4111-8111-111111111111';
const cases = [['visitor','free'], ['player','free'], ['player','pro'], ['player','premium'], ['fan','free'], ['fan','pro'], ['fan','premium'], ['agent','pro'], ['scout','pro'], ['manager','free'], ['coach','pro']];
const results = [];
try {
  for (const [role, tier] of cases.filter(([role,tier])=>(!process.env.UX_ROLE || role===process.env.UX_ROLE)&&(!process.env.UX_TIER || tier===process.env.UX_TIER))) for (const width of (process.env.UX_WIDTHS || '390,768,1440').split(',').map(Number)) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'ux-fixture@hoopcheck.invalid', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
    const now = Math.floor(Date.now()/1000);
    const jwt = Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})).toString('base64url');
    const session = { access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${jwt}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: now+3600, user };
    const profile = { id:uid, account_type:role, basketball_type:'mens', display_name:'UX Fixture', first_name:'UX', last_name:'Fixture', player_verified:false, professional_experience:true, profile_visibility:'players_only', bio:'Basketball profile fixture', preferred_language:'en' };
    const subscription = tier === 'free' ? null : {plan:tier,status:'active',access_status:'active',current_period_end:null};
    if (role !== 'visitor') await context.addCookies([{ name:'sb-ci-auth-token', value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'), url:baseURL }]);
    await context.addInitScript(({theme,session,role}) => {
      localStorage.setItem('hoopcheck-theme',theme); localStorage.setItem('hoopcheck-language','en');
      if(role !== 'visitor') localStorage.setItem('sb-ci-auth-token', JSON.stringify(session));
    }, {theme,session,role});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    let profileReads = 0;
    await page.route('https://ci.invalid/**',async route=>{
      const req=route.request(),url=new URL(req.url());
      const headers={'access-control-allow-origin':baseURL,'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-allow-headers':req.headers()['access-control-request-headers']||'*','cache-control':'no-store'};
      if(req.method()==='OPTIONS') return route.fulfill({status:204,headers});
      let data=[];
      if(url.pathname==='/auth/v1/user') data=user;
      else if(url.pathname.endsWith('/profiles')) { data=profile; if(url.searchParams.get("select")==="account_type") profileReads++; }
      else if(url.pathname.endsWith('/subscriptions')) data=subscription;
      else if(url.pathname.endsWith('/rpc/get_current_user_admin_role')) data=null;
      else if(url.pathname.endsWith('/rpc/is_current_user_admin_or_moderator')) data=false;
      await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
    });
    try {
      // Public page isolates shared navigation reads from page-specific queries.
      await page.goto(baseURL+'/about');
      if(role !== 'visitor') await page.locator('.bottom-nav').waitFor({state:width<=700?'visible':'attached'});
      await page.waitForFunction(()=>!document.querySelector('.bottom-nav [aria-disabled="true"]'));
      if(role !== 'visitor') {
        for(let attempt=0;profileReads===0&&attempt<100;attempt++) await page.waitForTimeout(50);
        assert.equal(profileReads,1,'Header and tab bar share one profile read');
        await page.waitForFunction(()=>!document.querySelector('.bottom-nav [aria-disabled="true"]'));
      }
      const header=page.locator('header.site-header-global');
      if(width<=700) await header.getByRole('button',{name:'Open menu'}).click();
      else await header.locator('summary').click();
      for(const href of ['/membership','/support',...(role==='visitor'?[]:['/settings','/privacy-center'])]) await header.locator(`a[href="${href}"]:visible`).first().waitFor();
      if(role==='fan') {
        for(const href of ['/feed','/players','/pre-sign','/verification','/connections']) assert.equal(await header.locator(`a[href="${href}"]`).count(),0,'Fan navigation excludes '+href);
        await header.locator('a[href="/fan-feed"]:visible').waitFor();
        await header.locator('a[href="/team-hub"]:visible').first().waitFor();
      }
      if(['coach','manager'].includes(role)) assert.equal(await header.locator('a[href="/feed"]').count(),0,'No player feed for team roles');
      await page.keyboard.press('Escape');
      if(width<=700) assert.equal(await header.getByRole('button',{name:'Open menu'}).getAttribute('aria-expanded'),'false');
      else assert.equal(await header.locator('details').getAttribute('open'),null);
      if(width>700) {
        const brand=await header.locator('.site-header-brand').boundingBox(), nav=await header.locator('.hc-header-desktop-links').boundingBox();
        const actions=await header.locator('.hc-header-actions').boundingBox();
        assert.ok(brand.x+brand.width<=nav.x+2 && nav.x+nav.width<=actions.x+2,'Desktop header brand, links and actions do not overlap');
        await header.locator('summary').click();
        await header.locator('a[href="/company"]:visible').click();
        await page.waitForURL('**/company');
        assert.equal(await header.locator('details').getAttribute('open'),null,'More closes after navigation');
      }
      const target=role==='visitor'?'/about':role==='manager'?'/team-dashboard':role==='agent'||role==='scout'?'/agents-hq':'/dashboard';
      await page.goto(baseURL+target);
      await page.locator('main h1').first().waitFor();
      await page.waitForFunction(()=>!document.querySelector('.hc-brand-loader--screen'));
      assert.ok(await page.locator('main').innerText(),'Route has content');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${role} ${width} has no page overflow`);
      assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('theme-dark')),theme==='dark');
      if(theme==='dark') {
        const sections=await page.locator('main.hc-ia-home .hc-ia-section').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).backgroundColor));
        assert.ok(sections.every(color=>color==='rgba(0, 0, 0, 0)'||color==='rgb(10, 10, 10)'), 'Dashboard sections do not force light surfaces in dark mode');
      }
      if(width<=700&&role!=='visitor') {
        const tabs=await page.locator('.bottom-nav > a').all();
        for(const tab of tabs){const box=await tab.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.height>=44,'Every mobile tab fits and has a touch target');}
        if(role==='fan') assert.equal((await page.locator('.bottom-nav a[href="/fan-feed"]').innerText()).toLowerCase(),'fan feed');
        if(role==='manager') await page.locator('.bottom-nav a[href="/team-dashboard"]').waitFor();
      }
      const cards=await page.locator('main :is(.dashboard-card,.hc-layout-card,.state-card)').evaluateAll(elements=>elements.map(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,foreground:s.color,border:s.borderTopWidth,radius:s.borderTopLeftRadius};}));
      for(const card of cards){assert.equal(card.border,'1px');assert.equal(card.radius,'16px');assert.notEqual(card.background,'rgba(0, 0, 0, 0)');}
      assert.deepEqual(errors,[],'No uncaught browser errors');
      const name=`${role}-${tier}-${width}-${theme}`;
      if(width!==768) await page.screenshot({path:`${artifacts}/${name}.png`,fullPage:true,animations:'disabled'});
      if(role==='player'&&tier==='pro'&&width===390&&theme==='light') {
        const postId='22222222-2222-4222-8222-222222222222';
        const post={id:postId,author_id:uid,body:'Reaction fixture',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),profiles:{display_name:'UX Fixture'}};
        await page.route('**/rest/v1/feed_posts?*',route=>{const req=route.request();const headers={'access-control-allow-origin':baseURL,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':req.headers()['access-control-request-headers']||'*'};return route.fulfill({status:req.method()==='OPTIONS'?204:200,contentType:'application/json',headers,body:req.method()==='OPTIONS'?'':JSON.stringify([post])});});
        let mutations=0,fail=false,release;
        let gate=new Promise(resolve=>{release=resolve;});
        await page.route('**/rest/v1/feed_post_checks*',async route=>{
          const req=route.request();
          const headers={'access-control-allow-origin':baseURL,'access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':req.headers()['access-control-request-headers']||'*'};
          if(req.method()==='OPTIONS') return route.fulfill({status:204,headers});
          if(req.method()==='GET') return route.fulfill({status:200,headers,contentType:'application/json',body:'[]'});
          mutations++; await gate;
          await route.fulfill({status:fail?403:201,headers,contentType:'application/json',body:fail?JSON.stringify({code:'42501',message:'Fixture permission denied'}):'[]'});
        });
        await page.goto(baseURL+'/feed');
        const check=page.getByRole('button',{name:/CHECK ·/});
        await check.waitFor(); await check.click();
        await page.locator('.hc-feed-stream .hc-feed-shared-card').first().dispatchEvent('dblclick');
        assert.equal(await check.getAttribute('aria-busy'),'true');
        assert.equal(await check.isDisabled(),true);
        release();
        await page.waitForFunction(()=>document.querySelector('.hc-feed-action-pill[aria-pressed]')?.getAttribute('aria-busy')==='false');
        assert.equal(mutations,1,'Repeated taps/double-click cannot send concurrent reactions');
        assert.equal(await check.getAttribute('aria-pressed'),'true');
        assert.ok((await check.innerText()).includes('1'));
        // Failed removal retains the confirmed reaction and count.
        fail=true; gate=Promise.resolve(); await check.click();
        await page.getByText("That check didn't go through. Please try again.").waitFor();
        assert.equal(await check.getAttribute('aria-pressed'),'true');
        assert.ok((await check.innerText()).includes('1'));
        fail=false; await check.click();
        await page.waitForFunction(()=>document.querySelector('.hc-feed-action-pill[aria-pressed]')?.getAttribute('aria-pressed')==='false');
        assert.ok((await check.innerText()).includes('0'));
        console.log('PASS reaction pending lock, duplicate suppression, success, error retention and removal');
      }
      results.push({name,status:'PASS',target,cards});
      console.log('PASS '+name);
    } catch(error) { results.push({name:`${role}-${tier}-${width}-${theme}`,status:'FAIL',error:error.message}); console.log('FAIL '+results.at(-1).name+': '+error.message); await page.screenshot({path:`${artifacts}/failure-${role}-${tier}-${width}-${theme}.png`,fullPage:true}).catch(()=>{}); }
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${artifacts}/results.json`,JSON.stringify(results,null,2)+'\n'); }
assert.ok(results.every(result=>result.status==='PASS'),`${results.filter(result=>result.status==='FAIL').length} browser cases failed; see ${artifacts}/results.json`);
