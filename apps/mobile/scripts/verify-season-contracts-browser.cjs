/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic localhost default-build and seasonal-contract checks. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.NATIVE_TEST_URL||'http://127.0.0.1:8102';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local fixtures only');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,uid=id(1),league=id(2),current=id(3),past=id(4);
const output=process.env.SEASON_SCREENSHOTS||'/tmp/phase3d-season-screens';
async function verify(browser,theme){
 const context=await browser.newContext({viewport:require('./compact-layout.cjs').viewport,colorScheme:theme});await context.routeWebSocket('**/*',socket=>socket.close());
 const exp=Math.floor(Date.now()/1000)+3600,user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.test',factors:[]};const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp,role:'authenticated',aal:'aal1'})).toString('base64url')+'.fixture';
 const calls=[],errors=[];let failSeason=true;
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin===new URL(base).origin)return route.continue();
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return json({});calls.push(u.pathname);
  if(u.hostname==='api.test'&&u.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Season member',accountType:'player'},entitlements:{tier:'free',hasPaidMembership:false,canReadHoopFeed:false,canWriteHoopFeed:false,canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:false}});
  if(u.hostname==='fixture.supabase.co'){
   const table=u.pathname.split('/').pop();
   if(u.pathname==='/auth/v1/user')return json(user);
   if(table==='leagues')return json({id:league,name:'Season League',country:'Spain',level:'Professional',season:'2026–27',website:null});
   if(table==='reviews')return json([]);
   if(table==='team_league_memberships'){
    assert.equal(u.searchParams.get('league_id'),'eq.'+league);
    const season=u.searchParams.get('season');
    if(season){assert.equal(u.searchParams.has('active'),false);if(season==='eq.2025–26')return json([{team_id:past}]);if(season==='eq.unavailable'&&failSeason)return json({message:'Synthetic outage'},503);return json([]);}
    assert.equal(u.searchParams.get('active'),'eq.true');return json([{team_id:current}]);
   }
   if(table==='teams'){
    const row={id:current,name:'Current Club',country:'Spain',city:'Madrid',league_name:'Season League',website:null};
    if(req.headers().accept?.includes('vnd.pgrst.object'))return json(row);
    return json(u.searchParams.get('id')?.includes(past)?[{id:past,name:'Historical Club',country:'Spain'}]:[row]);
   }
   if(table==='player_team_affiliations'){assert.equal(u.searchParams.get('user_id'),'eq.'+uid);assert.equal(u.searchParams.get('verified'),'eq.true');return json([{id:id(9),user_id:uid,team_id:current,relationship:'current',verified:true,start_date:'2026-01-01',end_date:null}]);}
   if(table==='get_public_player_profile')return json([{id:uid,display_name:'Owner Player',player_position:'PG',player_verified:true,years_pro:3,current_team:'Current Club',bio:'Profile reported'}]);
  }
  throw Error('Unexpected default-build query '+u.origin+u.pathname);
 });
 await context.addInitScript(({user,token,exp})=>{localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:exp,user}));localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({appLock:false,onboardingDone:true,haptics:false}));},{user,token,exp});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/leagues/'+league);await page.getByText('Current Club',{exact:true}).scrollIntoViewIfNeeded();
  const input=page.getByRole('textbox',{name:'League season',exact:true});await input.fill('2025–26');await page.getByRole('button',{name:'Apply season',exact:true}).click();await page.getByText('Historical Club',{exact:true}).waitFor();assert.equal(await page.getByText('Current Club',{exact:true}).count(),0);
  await require('./compact-layout.cjs').capture(page,{path:`${output}/historical-season-${theme}.png`,fullPage:true});
  await input.fill('1900–01');await page.getByRole('button',{name:'Apply season',exact:true}).click();await page.getByText('No active directory clubs recorded for this season.',{exact:true}).waitFor();
  await input.fill('unavailable');await page.getByRole('button',{name:'Apply season',exact:true}).click();await page.getByText('League clubs could not load.',{exact:true}).waitFor();failSeason=false;await page.getByRole('button',{name:'Retry league clubs',exact:true}).click();await page.getByText('No active directory clubs recorded for this season.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Current clubs',exact:true}).click();await page.getByText('Current Club',{exact:true}).waitFor();
  await page.goto(base+'/teams/'+current);await page.getByText('Roster research is unavailable in this release.',{exact:true}).scrollIntoViewIfNeeded();await require('./compact-layout.cjs').capture(page,{path:`${output}/default-roster-${theme}.png`,fullPage:true});
  await page.goto(base+'/players/'+uid);await page.getByText('Career history is unavailable in this release.',{exact:true}).scrollIntoViewIfNeeded();await page.getByText('Verified current link',{exact:true}).scrollIntoViewIfNeeded();await require('./compact-layout.cjs').capture(page,{path:`${output}/owner-team-links-${theme}.png`,fullPage:true});await page.getByRole('button',{name:'Preview Player Passport',exact:true}).click();await page.getByRole('button',{name:'Export & share PDF',exact:true}).click();await page.getByText('Passport file sharing is available in the iOS and Android app.',{exact:true}).waitFor();
  await require('./compact-layout.cjs').capture(page,{path:`${output}/default-passport-${theme}.png`,fullPage:true});
  assert.ok(!calls.some(path=>/player_career_stops|team_roster_spots|fan_live_team_provider_map|player_contact_requests/.test(path)));assert.ok(!calls.includes('/rest/v1/profiles'));assert.deepEqual(errors,[]);
  console.log(`PASS ${theme}: exact historical/current season, no mixed clubs, empty/error/retry, default-off undeployed data, owner Passport preserved`);
 }finally{await context.close();}
}
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{for(const theme of ['light','dark'])await verify(browser,theme);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
