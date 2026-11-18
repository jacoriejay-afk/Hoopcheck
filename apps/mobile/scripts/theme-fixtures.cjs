/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local browser QA harness. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
(async () => {
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const results=[]; fs.mkdirSync('/tmp/hoopcheck-motion-qa',{recursive:true});
 for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
  await context.addInitScript(() => {
   localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({haptics:true,appLock:false,onboardingDone:true}));
   const id='11111111-1111-4111-8111-111111111111';
   const claims={sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'};
   const token=btoa(JSON.stringify({alg:'HS256'}))+'.'+btoa(JSON.stringify(claims))+'.test';
   localStorage.setItem('sb-motion-test-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-only',expires_at:claims.exp,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}}));
  });
  await context.route('https://motion-test.supabase.co/**',async route=>{
   const url=new URL(route.request().url()); const table=url.pathname.split('/').pop();
   const team={id:'abc-123',name:'Fixture Basketball Club',city:'Fixture City',country:'Test Country',league_name:'Fixture League',website:null};
   const league={id:'league-123',name:'Fixture League',country:'Test Country',level:'Professional',season:'2026-27',website:null};
   const profile={id:'11111111-1111-4111-8111-111111111111',display_name:'Fixture Player',username:'fixtureplayer',account_type:'player',country:'Test Country',current_country:'Test Country',current_team:team.name,position:'PG',years_pro:3,free_agent:false,bio:'Fixture profile for local UI verification.',hometown:null,nationality:null,experience_summary:null,basketball_type:'mens'};
   let data=table==='teams'?[team]:table==='leagues'?[league]:table==='profiles'?[profile]:table==='reviews'?[{id:'review-123',overall_rating:4,title:'Fixture approved review',body:'Local fixture content for layout verification only.',created_at:new Date().toISOString(),player_season:'2025-26',is_anonymous:true}]:[];
   if(route.request().headers().accept?.includes('vnd.pgrst.object'))data=data[0]??null;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const path of ['/dashboard','/teams','/teams/abc-123','/leagues','/leagues/league-123','/players','/players/11111111-1111-4111-8111-111111111111','/coaches','/teams/abc-123/review','/settings']) {
   await page.goto('http://localhost:8081'+path);
   const expected = path==='/dashboard'?'Explore basketball':path==='/teams'?'Find a team':path==='/leagues'?'Find a league':path==='/players'?'Find players':path==='/coaches'?'Find a coach':path==='/settings'?'Haptics':path.endsWith('/review')?'Who can submit?':path.includes('/teams/')?'Fixture Basketball Club':path.includes('/leagues/')?'Fixture League':'Fixture Player';
   await page.getByText(expected,{exact:false}).first().waitFor({timeout:45000});
   await page.waitForTimeout(500);
   const text=await page.locator('body').innerText();
   const file=theme+'-'+path.replaceAll('/','_')+'.png'; await page.screenshot({path:'/tmp/hoopcheck-motion-qa/'+file,fullPage:true});
   results.push({theme,path,url:page.url(),title:text.slice(0,160),errors:[...errors]}); errors.length=0;
  }
  // Shared auth surfaces and first-run onboarding use a separate anonymous context.
  const anon=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
  await anon.addInitScript(()=>localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({haptics:true,appLock:false,onboardingDone:true})));
  const authPage=await anon.newPage();
  for(const [path,expected] of [['/','Know who'],['/sign-in','Welcome back'],['/sign-up','Create your account'],['/forgot-password','Reset password']]) {
   await authPage.goto('http://localhost:8081'+path);
   await authPage.getByText(expected,{exact:false}).first().waitFor({timeout:30000});
   await authPage.waitForTimeout(300);
   await authPage.screenshot({path:'/tmp/hoopcheck-motion-qa/'+theme+'-auth-'+path.replaceAll('/','_')+'.png',fullPage:true});
   results.push({theme,path,anonymous:true,title:(await authPage.locator('body').innerText()).slice(0,120)});
  }
  await anon.close();
  await context.close();
 }
 fs.writeFileSync('/tmp/hoopcheck-motion-qa/results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2)); await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
