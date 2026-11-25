/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic localhost fixture. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.NATIVE_TEST_URL||'http://127.0.0.1:8096';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local fixture only');
async function verify(browser,theme,role='player'){
 const context=await browser.newContext({viewport: require("./compact-layout.cjs").viewport,colorScheme:theme});
 const uid='11111111-1111-4111-8111-111111111111',exp=Math.floor(Date.now()/1000)+3600;
 let user={id:uid,aud:'authenticated',email:'fixture@example.test',user_metadata:{hoopcheck_profile_cover:'court'}};
 const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp,role:'authenticated'})).toString('base64url')+'.fixture';
 let profile={id:uid,account_type:role,first_name:'Locked',last_name:'Identity',username:'fixture',years_pro:4,display_name:'Fixture Member',bio:'Fixture bio',hometown:'Town',nationality:'US',favorite_teams:'Club',favorite_leagues:'League',interests:'Interests',experience_summary:'Coach background',position:'PG',height:'193 cm',current_country:'France',current_team:'Fixture Club',free_agent:false,current_country_public:false,profile_visibility:'players_only'};
 let failed=false;const writes=[],errors=[];
 await context.routeWebSocket('**/*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();if(url.origin===new URL(base).origin)return route.continue();
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)});
  if(method==='OPTIONS')return json({});
  if(url.hostname==='api.test'&&url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Fixture Member',accountType:role},entitlements:{tier:'free',hasPaidMembership:false,canReadHoopFeed:role==='player',canWriteHoopFeed:role==='player',canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:role==='fan'}});
  if(url.hostname==='fixture.supabase.co'){
   if(url.pathname==='/auth/v1/user'){
    if(method==='PUT'){assert.equal(request.headers().authorization,`Bearer ${token}`);const body=request.postDataJSON();assert.deepEqual(Object.keys(body.data),['hoopcheck_profile_cover']);user={...user,user_metadata:{...user.user_metadata,...body.data}};}
    return json(user);
   }
   if(url.pathname==='/rest/v1/rpc/get_own_profile'){assert.equal(request.headers().authorization,`Bearer ${token}`);assert.deepEqual(request.postDataJSON(),{});return json(profile);}
  // Account activity reads are owner-scoped, read-only, and use the canonical RPC.
  if(url.hostname==='fixture.supabase.co'&&url.pathname==='/rest/v1/rpc/get_public_follow_list'){
    assert.equal(route.request().method(),'POST');
    assert.equal(route.request().headers().authorization,`Bearer ${token}`);
    assert.deepEqual(route.request().postDataJSON(),{p_mode:'following',p_target_type:null,p_target_id:null,p_user_id:uid});
    return json([]);
  }
  if(url.hostname==='fixture.supabase.co'&&['/rest/v1/feed_posts','/rest/v1/reviews'].includes(url.pathname)&&route.request().method()==='HEAD'){
    if(url.pathname.endsWith('/feed_posts')){
      assert.ok(role==='player','Feed count requires membership access');
      assert.equal(url.searchParams.get('status'),'eq.approved');
      assert.match(url.searchParams.get('or')||'',/^\(expires_at\.is\.null,expires_at\.gt\./);
    }else assert.equal(role,'player','Review count is player-only');
    assert.equal(route.request().headers().authorization,`Bearer ${token}`);
    assert.equal(url.searchParams.get('author_id'),`eq.${uid}`);
    assert.equal(url.searchParams.get('select'),'id');
    assert.match(route.request().headers().prefer||'',/count=exact/);
    return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'content-range','content-range':'*/0'}});
  }
   if(url.pathname==='/rest/v1/profiles'){
    assert.equal(url.searchParams.get('id'),`eq.${uid}`);
    if(method==='PATCH'){
     const body=request.postDataJSON();writes.push(body);for(const key of ['id','first_name','last_name','years_pro','player_verified','coach_verified','account_type','admin_role'])assert.equal(key in body,false);
     if(!failed){failed=true;return json({message:'Fixture rejected save' },403);}profile={...profile,...body};return json({id:uid});
    }
    return json(profile);
   }
  }
  throw Error(`Unexpected external fixture request ${url.origin}${url.pathname}`);
 });
 await context.addInitScript(({token,user,exp})=>{localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:exp,user}));localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({appLock:false,haptics:false,onboardingDone:true}));},{token,user,exp});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`${base}/account/edit`);await page.getByRole('textbox',{name:'Display name',exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Display name',exact:true}).inputValue(),'Fixture Member');assert.equal(await page.getByRole('textbox',{name:'First name',exact:true}).count(),0);
  if(role==='player'){await page.getByRole('textbox',{name:'Position',exact:true}).fill('SG');await page.getByRole('switch',{name:'Free agent',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Current team',exact:true}).count(),0);}
  if(role==='coach'){await page.getByRole('textbox',{name:'Coaching experience',exact:true}).fill('Fixture coach experience');assert.equal(await page.getByRole('textbox',{name:'Position',exact:true}).count(),0);}
  if(role==='fan'){await page.getByText('Your account uses a private profile.',{exact:true}).waitFor();assert.equal(await page.getByRole('radio',{name:'Public profile',exact:true}).count(),0);}
  const bio=page.getByRole('textbox',{name:'Bio',exact:true});await bio.fill('Fixture retained biography');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByText('Profile save could not be confirmed. Your draft is unchanged.',{exact:true}).waitFor();assert.equal(await bio.inputValue(),'Fixture retained biography');
  await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByText('Profile saved.',{exact:true}).waitFor();assert.equal(profile.bio,'Fixture retained biography');
  if(role==='player'){assert.equal(profile.current_team,null);assert.equal(profile.free_agent,true);assert.equal(profile.position,'SG');}
  if(role==='fan')assert.equal('profile_visibility' in writes.at(-1),false);
  if(role==='coach')assert.equal(profile.experience_summary,'Fixture coach experience');
  await page.getByRole('button',{name:'Rose cover',exact:true}).click();await page.getByRole('button',{name:'Save profile cover',exact:true}).click();await page.getByText('Profile cover saved.',{exact:true}).waitFor();assert.equal(user.user_metadata.hoopcheck_profile_cover,'rose');
  await bio.fill('Fixture draft after navigation');await page.getByRole('tab',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Edit profile',exact:true}).click();await bio.waitFor();assert.equal(await bio.inputValue(),'Fixture draft after navigation');
  await page.getByRole('button',{name:'Discard draft and reload',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Bio"]')?.value==='Fixture retained biography');
  await require("./compact-layout.cjs").capture(page, {path:`/tmp/hoopcheck-native-ui/profile-editor-${role}-${theme}.png`,fullPage:true});assert.deepEqual(errors,[]);console.log(`PASS ${theme} ${role}: own profile/locked identity/role fields/failure draft/save/cover/navigation/reload`);
 }catch(error){console.log(await page.locator('body').innerText());console.log(errors);throw error;}finally{await context.close();}
}
(async()=>{fs.mkdirSync('/tmp/hoopcheck-native-ui',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{for(const theme of ['light','dark'])await verify(browser,theme);await verify(browser,'light','fan');await verify(browser,'dark','coach');}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
