/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser fixtures only. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.NATIVE_TEST_URL||'http://127.0.0.1:8093';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local fixture only');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
async function verify(browser,theme,role='fan',paid=true){
 const context=await browser.newContext({viewport: require("./compact-layout.cjs").viewport,colorScheme:theme});
 const uid=id(30),other=id(31),errors=[],calls=[];
 const canUseGames=paid&&['fan','player'].includes(role);
 const user={id:uid,aud:'authenticated',email:'fixture@example.test',user_metadata:{}};
 const expires=Math.floor(Date.now()/1000)+3600;
 const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp:expires,role:'authenticated'})).toString('base64url')+'.fixture';
 const tip=new Date(Date.now()+30*60000).toISOString();
 const games=[{id:id(1),team_id:id(10),opponent_team_id:id(11),opponent_name:'Away Men'}, {id:id(2),team_id:id(12),opponent_team_id:id(13),opponent_name:'Away Women'}].map(g=>({...g,status:'scheduled',scheduled_at:tip,home_score:null,away_score:null,ends_at:null,started_at:null,league_name:'Fixture League',country:'France',period_label:null}));
 let side='mens',muted=false,blocked=false,declined=false,myPick=null;
 const chat=[{id:id(5),user_id:other,body:'Fixture room message',created_at:new Date().toISOString()}];
 await context.routeWebSocket('**/*',socket=>socket.close()); // No real realtime connection; verify polling/reload fallback.
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  if(url.origin===new URL(base).origin)return route.continue();
  const body=request.postData()||'';calls.push({path:url.pathname,method,body});
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)});
  if(method==='OPTIONS')return json({});
  if(url.hostname==='api.test'){
   assert.ok(request.headers().authorization?.startsWith('Bearer '));
   if(url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Fixture Member',accountType:role},entitlements:{tier:paid?'pro':'free',hasPaidMembership:paid,canReadHoopFeed:paid,canWriteHoopFeed:paid,canUseLiveGameHub:canUseGames,canUseLiveGameChat:canUseGames,canSwitchBasketballSide:paid&&role==='fan',canUseFanGroups:role==='fan'}});
   if(url.pathname==='/api/game-predictions'){
    if(url.searchParams.get('mode')==='games'){assert.equal(role,'player');assert.equal(paid,false);return json({games});}
    if(method==='POST'){myPick=JSON.parse(body).pickedTeamId;return json({ok:true,picked_team_id:myPick});}
    return json({my_pick:myPick,locked:false,total_picks:myPick?1:0,results:null});
   }
  }
  if(url.hostname==='fixture.supabase.co'){
   if(url.pathname==='/auth/v1/user')return json(user);
   const table=url.pathname.split('/').pop();
   if(table==='profiles'){
    if(url.searchParams.get('select')==='preferred_basketball_side'){
     assert.equal(url.searchParams.get('id'),`eq.${uid}`);if(method==='PATCH')side=JSON.parse(body).preferred_basketball_side;
     return json({preferred_basketball_side:side});
    }
    return json([{id:other,display_name:'Other member'},{id:uid,display_name:'Fixture Member'}]);
   }
   if(table==='fan_live_games'){assert.equal(paid,true);return json(games);}
   if(table==='teams')return json(url.searchParams.get('basketball_type')==='eq.mens'?[{id:id(10),name:'Home Men'},{id:id(11),name:'Away Men'}]:[]);
   if(table==='womens_teams')return json([{id:id(13),name:'Away Women'}]);
   if(table==='fan_live_chat_room_open'){assert.equal(paid,true);return json(true);}
   if(table==='fan_live_chat_user_controls'){
    assert.equal(paid,true);
    if(method==='POST'){const data=JSON.parse(body);assert.equal(data.user_id,uid);assert.equal(data.target_user_id,other);blocked=data.is_blocked;muted=data.is_muted;return route.fulfill({status:204});}
    assert.equal(url.searchParams.get('user_id'),`eq.${uid}`);return json([{target_user_id:other,is_blocked:blocked,is_muted:muted}]);
   }
   if(table==='fan_live_chat_messages'){
    assert.equal(paid,true);
    if(method==='POST'){
     const data=JSON.parse(body);assert.equal(data.user_id,uid);assert.equal(data.game_id,id(1));
     if(!declined){declined=true;return json({message:'SLOW_MODE'},400);}
     const saved={id:id(6),user_id:uid,body:data.body,created_at:new Date().toISOString()};chat.push(saved);return json(saved);
    }
    return json([...chat].reverse());
   }
   if(table==='fan_live_chat_reports'){assert.equal(method,'POST');const data=JSON.parse(body);assert.equal(data.reporter_id,uid);assert.equal(data.reported_user_id,other);assert.equal(data.message_id,id(5));assert.equal(data.reason,'harassment');return route.fulfill({status:204});}
  }
  throw new Error(`Unexpected external request: ${url.origin}${url.pathname}`);
 });
 await context.addInitScript(({token,user,expires})=>{
  localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:expires,user}));
  localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({appLock:false,haptics:false,onboardingDone:true}));
 },{token,user,expires});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(`${base}/fan-live`);
  if(!canUseGames&&role!=='player'){await page.getByText('Live Games chat is available to eligible Pro and Premium members. Free players retain game predictions.',{exact:true}).waitFor();assert.ok(!calls.some(c=>/fan_live_games|fan_live_chat|game-predictions/.test(c.path)));console.log(`PASS ${role} ${paid?'paid':'free'}: game/chat permission gate`);return;}
  await page.getByText('Home Men vs Away Men',{exact:true}).waitFor();
  if(paid&&role==='fan'){
   await page.getByRole('tab',{name:'Women',exact:true}).click();await page.getByText('Home team vs Away Women',{exact:true}).waitFor();assert.equal(await page.getByText('Home Men vs Away Men',{exact:true}).count(),0);
   await page.getByRole('tab',{name:'Men',exact:true}).click();await page.getByText('Home Men vs Away Men',{exact:true}).waitFor();
  }else assert.equal(await page.getByRole('tab',{name:'Women',exact:true}).count(),0);
  await require('./compact-layout.cjs').capture(page,{path:`/tmp/hoopcheck-native-ui/live-directory-${theme}.png`,fullPage:true});
  await page.getByText('Home Men vs Away Men',{exact:true}).click();
  if(!paid){
   await page.getByRole('heading',{name:'Pick the winner',exact:true}).waitFor();
   assert.ok(!calls.some(c=>/fan_live_chat/.test(c.path)));
   assert.ok(calls.some(c=>c.path==='/api/game-predictions'&&c.method==='GET'));
  }else{
   await page.getByText('Fixture room message',{exact:true}).waitFor();
   const draft=page.getByRole('textbox',{name:'Game chat message',exact:true});await draft.fill('Fixture retained draft');
   await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByText('Wait two seconds between messages. Your draft is retained.',{exact:true}).waitFor();assert.equal(await draft.inputValue(),'Fixture retained draft');
   await page.getByRole('tab',{name:'Predictions',exact:true}).click();await page.getByRole('heading',{name:'Pick the winner',exact:true}).waitFor();await page.getByRole('tab',{name:'Chat',exact:true}).click();await draft.waitFor();assert.equal(await draft.inputValue(),'Fixture retained draft');
   await page.getByRole('button',{name:'Send message',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Game chat message"]')?.value==='');await page.getByText('Fixture retained draft',{exact:true}).waitFor();
   await page.getByRole('button',{name:'report Other member',exact:true}).click();await page.getByRole('textbox',{name:'Report details',exact:true}).fill('Fixture report context');await page.getByRole('button',{name:'Submit report',exact:true}).click();await page.getByText('Report sent to HoopCheck moderators.',{exact:true}).waitFor();
   await page.getByRole('button',{name:'mute Other member',exact:true}).click();await page.getByRole('button',{name:'Manage hidden members',exact:true}).waitFor();assert.equal(await page.getByText('Fixture room message',{exact:true}).count(),0);
   await page.getByRole('button',{name:'Manage hidden members',exact:true}).click();await page.getByRole('button',{name:'Restore messages',exact:true}).click();await page.getByText('Fixture room message',{exact:true}).waitFor();
   await page.getByRole('button',{name:'block Other member',exact:true}).click();await page.getByRole('button',{name:'Manage hidden members',exact:true}).waitFor();assert.equal(await page.getByText('Fixture room message',{exact:true}).count(),0);
   await require("./compact-layout.cjs").capture(page, {path:`/tmp/hoopcheck-native-ui/live-chat-${theme}.png`,fullPage:true});
   await page.getByRole('tab',{name:'Predictions',exact:true}).click();
  }
  const home=page.getByRole('button',{name:'Home Men',exact:true});await home.waitFor();await home.click();await page.getByRole('button',{name:'Home Men ✓ Your pick',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log(`PASS ${theme} ${role} ${paid?'pro':'free'}: game listing, role gates, side preference, predictions${paid?', chat draft/error/send/report/mute/restore/block':''}`);
 }catch(error){console.log('Fixture failure:',page.url());console.log(await page.locator('body').innerText());console.log('ERRORS',errors);throw error;}finally{await context.close();}
}
(async()=>{fs.mkdirSync('/tmp/hoopcheck-native-ui',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{for(const theme of ['light','dark'])await verify(browser,theme);await verify(browser,'light','player',false);await verify(browser,'dark','fan',false);await verify(browser,'light','coach',true);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
