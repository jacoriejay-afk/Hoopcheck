/* eslint-disable @typescript-eslint/no-require-imports -- Isolated local browser regression. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.NATIVE_TEST_URL||'http://127.0.0.1:8106';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local fixture only');
async function verify(browser,theme,role){
 const context=await browser.newContext({viewport: require("./compact-layout.cjs").viewport,colorScheme:theme});const uid='11111111-1111-4111-8111-111111111111',exp=Math.floor(Date.now()/1000)+3600;
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.test',factors:[]};const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp,role:'authenticated',aal:'aal1'})).toString('base64url')+'.fixture';
 const calls=[],errors=[];await context.routeWebSocket('**/*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(body)});
  if(route.request().method()==='OPTIONS')return json({});calls.push(url.pathname);
  if(url.hostname==='fixture.supabase.co'&&url.pathname==='/auth/v1/user')return json(user);
  if(url.hostname==='api.test'&&url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Fixture member',accountType:role},entitlements:{tier:'pro',hasPaidMembership:true,canReadHoopFeed:true,canWriteHoopFeed:true,canUseLiveGameHub:role==='player'||role==='fan',canUseLiveGameChat:role==='player'||role==='fan',canSwitchBasketballSide:role==='fan',canUseFanGroups:role==='fan'}});
  if(url.hostname==='api.test'&&url.pathname==='/api/membership')return json({owner:uid,subscription:{plan:'pro',status:'active',access_status:'pro',current_period_end:'2099-01-01T00:00:00Z',cancel_at_period_end:false,billing_interval:'month',provider:'stripe'}});
  throw Error('Unexpected external request '+url.origin+url.pathname);
 });
 await context.addInitScript(({user,token,exp})=>{localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user}));localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({appLock:false,onboardingDone:true,haptics:false}));},{user,token,exp});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base+'/account');await page.getByRole('button',{name:'Membership and restore purchases',exact:true}).waitFor();await page.getByRole('button',{name:'Membership and restore purchases',exact:true}).click();
  await page.getByText('HoopCheck Membership',{exact:true}).waitFor();await page.getByText('Stripe · active',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Restore purchases',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Manage Apple subscription',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:/^Review (Pro|Premium)/}).count(),0);
  if(role==='fan')await page.getByText('No paid fan products are offered. Existing membership access and purchase restoration are preserved.',{exact:true}).waitFor();
  for(const name of ['Refresh membership','Restore purchases','Manage Apple subscription','Terms of use','Privacy policy']){const button=page.getByRole('button',{name,exact:true});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box&&box.height>=48,name+' touch target');}
  const expected=theme==='dark'?'rgb(0, 0, 0)':'rgb(244, 244, 241)';
  const fill=await page.getByText('HoopCheck Membership',{exact:true}).evaluate(el=>{while(el){const value=getComputedStyle(el).backgroundColor;if(value!=='rgba(0, 0, 0, 0)'&&value!=='transparent')return value;el=el.parentElement;}return null;});assert.equal(fill,expected);
  assert.equal(calls.some(path=>path.startsWith('/api/mobile/purchases/')||path.startsWith('/api/stripe/')),false,'web/old native module absence must not begin billing');assert.deepEqual(errors,[]);
  await require("./compact-layout.cjs").capture(page, {path:`/tmp/hoopcheck-native-ui/${theme}-membership-${role}.png`,fullPage:true});
 }finally{await context.close();}
}
(async()=>{fs.mkdirSync('/tmp/hoopcheck-native-ui',{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{for(const theme of ['light','dark'])for(const role of ['player','fan']){await verify(browser,theme,role);console.log('PASS: native membership unsupported-module/restore safeguards, '+role+' '+theme);}}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
