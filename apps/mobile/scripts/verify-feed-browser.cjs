/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser fixture; no real account or backend. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.NATIVE_TEST_URL || 'http://127.0.0.1:8092';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Local fixture only');
const uid='11111111-1111-4111-8111-111111111111';
const id=n=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.test',user_metadata:{}};
const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.fixture';
const videoPath=process.env.FIXTURE_VIDEO || require('node:path').join(__dirname,'fixtures/orange.webm');
let png;
async function fixture(browser,theme,allowed=true){
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
  const calls=[],errors=[];let mediaFailed=false;let denied=false,checked=false,saved=false,vote=null,read=false;const blocked=new Set();
  const posts=[
    {id:id(1),body:'Fixture community discussion',image_url:'protected/photo.png',post_kind:'discussion'},
    {id:id(2),body:'Fixture poll',post_kind:'poll',poll_options:['Home team','Away team']},
    {id:id(3),author_id:id(5),body:'Fixture reel',post_kind:'discussion',video_url:'protected/video.webm'},
  ].map((p,i)=>({author_id:uid,created_at:`2026-11-18T10:00:0${i}Z`,expires_at:null,profiles:{display_name:'Fixture Member',account_type:'player'},...p}));
  const comments=[{id:id(8),post_id:id(1),author_id:uid,body:'Original fixture comment',parent_id:null,created_at:'2026-11-18T11:00:00Z',profiles:{display_name:'Fixture Member'}}];
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===new URL(base).origin)return route.continue();
    const method=request.method();
    const body=request.postData()||'';
    calls.push({path:url.pathname,method,body,query:url.search});
    const json=(data,status=200)=>route.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify(data)});
    if(method==='OPTIONS')return json({});
    if(url.hostname==='api.test'){
      assert.ok(request.headers().authorization?.startsWith('Bearer '),'API must receive bearer');
      if(url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Fixture Member',accountType:'player'},entitlements:{tier:allowed?'pro':'free',hasPaidMembership:allowed,canReadHoopFeed:allowed,canWriteHoopFeed:allowed,canUseLiveGameHub:allowed,canUseLiveGameChat:allowed,canSwitchBasketballSide:allowed,canUseFanGroups:allowed}});
      if(url.pathname==='/api/hoopfeed/media'&&body.includes('photo.png')&&!mediaFailed){mediaFailed=true;return json({error:'Synthetic media failure'},503);}
      if(url.pathname==='/api/hoopfeed/media')return json({url:`https://fixture.supabase.co/storage/v1/object/sign/feed/${body.includes('video.webm')?'video.webm':'photo.png'}?token=synthetic`});
      if(url.pathname==='/api/hoopfeed/moderate'){
        const fields=Object.fromEntries([...body.matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n/g)].map(m=>[m[1],m[2]]));
        if(fields.kind==='bookmark'){saved=fields.saved==='true';return json({allowed:true});}
        if(fields.kind==='vote'){vote=Number(fields.option_index);return json({allowed:true});}
        if(fields.kind==='comment'){
          const comment={id:id(9),post_id:fields.post_id,author_id:uid,body:fields.text,parent_id:fields.parent_id||null,created_at:'2026-11-18T12:00:00Z'};
          assert.equal(comment.parent_id,id(8));comments.push(comment);return json({allowed:true,comment});
        }
        if(!denied){denied=true;return json({allowed:false,message:'Fixture moderation declined; draft retained.'},400);}
        assert.equal(fields.text,'Fixture draft stays');return json({allowed:true});
      }
    }
    if(url.hostname==='fixture.supabase.co'){
      if(url.pathname==='/auth/v1/user')return json(user);
      if(url.pathname.startsWith('/storage/v1/object/sign/'))return route.fulfill({status:200,contentType:url.pathname.endsWith('.webm')?'video/webm':'image/png',headers:{'access-control-allow-origin':'*'},body:url.pathname.endsWith('.webm')?fs.readFileSync(videoPath):png});
      const table=url.pathname.split('/').pop();
      if(table==='feed_posts'){
        assert.ok(allowed,'Denied viewer must never query protected posts');
        return json(url.searchParams.has('video_url')?posts.filter(p=>p.video_url):posts);
      }
      if(table==='feed_post_archives')return json([]);
      if(table==='user_blocks'){
        assert.ok(allowed,'Denied viewer cannot access account blocks');
        if(method==='POST'){assert.ok(!String(request.headers().prefer||'').includes('resolution=merge-duplicates'),'Reel blocking must use INSERT, not UPDATE-requiring upsert');const record=JSON.parse(body);assert.equal(record.blocker_id,uid);assert.equal(record.blocked_id,id(5));blocked.add(record.blocked_id);return json({},201);}
        assert.equal(url.searchParams.get('blocker_id'),`eq.${uid}`,'Only owner block list can be read');
        return json([...blocked].map(blocked_id=>({blocked_id})));
      }
      if(table==='feed_post_bookmarks')return json(saved?[{post_id:id(1)}]:[]);
      if(table==='fan_live_games'){
        // Optional HomeCourt live score rail: no scheduled games in the
        // synthetic fixture, without changing LIVE/final authority.
        assert.equal(method,'GET');
        return json([]);
      }
      if(table==='get_public_follow_list'){
        // Read-only public follow rail is optional. No synthetic accounts are
        // following in this fixture, and no private relation rows are exposed.
        assert.equal(method,'POST');
        return json([]);
      }
      if(table==='get_hoopfeed_check_totals')return json(JSON.parse(body).post_ids.map(post_id=>({post_id,checks_count:checked?1:0,checked_by_me:checked})));
      if(table==='feed_post_checks'){checked=method==='POST';return route.fulfill({status:204});}
      if(table==='get_hoopfeed_poll_totals')return json([0,1].map(option_index=>({option_index,votes_count:vote===option_index?1:0,voted_by_me:vote===option_index})));
      if(table==='feed_post_comments')return json(comments);
      if(table==='notifications'){
        assert.equal(url.searchParams.get('user_id'),`eq.${uid}`);
        if(method==='PATCH'){assert.equal(url.searchParams.get('read_at'),'is.null');read=true;return json([{id:id(7)}]);}
        return json([{id:id(7),target_type:'team',target_id:id(6),notification_type:'review',title:'Fixture team review',body:'A team you follow has a new review.',read_at:read?'2026-11-18T12:00:00Z':null,created_at:'2026-11-18T11:00:00Z'}]);
      }
      if(table==='profiles')return json([{id:uid,username:'fixture',display_name:'Fixture Member'}]);
    }
    throw new Error(`Unexpected external request: ${url.origin}${url.pathname}`);
  });
  await context.addInitScript(({token,user})=>{
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__sharedFeed=data;}});
    localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user}));
    localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({haptics:false,appLock:false,onboardingDone:true}));
  },{token,user});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(`${base}/feed`);
    if(!allowed){await page.getByText('An active HoopCheck membership is required to use HoopFeed.',{exact:true}).waitFor();assert.ok(!calls.some(c=>c.path.endsWith('/feed_posts')||c.path.endsWith('/user_blocks')));return;}
    await page.getByText('Fixture community discussion',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Media unavailable. Tap to retry.',exact:true}).click();
    await page.getByRole('img',{name:'HoopFeed photo',exact:true}).waitFor();
    await page.waitForFunction(()=>{const image=document.querySelector('img[alt="HoopFeed photo"]');return image&&image.complete&&image.naturalWidth===640;});
    const photoBox=await page.getByRole('img',{name:'HoopFeed photo',exact:true}).boundingBox();assert.ok(photoBox.width>250&&photoBox.height>120,'Photo has visible dimensions');
    assert.equal(await page.getByRole('heading',{name:'HoopFeed',exact:true}).count(),0,'No duplicate headings');
    await page.screenshot({path:`/tmp/hoopcheck-native-ui/feed-posts-${theme}.png`,fullPage:true});
    await page.getByRole('button',{name:'Create HoopFeed post',exact:true}).click();
    const composer=page.getByRole('textbox',{name:'Write a HoopFeed post'});
    await composer.fill('Fixture draft stays');await page.getByRole('button',{name:'Post',exact:true}).click();
    await page.getByText('Fixture moderation declined; draft retained.',{exact:true}).waitFor();assert.equal(await composer.inputValue(),'Fixture draft stays');
    await page.getByRole('button',{name:'Post',exact:true}).click();await page.getByText('Published after safety checks.',{exact:true}).waitFor();assert.equal(await composer.inputValue(),'');
    await page.getByRole('button',{name:'Comments',exact:true}).first().click();
    await page.getByText('Original fixture comment',{exact:true}).waitFor();await page.getByRole('button',{name:'Reply to Fixture Member',exact:true}).first().click();
    await page.getByRole('textbox',{name:'Write a comment'}).fill('Fixture reply');await page.getByRole('button',{name:'Comment',exact:true}).click();
    await page.getByText('Fixture reply',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Check post, 0 Checks',exact:true}).first().click();await page.getByRole('button',{name:'Remove Check, 1 Checks',exact:true}).first().waitFor();
    await page.getByRole('button',{name:'Save',exact:true}).first().click();await page.getByRole('button',{name:'Saved',exact:true}).first().waitFor();
    await page.getByRole('button',{name:'Share',exact:true}).first().click();
    assert.ok((await page.evaluate(()=>window.__sharedFeed))?.text?.includes('hoopcheck.online/feed#post-'),'Share uses canonical post link');
    const option=page.getByRole('button',{name:'Home team · 0',exact:true});await option.scrollIntoViewIfNeeded();await option.click();await page.getByRole('button',{name:'Home team · 1 ✓',exact:true}).waitFor();
    await page.getByRole('tab',{name:'Reels',exact:true}).click();
    const video=page.locator('video');await video.waitFor();
    await video.evaluate(async element=>{element.muted=true;await element.play();});
    await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.paused&&v.currentTime>0;});
    await page.screenshot({path:`/tmp/hoopcheck-native-ui/reels-${theme}.png`,fullPage:true});
    assert.ok(calls.some(c=>c.path==='/api/hoopfeed/media'&&c.body.includes('protected/video.webm')));
    await page.getByRole('button',{name:'Block this HoopCheck account'}).click();
    await page.getByText('Creator added to your HoopCheck blocked accounts.',{exact:true}).waitFor();
    assert.ok(blocked.has(id(5)),'Native block saves to shared account block table');
    await page.getByText('No video posts are available in this page.',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Alerts',exact:true}).click();await page.getByText('Fixture team review',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Mark all as read',exact:true}).click();await page.getByRole('button',{name:'unread',exact:true}).click();await page.getByText('Nothing in this category.',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Account',exact:true}).click();await page.getByText('Active access verified by HoopCheck',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Search',exact:true}).click();await page.getByText('Search basketball',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Home',exact:true}).click();await page.getByText('Explore basketball',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);await page.screenshot({path:`/tmp/hoopcheck-native-ui/feed-${theme}.png`,fullPage:true});
    console.log(`PASS ${theme}: native feed moderation/draft/reply/check/save/poll/Reels playback/alerts/account/search/home`);
  }catch(error){console.log('Fixture failure URL:',page.url());console.log(await page.locator('body').innerText());throw error;}finally{await context.close();}
}
(async()=>{png=await require('sharp')({create:{width:640,height:360,channels:3,background:'#FF5A1F'}}).png().toBuffer();fs.mkdirSync('/tmp/hoopcheck-native-ui',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{for(const theme of ['light','dark'])await fixture(browser,theme);await fixture(browser,'light',false);console.log('PASS denied membership: protected feed queries never started');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
