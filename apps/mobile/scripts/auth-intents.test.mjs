import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthIntents, guardAuthResponses, bindAuthIntents } from '../../../lib/auth/auth-intents.ts';
import { serializeAuthStorage } from '../../../lib/auth/serialized-storage.ts';
const token=id=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id})).toString('base64url')+'.fixture';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=async()=>{for(let n=0;n<6;n++)await Promise.resolve();};

test('late password, refresh and MFA responses cannot replace a newer sign-in/out intent',async()=>{
 for(const path of ['/auth/v1/token?grant_type=password','/auth/v1/token?grant_type=refresh_token','/auth/v1/factors/11111111-1111-4111-8111-111111111111/verify']){
  const intents=createAuthIntents();intents.begin();const pending=deferred();
  const request=guardAuthResponses('https://fixture.supabase.co',intents,()=>pending.promise);
  const result=request('https://fixture.supabase.co'+path,{method:'POST',headers:{Authorization:`Bearer ${token('user-a')}`}});
  intents.begin();pending.resolve(Response.json({access_token:token('user-a'),user:{id:'user-a'}}));
  assert.equal((await result).status,409);
 }
});
test('MFA response identity mismatch fails closed while a matching owner response reaches the SDK',async()=>{
 for(const owner of ['user-a','user-b']){
  const intents=createAuthIntents();const request=guardAuthResponses('https://fixture.supabase.co',intents,async()=>Response.json({access_token:token(owner),user:{id:owner}}));
  const response=await request('https://fixture.supabase.co/auth/v1/factors/11111111-1111-4111-8111-111111111111/verify',{headers:{Authorization:`Bearer ${token('user-a')}`}});
  assert.equal(response.status,owner==='user-a'?200:409);
 }
});
test('a shared intent store blocks an older tab response and never grants authorization',async()=>{
 let shared='';const store={read:()=>shared,write:value=>{shared=value;}};const first=createAuthIntents(store),second=createAuthIntents(store);first.begin();const pending=deferred();
 const response=guardAuthResponses('https://fixture.supabase.co',first,()=>pending.promise)('https://fixture.supabase.co/auth/v1/token',{method:'POST'});
 second.begin();pending.resolve(Response.json({access_token:'old'}));assert.equal((await response).status,409);
});
test('binding preserves auth method receivers/results and begins an intent before each mutation',async()=>{
 const intents=createAuthIntents();let previous=intents.read();const calls=[];
 const auth=Object.fromEntries(['signInWithPassword','signUp','signOut','setSession','exchangeCodeForSession'].map(name=>[name,function(value){assert.equal(this,auth);assert.notEqual(intents.read(),previous);previous=intents.read();calls.push(name);return value;} ]));
 bindAuthIntents(auth,intents);for(const name of Object.keys(auth))assert.equal(await auth[name]('result'),'result');assert.equal(calls.length,5);
});
test('native credential writes and removals serialize without losing the last committed sign-in',async()=>{
 const blocked=deferred(),calls=[];let saved=null;
 const storage=serializeAuthStorage({getItem:async()=>saved,setItem:async(_,value)=>{calls.push(value);if(value==='old')await blocked.promise;saved=value;},removeItem:async()=>{calls.push('remove');saved=null;}});
 const old=storage.setItem('session','old'),remove=storage.removeItem('session'),current=storage.setItem('session','new');await tick();assert.deepEqual(calls,['old']);
 blocked.resolve();await Promise.all([old,remove,current]);assert.deepEqual(calls,['old','remove','new']);assert.equal(await storage.getItem('session'),'new');
});
test('a failed native write releases the next write and reads wait for the pending mutation',async()=>{
 const blocked=deferred();let saved='committed';
 const storage=serializeAuthStorage({getItem:async()=>saved,setItem:async(_,value)=>{if(value==='failed'){await blocked.promise;throw Error('bridge failure');}saved=value;},removeItem:async()=>{saved=null;}});
 const first=storage.setItem('session','failed');const rejected=assert.rejects(first,/bridge failure/);const second=storage.setItem('session','next');const read=storage.getItem('session');blocked.resolve();await rejected;await second;assert.equal(await read,'next');
});

