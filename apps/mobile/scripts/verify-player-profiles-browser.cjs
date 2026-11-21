/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic local player-role and privacy fixture only. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.NATIVE_TEST_URL||'http://127.0.0.1:8102';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local fixture only');
const uid='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222',privateId='33333333-3333-4333-8333-333333333333';
async function verify(browser,theme,role='player'){
 const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});await context.routeWebSocket('**/*',socket=>socket.close());
 const exp=Math.floor(Date.now()/1000)+3600,user={id:uid,aud:'authenticated',user_metadata:{account_type:'player'}},token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp,role:'authenticated'})).toString('base64url')+'.fixture';
 const card={id:target,display_name:'Fixture Visible Player',username:'player_one',country:'Public country',current_country:null,current_team:'Fixture Club',position:'PG',years_pro:3,free_agent:true,avatar_url:'https://fixture.supabase.co/storage/v1/object/public/profile-avatars/approved.jpg',player_verified:true};
 let countryPublic=false;const queries=[],errors=[];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin===new URL(base).origin)return route.continue();const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)});
  if(request.method()==='OPTIONS')return json({});
  if(url.hostname==='api.test'&&url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Fixture viewer',accountType:role},entitlements:{tier:'free',hasPaidMembership:false,canReadHoopFeed:role==='player',canWriteHoopFeed:role==='player',canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:role==='fan'}});
  if(url.hostname==='fixture.supabase.co'){
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname.includes('/storage/v1/object/public/profile-avatars/'))return route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync('/tmp/hoopcheck-fixture-avatar.png')});
   queries.push(url.pathname);assert.notEqual(role,'fan','Fan must not query any player data');
   if(url.pathname.endsWith('/search_public_players'))return json([card]);
   if(url.pathname.endsWith('/get_public_player_profile')){const body=request.postDataJSON();return json(body.p_user_id===privateId?[]:[{...card,player_position:'PG',current_country:'Hidden exact location',bio:'Public fixture biography'}]);}
   if(url.pathname.endsWith('/is_player_country_public'))return json(countryPublic);
   throw Error('Raw profile query is forbidden in this fixture: '+url.pathname);
  }
  throw Error(`Unexpected external player fixture request ${url.origin}${url.pathname}`);
 });
 await context.addInitScript(({token,user,exp})=>{localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:exp,user}));localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({appLock:false,haptics:false,onboardingDone:true}));},{token,user,exp});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`${base}/players`);
  if(role==='fan'){
   await page.getByText('Player profiles are unavailable for fan accounts.',{exact:true}).waitFor();assert.deepEqual(queries,[]);await page.goto(`${base}/players/${target}`);await page.getByText('Player profiles are unavailable for fan accounts.',{exact:true}).waitFor();assert.deepEqual(queries,[]);
  }else{
   await page.getByPlaceholder('Enter a username (e.g. @player)').fill('player_one');await page.getByText('Fixture Visible Player',{exact:true}).waitFor();assert.equal(await page.getByText('Hidden exact location',{exact:true}).count(),0);await page.getByText('Fixture Visible Player',{exact:true}).click();await page.getByText('Public fixture biography',{exact:true}).waitFor();assert.equal(await page.getByText('Hidden exact location',{exact:true}).count(),0);await page.getByText('Verified professional player',{exact:true}).waitFor();await page.screenshot({path:`/tmp/hoopcheck-native-ui/player-profile-${theme}.png`,fullPage:true});
   countryPublic=true;await page.reload();await page.getByText('Hidden exact location',{exact:true}).waitFor();
   await page.goto(`${base}/players/${privateId}`);await page.getByText('This profile is unavailable for your account.',{exact:true}).waitFor();assert.ok(queries.every(path=>path.includes('/rpc/')));
  }
  assert.deepEqual(errors,[]);await page.screenshot({path:`/tmp/hoopcheck-native-ui/player-privacy-${role}-${theme}.png`,fullPage:true});console.log(`PASS ${theme} ${role}: verified role/canonical RPC/current-country opt-in/approved avatar/private-profile denial`);
 }catch(error){console.log(await page.locator('body').innerText());console.log(errors);throw error;}finally{await context.close();}
}
(async()=>{fs.mkdirSync('/tmp/hoopcheck-native-ui',{recursive:true});await require('sharp')({create:{width:80,height:80,channels:3,background:'#ff790b'}}).png().toFile('/tmp/hoopcheck-fixture-avatar.png');const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{for(const theme of ['light','dark'])await verify(browser,theme);await verify(browser,'light','fan');}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
