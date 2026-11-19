/* eslint-disable @typescript-eslint/no-require-imports -- Isolated native-web visual and navigation regression. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.NATIVE_TEST_URL || 'http://127.0.0.1:8092';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Local fixture only');
const output=process.env.DESIGN_SCREENSHOTS || '/tmp/hoopcheck-native-ui';
const uid='11111111-1111-4111-8111-111111111111', team='22222222-2222-4222-8222-222222222222';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const png=await require('sharp')({create:{width:180,height:80,channels:3,background:'#FF5A1F'}}).png().toBuffer();
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 try {for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});const errors=[];let fail=true;let rpcCalls=0;
  const user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.test',user_metadata:{account_type:'fan'}};
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.hostname==='api.test' && url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Design Member',accountType:'fan'},entitlements:{tier:'free',hasPaidMembership:false,canReadHoopFeed:false,canWriteHoopFeed:false,canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:true}});
   if(url.hostname==='fixture.supabase.co') {
    if(url.pathname==='/auth/v1/user')return json(user);
    if(url.pathname==='/rest/v1/rpc/get_public_follow_list'){
     rpcCalls++; const body=JSON.parse(route.request().postData()||'{}');assert.equal(body.p_mode==='following'?body.p_user_id:body.p_target_id,uid);assert.equal(body.p_target_type,body.p_mode==='followers'?'fan':null);
     if(fail){fail=false;return json({},503);}
     if(body.p_mode==='followers')return json([]);
     return json([{target_type:'team',target_id:team,display_name:'Design Club'},{target_type:'fan',target_id:uid,id:uid,display_name:'Design Fan'},{target_type:'player',target_id:uid,id:uid,account_type:'player',display_name:'MUST NOT SHOW PLAYER'}]);
    }
    if(url.pathname==='/rest/v1/teams')return json({id:team,name:'Design Club',city:'Paris',country:'France',league_name:'Design League',logo_url:'https://media.test/logo.png',logo_bg:'light'});
    if(url.pathname==='/rest/v1/womens_teams')return json({id:team,name:'Design Women',city:'Paris',country:'France',league_name:'Design League',logo_url:'https://media.test/missing.png'});
    if(url.pathname.startsWith('/rest/v1/'))return json([]);
   }
   if(url.hostname==='media.test' && url.pathname==='/logo.png')return route.fulfill({contentType:'image/png',body:png});
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({haptics:false,appLock:false,onboardingDone:true})));
  await page.goto(base);await page.getByRole('button',{name:'Create an account',exact:true}).waitFor();
  await page.getByRole('img',{name:'HoopCheck™',exact:true}).waitFor();
  await page.getByRole('link',{name:'About HoopCheck™ →',exact:true}).click();await page.getByText('Our mission',{exact:true}).waitFor();
  await page.screenshot({path:`${output}/about-${theme}.png`,fullPage:true});
  await page.goto(base);await page.getByRole('textbox',{name:'Search basketball directory'}).fill('Olympia');await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('textbox',{name:'Email',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/sign-in');
  const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.fixture';
  await page.addInitScript(({token,user})=>localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user})),{token,user});
  await page.goto(base+'/account');await page.getByRole('button',{name:'Connections',exact:true}).click();
  await page.getByText('Connections could not be loaded. Please try again.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByText('Design Club',{exact:true}).waitFor();
  assert.equal(await page.getByText('MUST NOT SHOW PLAYER',{exact:true}).count(),0);
  await page.screenshot({path:`${output}/connections-${theme}.png`,fullPage:true});
  await page.getByRole('tab',{name:'Followers',exact:true}).click();await page.getByText('No public connections yet',{exact:true}).waitFor();
  await page.screenshot({path:`${output}/connections-empty-${theme}.png`,fullPage:true});
  await page.getByRole('tab',{name:'Following',exact:true}).click();await page.getByRole('link',{name:/Design Club/}).click();
  const image=page.getByRole('img',{name:'Design Club logo',exact:true});await image.waitFor();await image.evaluate(async el=>{const img=el.tagName==='IMG'?el:el.querySelector('img');if(img)await img.decode();});
  await page.screenshot({path:`${output}/team-artwork-${theme}.png`,fullPage:true});
  await page.goto(base+'/womens/'+team);await page.getByRole('img',{name:'Design Women crest',exact:true}).waitFor();
  await page.screenshot({path:`${output}/team-artwork-fallback-${theme}.png`,fullPage:true});
  await page.setViewportSize({width:320,height:740});await page.goto(base+'/dashboard');await page.getByText('Explore basketball',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:`${output}/dashboard-320-${theme}.png`,fullPage:true});
  assert.ok(rpcCalls>=3);assert.deepEqual(errors,[]);console.log(`PASS ${theme}: public About/search gate, native connections retry/fan scope/tabs/empty/navigation, decoded logo/failure fallback, 320px layout`);
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
