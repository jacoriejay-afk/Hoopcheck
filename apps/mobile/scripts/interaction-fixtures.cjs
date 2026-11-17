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
  await page.goto('http://localhost:8081/teams');
  await page.getByText('Fixture Basketball Club',{exact:true}).filter({visible:true}).first().waitFor();
  const input=page.getByPlaceholder('Team, country, city or league');
  await input.fill('Fixture');
  await page.getByText('1 result shown',{exact:true}).waitFor();
  await input.blur();
  await input.fill('');
  await page.getByText('Recent searches',{exact:true}).waitFor();
  await page.getByText('Fixture Basketball Club',{exact:true}).filter({visible:true}).first().click();
  await page.getByRole('button',{name:'Share profile',exact:true}).click();
  await page.getByText('Choose where to share',{exact:true}).waitFor();
  await page.waitForTimeout(800);
  const shareBounds=await page.getByText('Choose where to share',{exact:true}).boundingBox();
  if(!shareBounds || shareBounds.y + shareBounds.height > 844) throw new Error('Share sheet content is outside viewport: '+JSON.stringify(shareBounds));
  await page.screenshot({path:'/tmp/hoopcheck-motion-qa/'+theme+'-share-sheet.png'});
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('tab',{name:'Teams',exact:true}).click();
  await page.getByText('Fixture Basketball Club',{exact:true}).filter({visible:true}).first().waitFor();
  await context.setOffline(true);
  await page.getByRole('tab',{name:'Home',exact:true}).click();
  await page.getByRole('tab',{name:'Teams',exact:true}).click();
  await page.getByText(/showing saved data/).filter({visible:true}).first().waitFor();
  await page.getByText('Fixture Basketball Club',{exact:true}).filter({visible:true}).first().waitFor();
  await page.getByText('Fixture Basketball Club',{exact:true}).filter({visible:true}).first().click();
  await page.getByText(/saved.*min ago/).filter({visible:true}).first().waitFor();
  await page.screenshot({path:'/tmp/hoopcheck-motion-qa/'+theme+'-offline-team.png'});
  await context.setOffline(false);
  await page.getByText('Latest reviews',{exact:true}).filter({visible:true}).first().waitFor();
  results.push({theme,search:'pass',shareSheet:'pass',offlineCache:'pass',errors:[...errors]});
  await context.close();
 }
 fs.writeFileSync('/tmp/hoopcheck-motion-qa/interactions.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2)); await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