test('actual Supabase MFA verification cannot overwrite a newer password sign-in',async()=>{
 const {createClient}=await import('@supabase/supabase-js');
 const owner='11111111-1111-4111-8111-111111111111',next='22222222-2222-4222-8222-222222222222',factor='33333333-3333-4333-8333-333333333333';
 const jwt=(id,aal='aal1')=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,aal,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
 const user=id=>({id,aud:'authenticated',email:'fixture@example.test',factors:id===owner?[{id:factor,status:'verified',factor_type:'totp'}]:[]});
 const response=(id,aal='aal1')=>({access_token:jwt(id,aal),refresh_token:`fixture-${id}`,expires_in:3600,token_type:'bearer',user:user(id)});
 const memory=new Map(),intents=createAuthIntents(),pending=deferred(),started=deferred();
 const request=guardAuthResponses('https://fixture.supabase.co',intents,async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==='/auth/v1/user')return Response.json(user(init.headers.Authorization.includes(jwt(owner))?owner:next));
  if(url.pathname.endsWith('/challenge'))return Response.json({id:'44444444-4444-4444-8444-444444444444',expires_at:Math.floor(Date.now()/1000)+60});
  if(url.pathname.endsWith('/verify')){started.resolve();return pending.promise;}
  if(url.pathname==='/auth/v1/token')return Response.json(response(next));
  throw Error('Unexpected Auth fixture request '+url.pathname);
 });
 const client=createClient('https://fixture.supabase.co','fixture-key',{auth:{autoRefreshToken:false,persistSession:true,detectSessionInUrl:false,storage:serializeAuthStorage({getItem:async key=>memory.get(key)??null,setItem:async(key,value)=>{memory.set(key,value);},removeItem:async key=>{memory.delete(key);}})},global:{fetch:request}});
 bindAuthIntents(client.auth,intents);
 assert.equal((await client.auth.setSession({access_token:jwt(owner),refresh_token:'fixture-a'})).error,null);
 const verification=client.auth.mfa.challengeAndVerify({factorId:factor,code:'123456'});await started.promise;
 const signingIn=client.auth.signInWithPassword({email:'fixture-b@example.test',password:'fixture-only'});
 pending.resolve(Response.json(response(owner,'aal2')));assert.ok((await verification).error);
 const signedIn=await signingIn;assert.equal(signedIn.data.user.id,next);
 assert.equal((await client.auth.getSession()).data.session.user.id,next);
});


test('queued older sign-out is skipped when a newer account intent wins before invocation',async()=>{
 const intents=createAuthIntents();const calls=[];const blocked=deferred();
 const auth={signInWithPassword:async value=>{calls.push('sign-in:'+value);if(value==='a')await blocked.promise;return {data:{user:{id:value}},error:null};},signOut:async()=>{calls.push('sign-out');return {error:null};},signUp:async()=>{},setSession:async()=>{},exchangeCodeForSession:async()=>{}};
 bindAuthIntents(auth,intents);
 const a=auth.signInWithPassword('a');await tick();const out=auth.signOut();const b=auth.signInWithPassword('b');blocked.resolve();
 assert.ok((await a).error);assert.ok((await out).error);assert.equal((await b).data.user.id,'b');assert.deepEqual(calls,['sign-in:a','sign-in:b']);
});
test('binding twice cannot add nested locks or invoke a method twice',async()=>{
 const intents=createAuthIntents();let calls=0;const auth={signInWithPassword:async()=>{calls++;return 'ok';},signOut:async()=>{},signUp:async()=>{},setSession:async()=>{},exchangeCodeForSession:async()=>{}};
 bindAuthIntents(auth,intents);bindAuthIntents(auth,intents);assert.equal(await auth.signInWithPassword(), 'ok');assert.equal(calls,1);
});

test('actual Supabase sign-out cannot erase a newer queued password sign-in',async()=>{
 const {createClient}=await import('@supabase/supabase-js');
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
 const jwt=id=>token(id).split('.')[0]+'.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
 const user=id=>({id,aud:'authenticated',email:'fixture@example.test'});
 const pending=deferred(),started=deferred(),memory=new Map(),intents=createAuthIntents();
 const request=guardAuthResponses('https://fixture.supabase.co',intents,async(input)=>{
  const path=new URL(String(input)).pathname;
  if(path==='/auth/v1/user')return Response.json(user(first));
  if(path==='/auth/v1/logout'){started.resolve();return pending.promise;}
  if(path==='/auth/v1/token')return Response.json({access_token:jwt(second),refresh_token:'fixture-b',expires_in:3600,token_type:'bearer',user:user(second)});
  throw Error('Unexpected request '+path);
 });
 const client=createClient('https://fixture.supabase.co','fixture-key',{auth:{autoRefreshToken:false,persistSession:true,detectSessionInUrl:false,storage:serializeAuthStorage({getItem:async key=>memory.get(key)??null,setItem:async(key,value)=>{memory.set(key,value);},removeItem:async key=>{memory.delete(key);}})},global:{fetch:request}});
 bindAuthIntents(client.auth,intents);
 assert.equal((await client.auth.setSession({access_token:jwt(first),refresh_token:'fixture-a'})).error,null);
 const signOut=client.auth.signOut();await started.promise;
 const signIn=client.auth.signInWithPassword({email:'fixture-b@example.test',password:'fixture-only'});
 pending.resolve(new Response(null,{status:204}));assert.ok((await signOut).error);
 assert.equal((await signIn).data.user.id,second);
 assert.equal((await client.auth.getSession()).data.session.user.id,second);
});
