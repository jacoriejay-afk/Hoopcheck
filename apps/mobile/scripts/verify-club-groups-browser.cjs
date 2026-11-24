/* eslint-disable @typescript-eslint/no-require-imports -- Isolated group fixtures, no hosted records. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.NATIVE_TEST_URL||'http://127.0.0.1:8094';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local fixture only');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
async function verify(browser,theme,role='fan',moderator=false){
 const context=await browser.newContext({viewport: require("./compact-layout.cjs").viewport,colorScheme:theme});
 const uid=id(30),team=id(1),post=id(100),calls=[],errors=[];
 const user={id:uid,aud:'authenticated',email:'fixture@example.test',user_metadata:{}};
 const exp=Math.floor(Date.now()/1000)+3600;
 const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp,role:'authenticated'})).toString('base64url')+'.fixture';
 let member=false,declined=false,pinned=false,removed=false;
 const posts=[{id:post,team_id:team,author_id:id(31),body:'Fixture private club conversation',image_url:null,is_pinned:false,created_at:'2026-11-18T12:00:00Z',profiles:{display_name:'Club member'}}];
 const comments=[{id:id(200),post_id:post,author_id:id(31),body:'Fixture group comment',created_at:'2026-11-18T12:01:00Z',profiles:{display_name:'Club member'}}];
 await context.routeWebSocket('**/*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method(),body=request.postData()||'';
  if(url.origin===new URL(base).origin)return route.continue();
  calls.push({path:url.pathname,method,body});
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)});
  if(method==='OPTIONS')return json({});
  if(url.hostname==='api.test'){
   assert.ok(request.headers().authorization?.startsWith('Bearer '));
   if(url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Fixture Member',accountType:role},entitlements:{tier:'free',hasPaidMembership:false,canReadHoopFeed:false,canWriteHoopFeed:false,canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:role==='fan'}});
   if(url.pathname==='/api/fan-groups'){
    const fields=Object.fromEntries([...body.matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n/g)].map(m=>[m[1],m[2]]));assert.equal(fields.team_id,team);
    if(fields.action==='join'){assert.equal(role,'fan');member=true;return json({ok:true,joined:true});}
    if(fields.action==='leave'){member=false;return json({ok:true,left:true});}
    if(fields.action==='create_post'){
     assert.equal(member,true);assert.equal(role,'fan');
     if(!declined){declined=true;return json({ok:false,message:'Fixture group moderation declined.'},400);}
     posts.push({id:id(101),team_id:team,author_id:uid,body:fields.body,image_url:null,is_pinned:false,created_at:'2026-11-18T12:02:00Z',profiles:{display_name:'Fixture Member'}});return json({ok:true});
    }
    if(fields.action==='comment'){assert.equal(member,true);comments.push({id:id(201),post_id:fields.post_id,author_id:uid,body:fields.body,created_at:'2026-11-18T12:03:00Z',profiles:{display_name:'Fixture Member'}});return json({ok:true});}
    if(fields.action==='report_post'){assert.equal(member,true);assert.equal(fields.post_id,post);assert.equal(fields.reason,'Fixture report context');return json({ok:true});}
    if(fields.action==='pin_post'){assert.equal(moderator,true);assert.equal(fields.post_id,post);pinned=true;posts[0].is_pinned=true;return json({ok:true});}
    if(fields.action==='remove_post'){assert.equal(moderator,true);assert.equal(fields.post_id,post);removed=true;return json({ok:true});}
   }
  }
  if(url.hostname==='fixture.supabase.co'){
   if(url.pathname==='/auth/v1/user')return json(user);
   const table=url.pathname.split('/').pop();
   if(table==='team_fan_groups')return json([{team_id:team,group_name:'Fixture Club Group'}]);
   if(table==='get_team_fan_group_summary')return json([{group_name:'Fixture Club Group',member_count:member?3:2,join_mode:'open',is_member:true,has_pending_request:false}]); // Deliberately untrusted membership hint.
   if(table==='team_fan_group_members'){assert.equal(url.searchParams.get('user_id'),`eq.${uid}`);assert.equal(url.searchParams.get('team_id'),`eq.${team}`);return json(member?{user_id:uid}:null);}
   if(table==='is_team_fan_group_moderator')return json(moderator);
   if(table==='teams'){
    if(url.searchParams.get('select')==='id,logo_url,logo_bg'){
     assert.ok(url.searchParams.get('id')?.includes(team),'The club crest lookup must be limited to visible club IDs');
     return json([{id:team,logo_url:null,logo_bg:null}]);
    }
    return json({name:'Fixture Club',basketball_type:'womens'});
   }
   if(table==='womens_teams'){
    assert.equal(url.searchParams.get('select'),'id,logo_url,logo_bg');
    assert.ok(url.searchParams.get('id')?.includes(team),"Women's crest lookup must be limited to visible club IDs");
    return json([]);
   }
   if(table==='team_fan_group_posts'){assert.ok(member||moderator,'Non-member must never request protected posts');assert.equal(url.searchParams.get('team_id'),`eq.${team}`);return json(removed?posts.slice(1):posts);}
   if(table==='team_fan_group_comments'){assert.ok(member||moderator);const target=url.searchParams.get('post_id').slice(3);return json(comments.filter(comment=>comment.post_id===target));}
   if(table==='profiles')return json([{id:uid,display_name:'Fixture Member'}]);
  }
  throw new Error(`Unexpected external request: ${url.origin}${url.pathname}`);
 });
 await context.addInitScript(({token,user,exp})=>{
  localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:exp,user}));
  localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({appLock:false,haptics:false,onboardingDone:true}));
 },{token,user,exp});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(`${base}/team-hub/groups`);await page.getByText('Fixture Club Group',{exact:true}).waitFor();
  await require('./compact-layout.cjs').capture(page,{path:`/tmp/hoopcheck-native-ui/groups-directory-${theme}.png`,fullPage:true});
  await page.getByRole('textbox',{name:'Search club groups',exact:true}).fill('Fixture');await page.getByText('Fixture Club Group',{exact:true}).click();
  await page.getByRole('heading',{name:'Fixture Club Group',exact:true}).waitFor();
  if(role!=='fan'&&!moderator){await page.getByText('Club group conversations are available to fan accounts and appointed moderators.',{exact:true}).waitFor();assert.ok(!calls.some(c=>c.path.endsWith('/team_fan_group_posts')));assert.equal(await page.getByRole('button',{name:'Join club group',exact:true}).count(),0);console.log('PASS non-fan group permission gate');return;}
  if(!moderator){
   assert.equal(await page.getByText('Fixture private club conversation',{exact:true}).count(),0);assert.ok(!calls.some(c=>c.path.endsWith('/team_fan_group_posts')));
   await page.getByRole('button',{name:'Join club group',exact:true}).click();
  }
  await page.getByText('Fixture private club conversation',{exact:true}).waitFor();
  if(moderator){
   assert.equal(await page.getByRole('textbox',{name:'Club group post',exact:true}).count(),0);
   await page.getByRole('button',{name:'Pin post',exact:true}).click();await page.getByText(/^Pinned · /).waitFor();assert.equal(pinned,true);
   await page.getByRole('button',{name:'Remove post',exact:true}).click();assert.equal(removed,false);await page.getByRole('button',{name:'Keep post',exact:true}).click();assert.equal(removed,false);
   await page.getByRole('button',{name:'Remove post',exact:true}).click();await page.getByRole('button',{name:'Confirm remove post',exact:true}).click();await page.getByText('No club group posts yet.',{exact:true}).waitFor();assert.equal(removed,true);
   console.log('PASS appointed moderator: read/pin/confirmed remove with no fan posting grant');return;
  }
  const composer=page.getByRole('textbox',{name:'Club group post',exact:true});await composer.fill('Fixture group draft stays');await page.getByRole('button',{name:'Post to club group',exact:true}).click();await page.getByText('Fixture group moderation declined.',{exact:true}).waitFor();assert.equal(await composer.inputValue(),'Fixture group draft stays');
  await page.getByRole('button',{name:'Post to club group',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Club group post"]')?.value==='');await page.getByText('Fixture group draft stays',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Comments',exact:true}).first().click();await page.getByText('Fixture group comment',{exact:true}).waitFor();
  const comment=page.getByRole('textbox',{name:'Club group comment',exact:true});await comment.fill('Fixture fan reply');await page.getByRole('button',{name:'Comments',exact:true}).first().click();await page.getByRole('button',{name:'Comments',exact:true}).first().click();await comment.waitFor();assert.equal(await comment.inputValue(),'Fixture fan reply');await page.getByRole('button',{name:'Send comment',exact:true}).click();await page.getByText('Fixture fan reply',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Report post',exact:true}).first().click();await page.getByRole('textbox',{name:'Group post report reason',exact:true}).fill('Fixture report context');await page.getByRole('button',{name:'Send group report',exact:true}).click();await page.getByText('Report sent to HoopCheck moderators.',{exact:true}).waitFor();
  await require("./compact-layout.cjs").capture(page, {path:`/tmp/hoopcheck-native-ui/club-group-${theme}.png`,fullPage:true});
  await page.getByRole('button',{name:'Leave club group',exact:true}).click();await page.getByRole('button',{name:'Join club group',exact:true}).waitFor();assert.equal(await page.getByText('Fixture private club conversation',{exact:true}).count(),0);assert.equal(await page.getByText('Fixture fan reply',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log(`PASS ${theme} free fan: directory/search/verified join/moderated post/draft/comment/report/leave/privacy`);
 }catch(error){console.log('Fixture failure',page.url());console.log(await page.locator('body').innerText());console.log(errors);throw error;}finally{await context.close();}
}
(async()=>{fs.mkdirSync('/tmp/hoopcheck-native-ui',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{for(const theme of ['light','dark'])await verify(browser,theme);await verify(browser,'light','player');await verify(browser,'dark','player',true);}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
