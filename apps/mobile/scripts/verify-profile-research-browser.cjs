/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic localhost authorization fixtures. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.NATIVE_TEST_URL||'http://127.0.0.1:8098';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local fixtures only');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,uid=id(1),team=id(2),player=id(3),hidden=id(4);
const output=process.env.PROFILE_RESEARCH_SCREENSHOTS||'/tmp/phase3c-profile-screens';
async function verify(browser,theme,role){
 const context=await browser.newContext({viewport:require('./compact-layout.cjs').viewport,colorScheme:theme});await context.routeWebSocket('**/*',socket=>socket.close());
 const exp=Math.floor(Date.now()/1000)+3600,user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.test',factors:[]};
 const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp,role:'authenticated',aal:'aal1'})).toString('base64url')+'.fixture';
 const calls=[],errors=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===new URL(base).origin)return route.continue();
  const json=data=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return json({});calls.push(url.pathname);
  if(url.hostname==='api.test'&&url.pathname==='/api/game-predictions'){assert.equal(role,'player');assert.equal(url.searchParams.get('mode'),'games');return json({games:[]});}
  if(url.hostname==='api.test'&&url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Research member',accountType:role},entitlements:{tier:'free',hasPaidMembership:false,canReadHoopFeed:false,canWriteHoopFeed:false,canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:role==='fan'}});
  if(url.hostname==='fixture.supabase.co'){
   const table=url.pathname.split('/').pop();
   if(url.pathname==='/auth/v1/user')return json(user);
  // Account activity reads are owner-scoped, read-only, and use the canonical RPC.
  if(url.hostname==='fixture.supabase.co'&&url.pathname==='/rest/v1/rpc/get_public_follow_list'){
    assert.equal(route.request().method(),'POST');
    assert.equal(route.request().headers().authorization,`Bearer ${token}`);
    assert.deepEqual(route.request().postDataJSON(),{p_mode:'following',p_target_type:null,p_target_id:null,p_user_id:uid});
    return json([]);
  }
  if(url.hostname==='fixture.supabase.co'&&['/rest/v1/feed_posts','/rest/v1/reviews'].includes(url.pathname)&&route.request().method()==='HEAD'){
    if(url.pathname.endsWith('/feed_posts')){
      assert.ok(false,'Feed count requires membership access');
      assert.equal(url.searchParams.get('status'),'eq.approved');
      assert.match(url.searchParams.get('or')||'',/^\(expires_at\.is\.null,expires_at\.gt\./);
    }else assert.equal(role,'player','Review count is player-only');
    assert.equal(route.request().headers().authorization,`Bearer ${token}`);
    assert.equal(url.searchParams.get('author_id'),`eq.${uid}`);
    assert.equal(url.searchParams.get('select'),'id');
    assert.match(route.request().headers().prefer||'',/count=exact/);
    return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'content-range','content-range':'*/0'}});
  }
   if(table==='profiles'){
    assert.equal(url.searchParams.get('id'),'eq.'+uid,'Account avatar query must stay scoped to the signed-in owner');
    assert.equal(url.searchParams.get('select'),'avatar_url,avatar_moderation_status','Avatar query must not expand private profile fields');
    return json({avatar_url:null,avatar_moderation_status:'approved'});
   }
   if(table==='teams')return json({id:team,name:'Research Club',country:'Spain',city:'Madrid',league_name:'Research League',website:null});
   if(table==='reviews')return json([]);
   if(['player_career_stops','team_roster_spots','get_public_player_profile','is_player_country_public','player_contact_requests'].includes(table))assert.notEqual(role,'fan','Fan must not query player research');
   if(table==='player_career_stops'){assert.equal(url.searchParams.get('team_id'),'eq.'+team);assert.equal(url.searchParams.get('is_public'),'eq.true');return json([{player_id:player,team_name:'Research Club',seasons:'2025–26'},{player_id:hidden,team_name:'Research Club',seasons:'PRIVATE'}]);}
   if(table==='team_roster_spots'){assert.equal(url.searchParams.get('team_id'),'eq.'+team);assert.equal(url.searchParams.get('status'),'eq.open');return json([{id:id(5),title:'Import guard opening',description:'Ask the club about the 2026–27 season.',season:'2026–27',expires_at:'2099-01-01T00:00:00Z'}]);}
   if(table==='get_public_player_profile')return json(req.postDataJSON().p_user_id===player?[{id:player,display_name:'Visible career player',player_position:'PG',years_pro:3,player_verified:true,player_verified_at:'2025-01-01T00:00:00Z',bio:'Profile-reported career',current_country:'HIDDEN LOCATION'}]:[]);
   if(table==='is_player_country_public')return json(false);
   if(table==='player_contact_requests'){assert.equal(url.searchParams.get('requester_id'),'eq.'+uid);assert.equal(url.searchParams.get('player_id'),'eq.'+player);return json(null);}
  }
  throw Error('Unexpected data request '+url.origin+url.pathname);
 });
 await context.addInitScript(({user,token,exp})=>{localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:exp,user}));localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({appLock:false,onboardingDone:true,haptics:false}));},{user,token,exp});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base+'/teams/'+team);await page.getByRole('heading',{name:'Research Club',exact:true}).waitFor();
  if(role==='player'){
   await page.getByText('Visible career player',{exact:true}).scrollIntoViewIfNeeded();await page.getByText('Import guard opening',{exact:true}).waitFor();
   assert.equal(await page.getByText('PRIVATE',{exact:true}).count(),0);assert.equal(await page.getByText('HIDDEN LOCATION',{exact:true}).count(),0);
   await require('./compact-layout.cjs').capture(page,{path:`${output}/roster-${theme}.png`,fullPage:true});
   await page.getByText('Visible career player',{exact:true}).click();await page.getByText('Connect with this player to view their career history.',{exact:true}).waitFor();
   await page.getByText('Professional player verified',{exact:true}).scrollIntoViewIfNeeded();await require('./compact-layout.cjs').capture(page,{path:`${output}/verification-${theme}.png`,fullPage:true});
  }
  await page.goto(base+'/account');await page.getByRole('button',{name:'See membership benefits',exact:true}).click();await page.getByRole('heading',{name:'Your membership access',exact:true}).scrollIntoViewIfNeeded();
  assert.equal(await page.getByText('Included',{exact:true}).count(),role==='fan'?1:0);
  if(role==='fan')assert.equal(calls.filter(path=>/player_career_stops|team_roster_spots|get_public_player_profile/.test(path)).length,0);
  await require('./compact-layout.cjs').capture(page,{path:`${output}/membership-${role}-${theme}.png`,fullPage:true});
  assert.deepEqual(errors,[]);assert.equal(calls.filter(path=>path==='/rest/v1/profiles').length,1,'Only the exact owner-avatar lookup is allowed');
  console.log(`PASS ${theme} ${role}: scoped roster/history, private profile denial, canonical verification, server membership preview`);
 }finally{await context.close();}
}
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{for(const theme of ['light','dark']){await verify(browser,theme,'player');await verify(browser,theme,'fan');}}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
