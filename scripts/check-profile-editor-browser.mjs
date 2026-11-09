// CI browser checks use fixture records only; no live accounts are modified.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const baseURL = process.env.THEME_TEST_BASE_URL || 'http://127.0.0.1:3000';
for (let attempt=0; attempt<30; attempt++) {
  try { if ((await fetch(`${baseURL}/robots.txt`)).ok) break; } catch { /* server startup */ }
  if (attempt===29) throw new Error('Production test server did not start');
  await new Promise(resolve=>setTimeout(resolve,1000));
}
const browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : { channel: 'chrome' }), headless:true, args:['--no-sandbox'] });
const uid='11111111-1111-4111-8111-111111111111', tid='22222222-2222-4222-8222-222222222222';
try {
 for (const gender of ['mens','womens']) for (const width of [390,1440]) {
  const user={id:uid,aud:'authenticated',role:'authenticated',email:'profile-test@hoopcheck.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const now=Math.floor(Date.now()/1000), jwt=btoa(JSON.stringify({sub:uid,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600}));
  const session={access_token:`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${jwt}.fixture-signature`,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,expires_at:now+3600,user};
  let profile={id:uid,account_type:'player',basketball_type:gender,display_name:'QA Player',first_name:'QA',last_name:'Player',position:'SG',years_pro:4,current_team:null,current_country:'Old country',height:null,profile_visibility:'players_only',player_verified:false,selected_team_id:null,selected_womens_team_id:null,free_agent:false,avatar_moderation_status:'approved',professional_experience:true,bio:'A player profile',preferred_language:'en',theme_preference:'light',current_country_public:false};
  const team={id:tid,name:`${gender==='mens'?'Men':'Women'} QA Club`,country:'QA Country',city:'QA City',league_name:'QA League',basketball_type:gender,active:true,created_at:'2020-01-01T00:00:00Z'};
  let subscription={plan:'pro',status:'active',access_status:'active',current_period_end:null};
  let eligible=false,patches=[];
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addCookies([{name:'sb-ci-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:baseURL}]);
  await context.addInitScript(session=>{localStorage.setItem('sb-ci-auth-token',JSON.stringify(session));localStorage.setItem('hoopcheck-theme','light');localStorage.setItem('hoopcheck-language','en');},session);
  const page=await context.newPage();
  await page.route('https://ci.invalid/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   const headers={'access-control-allow-origin':baseURL,'access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-headers':req.headers()['access-control-request-headers']||'*','cache-control':'no-store'};
   if(req.method()==='OPTIONS') return route.fulfill({status:204,headers});
   let data=[];
   if(url.pathname==='/auth/v1/user') data=user;
   else if(url.pathname.endsWith('/profiles')){
    if(req.method()==='PATCH'){const patch=req.postDataJSON();patches.push(patch);profile={...profile,...patch};data={id:uid};}
    else data=profile;
   } else if(url.pathname.endsWith('/subscriptions'))data=subscription;
   else if(url.pathname.endsWith('/rpc/can_user_review_team'))data=eligible;
   else if(url.pathname.includes('/rpc/get_current_user_admin_role'))data=null;
   else if(url.pathname.includes('/rpc/is_current_user_admin_or_moderator'))data=false;
   else if(url.pathname.endsWith('/teams'))data=[{...team,name:'Men QA Club',basketball_type:'mens'}];
   else if(url.pathname.endsWith('/womens_teams'))data=[{...team,name:'Women QA Club',basketball_type:'womens'}];
   else if(url.pathname.endsWith('/leagues')||url.pathname.endsWith('/womens_leagues'))data=[{id:'33333333-3333-4333-8333-333333333333',name:'QA League',country:'QA Country',basketball_type:gender}];
   await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(`${baseURL}/account`);
  await page.locator('#profile-editor').waitFor();
  await page.locator('#position').selectOption('PG');
  await page.locator('#player-height').fill('193 cm');
  await page.locator('#current-team .hc-shared-picker-trigger').click();
  const picker=page.getByRole('dialog',{name:'Current team',exact:true});
  await picker.locator('input').first().fill('QA');
  await picker.locator('.hc-shared-picker-row').filter({hasText:team.name}).click();
  await page.locator('.hc-shared-picker').filter({hasText:'Favorite teams'}).locator('.hc-shared-picker-trigger').click();
  const favorites=page.getByRole('dialog',{name:'Favorite teams',exact:true});
  await favorites.locator('input').first().fill('QA');
  await favorites.locator('.hc-shared-picker-row').filter({hasText:team.name}).click();
  await page.locator('#profile-editor button[type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('#profile-editor button[type="submit"]').disabled);
  assert.ok(patches.length>0,'Profile update was sent');
  const saved=patches.find(p=>p.height==='193 cm');
  assert.equal(saved.position,'PG');assert.equal(saved.current_team,team.name);assert.equal(saved.current_country,'QA Country');assert.equal(saved.favorite_teams,team.name);
  assert.equal(saved.profile_visibility,'players_only','Editing preserves private visibility');
  for(const key of ['player_verified','selected_team_id','selected_womens_team_id','years_pro'])assert.ok(!(key in saved),`${key} is not self-assigned`);
  const checklist=page.locator('#team-review-checklist');
  await checklist.locator('input[type="checkbox"]').check();
  assert.equal(await checklist.getByRole('link',{name:'Continue to review'}).count(),0,'Selection alone cannot unlock review writing');
  profile={...profile,player_verified:true,[gender==='mens'?'selected_team_id':'selected_womens_team_id']:tid};eligible=true;
  await page.reload();await page.locator('#team-review-checklist').waitFor();
  await page.locator('#team-review-checklist input[type="checkbox"]').check();
  const reviewLink=page.getByRole('link',{name:'Continue to review'});await reviewLink.waitFor();
  assert.equal(await reviewLink.getAttribute('href'),`/${gender==='mens'?'teams':'womens'}/${tid}/review`);
  subscription={...subscription,status:'canceled'};
  await page.reload();await page.locator('#team-review-checklist').waitFor();
  await page.locator('#team-review-checklist input[type="checkbox"]').check();
  await page.waitForFunction(()=>document.querySelector('#team-review-checklist ul').getAttribute('aria-busy')==='false');
  assert.equal(await reviewLink.count(),0,'Inactive membership does not unlock reviews');
  subscription={...subscription,status:'active'};
  await page.goto(`${baseURL}/feed`);await page.locator('.hc-feed-composer').waitFor();
  const header=await page.locator('.hf5-hero').boundingBox(),composer=await page.locator('.hc-feed-composer').boundingBox();
  assert.ok(header.height>0,'HoopFeed community hero is visible');assert.ok(composer.y>header.y,'Composer follows the community hero');
  assert.equal(await page.locator('.hf5-hero').count(),1,'Exactly one community hero');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'No horizontal overflow');
  console.log(`PASS ${gender} ${width}px: editable profile, team dropdown, privacy preservation, review eligibility, compact feed`);
  await context.close();
 }
} finally {await browser.close();}
