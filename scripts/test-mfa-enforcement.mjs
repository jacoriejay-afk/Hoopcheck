import assert from 'node:assert/strict';
import test, {after} from 'node:test';
// This suite exercises enforcement even when the parent CI browser job uses
// its separately guarded synthetic-session mode.
const visualMode=process.env.HOOPCHECK_THEME_TEST_MODE;
process.env.HOOPCHECK_THEME_TEST_MODE='false';
after(()=>{if(visualMode===undefined)delete process.env.HOOPCHECK_THEME_TEST_MODE;else process.env.HOOPCHECK_THEME_TEST_MODE=visualMode;});
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function compile(path,imports=require){const compiled={exports:{}};const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',js)(imports,compiled.exports,compiled);return compiled.exports;}
const core=compile('../lib/auth/mfa-core.ts');
const enforcement=compile('../lib/server/mfa-enforcement.ts',name=>name==='../auth/mfa-core'?core:require(name));
const workspaceAccess=compile('../lib/ambassador/session-access.ts');
test("web privacy requests pin the verified bearer and recheck the account before publishing", () => {
 const page = readFileSync(new URL("../app/privacy-center/page.tsx",import.meta.url),"utf8");
 assert.match(page,/getUser\(token\)/);
 assert.match(page,/\.eq\("requester_id", owner\)[\s\S]*?\.setHeader\("Authorization", "Bearer " \+ token\)/);
 assert.match(page,/requester_id: userId,[\s\S]*?\.setHeader\("Authorization", "Bearer " \+ token\)/);
 assert.match(page,/current\.current = \{ owner, generation: current\.current\.generation \+ 1 \}/);
 assert.match(page,/await verifiedPrivacyToken\(userId\);\s*if \(current\.current !== scope\) return;\s*setMessage/);
});
const {NextRequest}=require('next/server');
const owner='11111111-1111-4111-8111-111111111111',factor='22222222-2222-4222-8222-222222222222';
const token=(aal='aal1',role='authenticated')=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:owner,aal,role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
function fixture({aal='aal1',enrolled=true,invalid=false}={}){
 const credential=token(aal);let verified=0,tableReads=0;
 const client={auth:{getUser:async captured=>{assert.equal(captured,credential);verified++;return invalid?{data:{user:null},error:Error('invalid signature')}:{data:{user:{id:owner,email_confirmed_at:'2026-01-01T00:00:00Z',factors:enrolled?[{id:factor,factor_type:'totp',status:'verified'}]:[]}},error:null};},getSession:async()=>({data:{session:{access_token:credential}}}),getClaims:async()=>({data:{claims:{sub:owner,role:'authenticated'}}})},from:()=>{tableReads++;return{select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})};}};
 const handler=compile('../proxy.ts',name=>{
  if(name==='@supabase/ssr')return{createServerClient:()=>client};
  if(name==='@supabase/supabase-js')return{createClient:()=>client};
  if(name==='./lib/server/mfa-enforcement')return enforcement;
  if(name==='./lib/google-auth')return{GOOGLE_SIGNUP_COOKIE:'hoopcheck-google-setup',GOOGLE_SIGNUP_PATH:'/signup/google',GOOGLE_SIGNUP_ROLE:'pending_google_signup'};
  return require(name);
 }).proxy;
 return{handler,client,credential,counts:()=>({verified,tableReads})};
}
// Synthetic credentials never reach a service; the stub represents Auth's
// cryptographic/revocation check, rather than treating JWT decoding as proof.
test('opted-in AAL1 API calls are denied before privileged handlers',async()=>{
 const f=fixture();const response=await f.handler(new NextRequest('https://fixture.test/api/account/delete',{headers:{authorization:`Bearer ${f.credential}`}}));
 assert.equal(response.status,403);assert.equal((await response.json()).code,'mfa_required');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(f.counts(),{verified:1,tableReads:0});
});
test('AAL2 and non-enrolled AAL1 continue without changing existing route permissions',async()=>{
 for(const options of [{aal:'aal2'},{enrolled:false}]){const f=fixture(options);const response=await f.handler(new NextRequest('https://fixture.test/api/mobile/bootstrap',{headers:{authorization:`Bearer ${f.credential}`}}));assert.equal(response.headers.get('x-middleware-next'),'1');assert.equal(f.counts().verified,1);}
});
test('unverified credentials cannot assert their own AAL2 assurance',async()=>{
 const f=fixture({aal:'aal2',invalid:true});const response=await f.handler(new NextRequest('https://fixture.test/api/account/delete',{headers:{authorization:`Bearer ${f.credential}`}}));assert.equal(response.status,401);assert.equal((await response.json()).code,'session_unverified');
});
test('public webhooks do not acquire user sessions and keep their own signature checks',async()=>{
 const f=fixture();const response=await f.handler(new NextRequest('https://fixture.test/api/stripe/webhook'));assert.equal(response.headers.get('x-middleware-next'),'1');assert.equal(f.counts().verified,0);
});
test('SSR cookie API sessions require the same challenge',async()=>{
 const f=fixture();const response=await f.handler(new NextRequest('https://fixture.test/api/account/delete',{headers:{cookie:'sb-fixture-auth-token=fixture'}}));assert.equal(response.status,403);assert.equal((await response.json()).code,'mfa_required');
});
test('protected SSR pages redirect to challenge before private profile reads',async()=>{
 const f=fixture();const response=await f.handler(new NextRequest('https://fixture.test/account/security?tab=devices',{headers:{cookie:'sb-fixture-auth-token=fixture'}}));const target=new URL(response.headers.get('location'));assert.equal(target.pathname,'/auth/verify');assert.equal(target.searchParams.get('returnTo'),'/account/security?tab=devices');assert.equal(f.counts().tableReads,0);
});
test('the full HoopChat inbox requires sign-in and the existing MFA assurance', async () => {
 const path = '/messages?thread=fixture';
 const guest = fixture();
 guest.client.auth.getClaims = async () => ({ data: null });
 const guestResponse = await guest.handler(new NextRequest(`https://fixture.test${path}`));
 const login = new URL(guestResponse.headers.get('location'));
 assert.equal(login.pathname, '/login');
 assert.equal(login.searchParams.get('returnTo'), path);
 const enrolled = fixture();
 const enrolledResponse = await enrolled.handler(new NextRequest(`https://fixture.test${path}`));
 const challenge = new URL(enrolledResponse.headers.get('location'));
 assert.equal(challenge.pathname, '/auth/verify');
 assert.equal(challenge.searchParams.get('returnTo'), path);
 assert.equal(enrolled.counts().tableReads, 0);
 const verified = fixture({aal:'aal2'});
 const verifiedResponse = await verified.handler(new NextRequest(`https://fixture.test${path}`));
 assert.equal(verifiedResponse.headers.get('x-middleware-next'), '1');
});
test('second-factor verification never bypasses existing pending-signup restrictions',async()=>{
 const f=fixture({aal:'aal2'});const response=await f.handler(new NextRequest('https://fixture.test/api/account/delete',{headers:{authorization:`Bearer ${token('aal2','pending_google_signup')}`}}));assert.equal(response.status,403);assert.equal(f.counts().verified,0);
});

