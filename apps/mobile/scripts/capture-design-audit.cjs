/* eslint-disable @typescript-eslint/no-require-imports -- Isolated local browser regression harness. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.NATIVE_TEST_URL || 'http://127.0.0.1:8090';
if (!['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) throw new Error('This fixture harness only runs against localhost');
const fs = require('node:fs');
const uid = '11111111-1111-4111-8111-111111111111';
const teamId = '22222222-2222-4222-8222-222222222222';
const leagueId = '33333333-3333-4333-8333-333333333333';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', user_metadata: { account_type: 'player' } };
const token = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.fixture';
const rows = {
  profiles: [{ id: uid, display_name: 'Olympia Player', username: 'olympia', country: 'France', years_pro: null }],
  teams: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Olympia Men', country: 'France', city: 'Paris', league_name: 'Fixture League' }],
  womens_teams: [{ id: teamId, name: 'Olympia Women', country: 'France', city: 'Paris', league_id: leagueId, league_name: 'Olympia Women League' }],
  leagues: [{ id: '55555555-5555-4555-8555-555555555555', name: 'Olympia Men League', country: 'France', level: 'Professional' }],
  womens_leagues: [{ id: leagueId, name: 'Olympia Women League', country: 'France', level: 'Professional' }],
  coaches: [{ id: '66666666-6666-4666-8666-666666666666', name: 'Olympia Coach', country: 'France' }],
};

// Evidence capture only. Synthetic data; a screenshot is not an interaction assertion.
(async () => {
 const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
 const output = process.env.DESIGN_SCREENSHOTS || '/tmp/hoopcheck-native-ui'; fs.mkdirSync(output,{recursive:true});
 const routes=['/','/sign-in','/sign-up','/forgot-password','/about','/dashboard','/teams','/leagues','/players','/coaches','/search','/settings','/notifications','/account','/connections','/account/edit','/players/'+uid,'/teams/'+rows.teams[0].id,'/leagues/'+rows.leagues[0].id,'/womens/'+teamId,'/womens/leagues/'+leagueId,'/team-hub/groups'];
 try { for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url()); if(url.origin===new URL(baseUrl).origin)return route.continue();
   const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   if(url.hostname==='fixture.supabase.co') {
    if(url.pathname==='/auth/v1/user')return json(user);
    if(url.pathname.startsWith('/rest/v1/')) {const data=rows[url.pathname.split('/').pop()] || [];return json(route.request().headers().accept?.includes('object+json') ? data[0] || null : data);}
   }
   return route.abort();
  });
  for(const path of routes){
   const page=await context.newPage();
   const anonymous=['/','/sign-in','/sign-up','/forgot-password'].includes(path);
   await page.addInitScript(({token,user,anonymous})=>{
    localStorage.clear();if(!anonymous)localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user}));
    localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({haptics:false,appLock:false,onboardingDone:true}));
   },{token,user,anonymous});
   await page.goto(baseUrl+path);
   await page.evaluate(() => document.fonts.ready);
   if (!anonymous && path !== '/about') await page.getByRole('tab', {name:'Home',exact:true}).waitFor();
   await page.waitForTimeout(500);
   const slug=path==='/'?'welcome':path.slice(1).replaceAll('/','-');
   await page.screenshot({path:`${output}/audit-${slug}-${theme}.png`,fullPage:true});
   console.log(theme,path,'=>',new URL(page.url()).pathname);
   await page.close();
  }await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
