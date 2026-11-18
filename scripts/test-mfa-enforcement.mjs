import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function compile(path,imports=require){const compiled={exports:{}};const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',js)(imports,compiled.exports,compiled);return compiled.exports;}
const core=compile('../lib/auth/mfa-core.ts');
const enforcement=compile('../lib/server/mfa-enforcement.ts',name=>name==='../auth/mfa-core'?core:require(name));
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
test('second-factor verification never bypasses existing pending-signup restrictions',async()=>{
 const f=fixture({aal:'aal2'});const response=await f.handler(new NextRequest('https://fixture.test/api/account/delete',{headers:{authorization:`Bearer ${token('aal2','pending_google_signup')}`}}));assert.equal(response.status,403);assert.equal(f.counts().verified,0);
});

function workspaceSession(client){return compile('../lib/ambassador/server.ts',name=>{
 if(name==='../auth/mfa-core')return core;
 if(name==='../server/supabase-auth')return{createAuthClient:async()=>client};
 if(name==='./identifiers')return{uuidPattern:/^[0-9a-f-]{36}$/};
 if(name==='next/navigation')return{redirect:path=>{throw Error('redirect:'+path);},notFound:()=>{throw Error('not-found');}};
 return require(name);
}).requireAmbassadorSession;}
test('Owner HQ enforces MFA again before any privileged workspace/owner query',async()=>{
 const f=fixture();let checkedOwner=false;f.client.rpc=async()=>{checkedOwner=true;return{data:true,error:null};};
 await assert.rejects(workspaceSession(f.client)('/owner-hq',true),/redirect:\/auth\/verify/);assert.equal(checkedOwner,false);
});
test('AAL2 does not grant the owner role',async()=>{
 const f=fixture({aal:'aal2'});f.client.rpc=async()=>({data:false,error:null});await assert.rejects(workspaceSession(f.client)('/owner-hq',true),/not-found/);
});
