/* eslint-disable @typescript-eslint/no-require-imports -- Isolated local theme regression harness. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const base=process.env.NATIVE_TEST_URL || 'http://127.0.0.1:8091';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Local fixture only');
const uid='11111111-1111-4111-8111-111111111111';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark'});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===new URL(base).origin)return route.continue();
  if(url.hostname==='fixture.supabase.co')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(url.pathname==='/auth/v1/user'?{id:uid,email:'fixture@example.test',user_metadata:{}}:[])});
  return route.abort();
 });
 await context.addInitScript(({uid})=>{
  if(!localStorage.getItem('hoopcheck:device-preferences:v1'))localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({haptics:false,appLock:false,onboardingDone:true,theme:'system'}));
  const exp=Math.floor(Date.now()/1000)+3600;
  const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify({sub:uid,exp,role:'authenticated'}))+'.fixture';
  localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:exp,user:{id:uid,aud:'authenticated',email:'fixture@example.test',user_metadata:{}}}));
 },{uid});
 const page=await context.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await page.goto(`${base}/settings`);
 const group=page.getByRole('radiogroup',{name:'Appearance',exact:true});
 async function background(expected){await page.waitForFunction(expected=>{
  let el=document.querySelector('[role="radiogroup"][aria-label="Appearance"]');
  while(el){const color=getComputedStyle(el).backgroundColor;if(color!=='rgba(0, 0, 0, 0)'&&color!=='transparent')return color===expected;el=el.parentElement;}
  return false;
 },expected);}
 async function choose(name,value,color){await page.getByRole('radio',{name,exact:true}).click();await page.locator(`[role="radio"][aria-label="${name}"][aria-checked="true"]`).waitFor({timeout:5000}).catch(async e=>{console.log('RADIOS',await page.locator('[role=radio]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML)));console.log('PREFS',await page.evaluate(()=>localStorage.getItem('hoopcheck:device-preferences:v1')));console.log('BODY',await page.locator('body').innerText());throw e;});await background(color);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hoopcheck:device-preferences:v1')).theme),value);}
 await group.waitFor();await background('rgb(0, 0, 0)');
 await choose('Light theme','light','rgb(244, 244, 241)');
 await page.reload();await background('rgb(244, 244, 241)');
 await choose('Dark theme','dark','rgb(0, 0, 0)');
 await choose('Use device theme','system','rgb(0, 0, 0)');
 await page.emulateMedia({colorScheme:'light'});await background('rgb(244, 244, 241)');
 await page.evaluate(()=>{window.fixtureOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='hoopcheck:device-preferences:v1')throw new Error('Fixture storage failure');return window.fixtureOriginalSet.call(this,key,value);};});
 await page.getByRole('radio',{name:'Dark theme',exact:true}).click();
 await page.getByText('Couldn’t save appearance. Please try again.',{exact:true}).waitFor();await background('rgb(244, 244, 241)');
 assert.equal(await page.getByRole('radio',{name:'Use device theme',exact:true}).getAttribute('aria-checked'),'true');
 await page.evaluate(()=>{Storage.prototype.setItem=window.fixtureOriginalSet;});
 await page.getByRole('switch',{name:'Haptics',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hoopcheck:device-preferences:v1')).haptics===true);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hoopcheck:device-preferences:v1')).theme),'system');
 await page.screenshot({path:'/tmp/hoopcheck-theme-ui.png',fullPage:true});
 console.log('PASS: theme overrides, persistence/reload, system changes, failed-save isolation');
 await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
