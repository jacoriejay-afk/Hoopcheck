/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic accounts and intercepted media requests only. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.NATIVE_TEST_URL||'http://127.0.0.1:8099';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local fixture only');
const uid='11111111-1111-4111-8111-111111111111',obj='22222222-2222-4222-8222-222222222222';
async function verify(browser,theme){
 const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});await context.routeWebSocket('**/*',socket=>socket.close());
 const exp=Math.floor(Date.now()/1000)+3600,user={id:uid,aud:'authenticated',user_metadata:{}},token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp,role:'authenticated'})).toString('base64url')+'.fixture';
 const profile={id:uid,account_type:'player',username:'fixture',first_name:'Fixture',last_name:'Player',display_name:'Fixture Player',profile_visibility:'public',avatar_moderation_status:'rejected'};
 const calls=[],errors=[];let rejectMedia=true,rejectAvatar=true;
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();if(url.origin===new URL(base).origin)return route.continue();
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)});
  if(method==='OPTIONS')return json({});calls.push({host:url.hostname,path:url.pathname,method});
  if(url.hostname==='api.test'){
   assert.equal(request.headers().authorization,`Bearer ${token}`);
   if(url.pathname==='/api/mobile/bootstrap')return json({user:{id:uid,displayName:'Fixture Player',accountType:'player'},entitlements:{tier:'free',hasPaidMembership:false,canReadHoopFeed:true,canWriteHoopFeed:true,canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:false}});
   if(url.pathname==='/api/hoopfeed/video-upload'){assert.deepEqual(request.postDataJSON(),{content_type:'video/webm',size:fs.statSync(path.join(__dirname,'fixtures/orange.webm')).size});return json({mode:'private',bucket:'hoopfeed-private-videos',path:`${uid}/${obj}.webm`,token:'fixture-only'});}
   if(url.pathname==='/api/hoopfeed/moderate'){
    const body=request.postDataBuffer();assert.ok(body.length<3100000);const text=body.toString('latin1');
    assert.ok(text.includes('Media fixture caption'));assert.ok(text.includes('name="audience"'));assert.ok(text.includes('community'));
    if(rejectMedia){rejectMedia=false;return json({allowed:false,message:'Fixture safety rejection; media retained.'},400);}
    return json({allowed:true});
   }
   if(url.pathname==='/api/hoopfeed/video-cleanup')return json({removed:true});
  }
  if(url.hostname==='fixture.supabase.co'){
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname.startsWith(`/storage/v1/object/upload/sign/hoopfeed-private-videos/${uid}/`)){assert.equal(method,'PUT');assert.equal(url.searchParams.get('token'),'fixture-only');return json({Key:'private'});}
   if(url.pathname.startsWith(`/storage/v1/object/profile-avatars/${uid}/`)){assert.equal(method,'POST');assert.equal(request.headers().authorization,`Bearer ${token}`);return json({Key:'avatar'});}
   if(url.pathname==='/rest/v1/profiles'){
    assert.equal(url.searchParams.get('id'),`eq.${uid}`);
    if(method==='PATCH'){const body=request.postDataJSON();assert.deepEqual(Object.keys(body),['avatar_url']);assert.equal(request.headers().authorization,`Bearer ${token}`);if(rejectAvatar){rejectAvatar=false;return json({message:'Synthetic profile rejection'},403);}return json([{id:uid,avatar_url:body.avatar_url,avatar_moderation_status:'rejected'}]);}
    return json(request.headers().accept?.includes('vnd.pgrst.object')?profile:[profile]);
   }
   if(url.pathname.startsWith('/rest/v1/'))return json([]);
  }
  throw Error(`Unexpected external media fixture request ${url.origin}${url.pathname}`);
 });
 await context.addInitScript(({token,user,exp})=>{localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:exp,user}));localStorage.setItem('hoopcheck:device-preferences:v1',JSON.stringify({appLock:false,haptics:false,onboardingDone:true}));},{token,user,exp});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 async function pick(button,file){const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:button,exact:true}).click();await (await chooser).setFiles(file);}
 try{
  await page.goto(`${base}/feed`);await page.getByRole('button',{name:'Create HoopFeed post',exact:true}).click();await page.getByRole('button',{name:'Photo or video',exact:true}).click();const caption=page.getByRole('textbox',{name:'Write a HoopFeed post',exact:true});await caption.fill('Media fixture caption');
  await pick('Add photo','/tmp/hoopcheck-fixture-photo.jpg');await page.getByRole('button',{name:'Rotate photo 1',exact:true}).waitFor();await page.getByRole('button',{name:'Rotate photo 1',exact:true}).click();await page.getByRole('button',{name:'Post media',exact:true}).click();await page.getByText('Fixture safety rejection; media retained.',{exact:true}).waitFor();assert.equal(await caption.inputValue(),'Media fixture caption');assert.equal(await page.getByRole('button',{name:'Remove photo 1',exact:true}).count(),1);
  await page.getByRole('button',{name:'Post media',exact:true}).click();await page.getByText('Published after safety checks.',{exact:true}).waitFor();assert.equal(await caption.inputValue(),'');assert.equal(await page.getByRole('button',{name:'Remove photo 1',exact:true}).count(),0);
  await caption.fill('Media fixture caption');await pick('Choose video',path.join(__dirname,'fixtures/orange.webm'));await page.getByText(/Selected video ·/).waitFor();await page.getByRole('button',{name:'Post media',exact:true}).click();await page.getByText('Published after safety checks.',{exact:true}).waitFor();assert.ok(calls.some(c=>c.path.includes('/storage/v1/object/upload/sign/')));
  await page.getByRole('tab',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.getByRole('button',{name:'Choose profile photo',exact:true}).waitFor();await pick('Choose profile photo','/tmp/hoopcheck-fixture-photo.jpg');await page.getByRole('button',{name:'Rotate profile photo',exact:true}).waitFor();await page.getByRole('button',{name:'Rotate profile photo',exact:true}).click();await page.getByRole('button',{name:'Save profile photo',exact:true}).click();await page.getByText(/Profile photo save could not be confirmed/).waitFor();assert.equal(await page.getByRole('button',{name:'Discard selected photo',exact:true}).count(),1);
  await page.getByRole('button',{name:'Save profile photo',exact:true}).click();await page.getByText('Photo saved. Your profile photo remains hidden under the current moderation decision.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Discard selected photo',exact:true}).count(),0);
  assert.deepEqual(errors,[]);await page.screenshot({path:`/tmp/hoopcheck-native-ui/media-${theme}.png`,fullPage:true});console.log(`PASS ${theme}: photo selection/rotation/rejection-retained draft/publish/private video/owned avatar upload/moderation unchanged`);
 }catch(error){console.log(await page.locator('body').innerText());console.log(errors);throw error;}finally{await context.close();}
}
(async()=>{fs.mkdirSync('/tmp/hoopcheck-native-ui',{recursive:true});await require('sharp')({create:{width:1600,height:900,channels:3,background:'#ff790b'}}).jpeg().toFile('/tmp/hoopcheck-fixture-photo.jpg');const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{for(const theme of ['light','dark'])await verify(browser,theme);}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