function workspaceSession(client){return compile('../lib/ambassador/server.ts',name=>{
 if(name==='../auth/mfa-core')return core;
 if(name==='../server/supabase-auth')return{createAuthClient:async()=>client};
 if(name==='./session-access')return workspaceAccess;
 if(name==='./identifiers')return{uuidPattern:/^[0-9a-f-]{36}$/};
 if(name==='next/navigation')return{redirect:path=>{throw Error('redirect:'+path);},notFound:()=>{throw Error('not-found');}};
 return require(name);
}).requireAmbassadorSession;}
test('Owner HQ enforces MFA again before any privileged workspace/owner query',async()=>{
 const f=fixture();let checkedOwner=false;f.client.rpc=async()=>{checkedOwner=true;return{data:true,error:null};};
 await assert.rejects(workspaceSession(f.client)('/owner-hq',true),/redirect:\/auth\/verify/);assert.equal(checkedOwner,false);
});
test('Owner and Ambassador HQ deny revoked, suspended and unverifiable accounts',async()=>{
 for (const {active,moderation,error} of [
  {active:false,moderation:'normal'},
  {active:true,moderation:'suspended'},
  {active:true,moderation:'normal',error:Error('unverified')},
 ]) {
  const f=fixture({aal:'aal2'});
  f.client.rpc=async name=>{assert.equal(name,'confirm_active_account_session');return {data:active,error};};
  f.client.from=table=>{
   assert.equal(table,'profiles');
   return {select:()=>({eq:(key,id)=>{
    assert.equal(key,'id');assert.equal(id,owner);
    return {maybeSingle:async()=>({data:{moderation_status:moderation}})};
   }})};
  };
  for (const [path,ownerOnly] of [['/ambassador-hq',false],['/owner-hq',true]]) {
   await assert.rejects(workspaceSession(f.client)(path,ownerOnly),/not-found/);
  }
 }
});

test('AAL2 does not grant the owner role',async()=>{
 const f=fixture({aal:'aal2'});f.client.rpc=async()=>({data:false,error:null});await assert.rejects(workspaceSession(f.client)('/owner-hq',true),/not-found/);
});
