/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic billing browser regression. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
const base=process.env.THEME_TEST_BASE_URL||'http://127.0.0.1:3000';if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local fixture only');
const owner='11111111-1111-4111-8111-111111111111';
const source=(provider,plan='pro')=>({provider,plan,status:'active',access_status:plan,current_period_end:'2099-01-01T00:00:00Z',cancel_at_period_end:false,billing_interval:'month'});
async function verify(browser,theme,kind){
 const role=kind.startsWith('fan')?'fan':kind==='coach'?'coach':kind==='manager'?'manager':'player';
 const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme,serviceWorkers:'block'});
 const exp=Math.floor(Date.now()/1000)+3600,user={id:owner,aud:'authenticated',role:'authenticated',email:'fixture@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',factors:[],app_metadata:{provider:'email'},user_metadata:{}};
 const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:owner,exp,role:'authenticated',aal:'aal1'})).toString('base64url')+'.fixture';
 const session={user,access_token:token,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer'};
 let effective=kind==='apple'||kind==='both'?source('apple','premium'):kind==='manual'?source('manual'):kind==='both-stripe'?source('stripe','premium'):kind==='fan-existing'?source('stripe'):null;
 let billing=kind==='both'||kind==='both-stripe'||kind==='fan-existing'?{...source('stripe',kind==='both-stripe'?'premium':'pro'),stripe_customer_id:'cus_fixture',stripe_subscription_id:'sub_fixture'}:null;
 const calls=[],errors=[];await context.routeWebSocket('**/*',socket=>socket.close());
 await context.addCookies([{name:'sb-ci-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'hoopcheck-theme',value:theme,url:base}]);
 await context.addInitScript(({session,theme})=>{localStorage.setItem('sb-ci-auth-token',JSON.stringify(session));localStorage.setItem('hoopcheck-theme',theme);localStorage.setItem('hoopcheck-language','en');},{session,theme});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-headers':'*'},body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return json({});
  if(url.hostname==='ci.invalid'){
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname.endsWith('/profiles'))return json({id:owner,account_type:role,display_name:'Fixture',profile_visibility:'public'});
   if(url.pathname.endsWith('/subscriptions'))return json(billing);
   if(url.pathname.endsWith('/apple_memberships'))return json(['apple','both','both-stripe'].includes(kind)?{status:'active'}:null);
   if(url.pathname.endsWith('/rpc/get_current_user_admin_role'))return json(null);
   if(url.pathname.endsWith('/rpc/is_current_user_admin_or_moderator'))return json(false);
   return json([]);
  }
  if(url.origin!==new URL(base).origin)throw Error('Unexpected external request '+url.origin+url.pathname);
  if(url.pathname==='/api/membership'){assert.equal(req.headers().authorization,'Bearer '+token);return kind==='unavailable'?json({error:'Fixture membership outage'},503):json({owner,subscription:effective});}
  if(url.pathname.startsWith('/api/stripe/')){
   assert.equal(req.headers().authorization,'Bearer '+token);calls.push({path:url.pathname,body:req.postDataJSON()});
   if(url.pathname==='/api/stripe/cancel-subscription'){billing={...billing,cancel_at_period_end:true};if(effective?.provider==='stripe')effective={...effective,cancel_at_period_end:true};return json({current_period_end:billing.current_period_end});}
   return json({error:'Synthetic checkout is disabled; no charge made.'},503);
  }
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',value=>errors.push(value.message));page.on('dialog',dialog=>dialog.accept());
 try{
  await page.goto(base+'/membership');await page.getByRole('button',{name:/^Refresh membership$/i}).waitFor();
  await page.waitForFunction(()=>{const root=document.querySelector('main.hc-membership-page');return root&&[...root.querySelectorAll('button')].some(button=>button.textContent==='Refresh membership'&&!button.disabled);});
  if(kind==='fan'||kind==='fan-existing'){
   await page.getByRole('heading',{name:/^Fan membership status$/i}).waitFor();assert.equal(await page.getByRole('button',{name:/^Get (Pro|Premium)/i}).count(),0);assert.equal(await page.getByText('$4.99',{exact:true}).count(),0);assert.equal(await page.getByText('$9.99',{exact:true}).count(),0);
  }
  if(kind==='player'||kind==='coach'||kind==='manager'){
   const pro=page.getByRole('button',{name:/^Get Pro — Monthly$/i}),premium=page.getByRole('button',{name:/^Get Premium — Monthly$/i});
   if(role==='player')await pro.waitFor();else await page.getByRole('heading',{name:/^Premium for coaches and team managers\.$/i}).waitFor();
   await premium.waitFor();assert.equal(await pro.count(),role==='player'?1:0);assert.equal(await premium.isDisabled(),false);
   await (role==='player'?pro:premium).click();await page.getByRole('alert').filter({hasText:'Synthetic checkout is disabled'}).waitFor();assert.equal(calls.length,1);assert.equal(calls[0].body.plan,role==='player'?'pro':'premium');assert.equal(await premium.isDisabled(),true,'failed checkout requires refresh before retry');
  }
  if(kind==='apple'||kind==='both'||kind==='both-stripe'){
   await page.getByRole('heading',{name:/^HoopCheck Premium$/i}).waitFor();assert.equal(await page.getByRole('button',{name:/^Get (Pro|Premium)/i}).count(),0);assert.equal(await page.getByRole('link',{name:/^Manage Apple subscription$/i}).getAttribute('href'),'https://apps.apple.com/account/subscriptions');
   assert.equal(await page.getByRole('button',{name:/^Cancel Membership$/i}).count(),kind==='both'||kind==='both-stripe'?1:0);
  }
  if(kind==='both'||kind==='both-stripe'||kind==='fan-existing'){
   await page.getByRole('button',{name:/^Cancel Membership$/i}).click();await page.getByRole('button',{name:/^Keep Membership$/i}).waitFor();assert.equal(calls.at(-1).path,'/api/stripe/cancel-subscription');
   if(kind==='both'){assert.equal(effective.provider,'apple');assert.equal(effective.cancel_at_period_end,false);await page.getByRole('heading',{name:/^HoopCheck Premium$/i}).waitFor();assert.equal(await page.getByText('Renewal is cancelled. Access continues until the verified period ends.',{exact:true}).count(),0);}
  }
  if(kind==='manual'){await page.getByText(/Your existing membership is active and has no linked Stripe subscription\./i).waitFor();assert.equal(await page.getByRole('link',{name:/^Contact billing support$/i}).getAttribute('href'),'/support?membershipCancellation=1');assert.equal(await page.getByRole('button',{name:/^Cancel Membership$/i}).count(),0);assert.equal(await page.getByRole('link',{name:/^Manage Apple subscription$/i}).count(),0);}
  if(kind==='unavailable'){await page.getByRole('alert').filter({hasText:"couldn't verify your membership"}).waitFor();for(const button of await page.getByRole('button',{name:/^Get (Pro|Premium)/i}).all())assert.equal(await button.isDisabled(),true);assert.equal(calls.length,0);}
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'membership has no horizontal overflow');
 }catch(error){console.error("FIXTURE_FAILURE",kind,theme,page.url(),await page.locator("button").evaluateAll(nodes=>nodes.map(v=>({text:v.innerText,label:v.getAttribute("aria-label"),disabled:v.disabled}))),await page.locator("body").ariaSnapshot(),errors);throw error;}finally{await context.close();}
}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});try{for(const theme of['light','dark'])for(const kind of['player','coach','manager','fan','fan-existing','apple','both','both-stripe','manual','unavailable']){await verify(browser,theme,kind);console.log('PASS: membership provider/role/billing recovery '+kind+' '+theme);}}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
