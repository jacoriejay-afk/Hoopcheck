import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { getOwnProfile } from '../../../lib/auth/own-profile.ts';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function fixture(request){
 const client=createClient('https://fixture.supabase.co','public-fixture',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:request}});
 client.auth.getSession=async()=>({data:{session:{user:{id:owner},access_token:'captured-owner-token'}},error:null});
 return client;
}
test('private profile RPC uses the captured JWT and no client-selected target ID',async()=>{
 let calls=0;
 const client=fixture(async(input,options)=>{calls++;const url=new URL(String(input));assert.equal(url.pathname,'/rest/v1/rpc/get_own_profile');assert.equal(url.search,'');assert.deepEqual(JSON.parse(options.body),{});assert.equal(new Headers(options.headers).get('Authorization'),'Bearer captured-owner-token');return Response.json({id:owner,current_country:'Own private country'});});
 assert.equal((await getOwnProfile(client,owner)).data.current_country,'Own private country');assert.equal(calls,1);
});
test('signed-out, switched and malformed owners cannot initiate a private read',async()=>{
 let requests=0;const client=fixture(async()=>{requests++;return Response.json({id:owner});});
 for(const identity of [null,{user:{id:other},access_token:'other-token'}]){
  client.auth.getSession=async()=>({data:{session:identity},error:null});
  assert.ok((await getOwnProfile(client,owner)).error);
 }
 assert.ok((await getOwnProfile(client,'forged')).error);assert.equal(requests,0);
});
test('account switch while the response is in flight cannot display the old private row',async()=>{
 const client=fixture(async()=>{client.auth.getSession=async()=>({data:{session:{user:{id:other},access_token:'new-owner-token'}},error:null});return Response.json({id:owner,moderation_note:'private'});});
 const result=await getOwnProfile(client,owner);assert.equal(result.data,null);assert.match(result.error.message,/account changed/i);
});
test('cross-owner, missing, array and malformed RPC responses fail closed',async()=>{
 for(const payload of [{id:other},null,[],{id:'not-a-uuid'},'private']){
  const result=await getOwnProfile(fixture(async()=>Response.json(payload)),owner);
  if(payload?.id===owner){assert.equal(result.error,null);}else{assert.equal(result.data,null);assert.ok(result.error);}
 }
});
test('permission, unavailable schema and transport errors never fall back to the raw table',async()=>{
 for(const status of [401,403,404,503]){
  let calls=0;const result=await getOwnProfile(fixture(async input=>{calls++;assert.ok(String(input).endsWith('/rpc/get_own_profile'));return Response.json({message:'fixture denial'},{status});}),owner);
  assert.equal(result.data,null);assert.ok(result.error);assert.equal(calls,1);
 }
 const result=await getOwnProfile(fixture(async()=>{throw Error('fixture network failure');}),owner);assert.equal(result.data,null);assert.ok(result.error);
});

test('same-owner replacement credentials invalidate an in-flight private response',async()=>{
 const client=fixture(async()=>{client.auth.getSession=async()=>({data:{session:{user:{id:owner},access_token:'replacement-token'}},error:null});return Response.json({id:owner});});
 const result=await getOwnProfile(client,owner);assert.equal(result.data,null);assert.ok(result.error);
});
test('a hung session read has bounded recovery without requesting private data',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 try{let requests=0;const client=fixture(async()=>{requests++;return Response.json({id:owner});});client.auth.getSession=()=>new Promise(()=>{});const work=getOwnProfile(client,owner);await Promise.resolve();t.mock.timers.tick(15001);const result=await work;assert.equal(result.data,null);assert.ok(result.error);assert.equal(requests,0);}finally{t.mock.timers.reset();}
});

test('missing RPC may use only the protected HTTPS compatibility route with fixed owner token',async()=>{
 let calls=0;const client=fixture(async()=>Response.json({code:'PGRST202',message:'Missing function'},{status:404}));
 const result=await getOwnProfile(client,owner,{origin:'https://api.test',request:async(url,options)=>{
  calls++;assert.equal(url,'https://api.test/api/mobile/own-profile');assert.equal(options.headers.Authorization,'Bearer captured-owner-token');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  return Response.json({owner,profile:{id:owner,current_country:'Own private country'}});
 }});
 assert.equal(calls,1);assert.equal(result.data.current_country,'Own private country');
});
test('compatibility never recovers denied RPC or foreign profile, and rejects changed sessions',async()=>{
 for(const code of ['42501','57014','PGRST301']){
  let calls=0;const client=fixture(async()=>Response.json({code,message:'Denied'},{status:403}));
  const result=await getOwnProfile(client,owner,{origin:'https://api.test',request:async()=>{calls++;return Response.json({owner,profile:{id:owner}});}});
  assert.ok(result.error);assert.equal(calls,0);
 }
 for(const payload of [{owner:other,profile:{id:owner}},{owner,profile:{id:other}}]){
  const client=fixture(async()=>Response.json({code:'PGRST202',message:'Missing'},{status:404}));
  assert.ok((await getOwnProfile(client,owner,{origin:'https://api.test',request:async()=>Response.json(payload)})).error);
 }
 const client=fixture(async()=>Response.json({code:'PGRST202',message:'Missing'},{status:404}));
 const result=await getOwnProfile(client,owner,{origin:'https://api.test',request:async()=>{
  client.auth.getSession=async()=>({data:{session:{user:{id:other},access_token:'changed-token'}},error:null});
  return Response.json({owner,profile:{id:owner}});
 }});
 assert.equal(result.data,null);assert.ok(result.error);
});
