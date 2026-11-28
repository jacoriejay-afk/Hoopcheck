import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { setGroupMembership } from "../src/native/groupMembership.ts";

const uid="11111111-1111-4111-8111-111111111111",space="22222222-2222-4222-8222-222222222222",other="33333333-3333-4333-8333-333333333333";
function fixture(options={}){
  const calls=[],controller=new AbortController();
  let present=options.present??false,proofs=0;
  const client=createClient("https://fixture.supabase.co","fixture",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    const url=new URL(String(input));const method=init.method??"GET";
    calls.push({url,method,authorization:new Headers(init.headers).get("Authorization")});
    if(url.pathname.endsWith("/confirm_active_account_session"))return Response.json(!(options.inactive||(options.revoked&&++proofs===2)));
    assert.ok(url.pathname.endsWith("/hoop_group_members"));
    if(method==="POST"){
      assert.deepEqual(JSON.parse(init.body),{space_id:space,user_id:uid});
      if(!options.noWrite)present=true;
      if(options.duplicate)return Response.json({code:"23505",message:"duplicate"},{status:409});
      return new Response(null,{status:201});
    }
    if(method==="DELETE"){
      assert.equal(url.searchParams.get("space_id"),"eq."+space);assert.equal(url.searchParams.get("user_id"),"eq."+uid);
      if(!options.noWrite)present=false;return new Response(null,{status:204});
    }
    assert.equal(url.searchParams.get("space_id"),"eq."+space);assert.equal(url.searchParams.get("user_id"),"eq."+uid);
    if(options.cancelRead)controller.abort();
    return Response.json(present?[{space_id:space,user_id:options.foreign?other:uid}]:[]);
  }}});
  client.auth.getSession=async()=>({error:null,data:{session:{user:{id:uid},access_token:"fixture-token"}}});
  client.auth.getUser=async()=>({error:null,data:{user:{id:options.wrongUser?other:uid}}});
  return {client,calls,controller};
}
test("join and leave confirm current caller's exact membership",async()=>{
  const f=fixture();
  assert.deepEqual(await setGroupMembership(f.client,uid,space,true,f.controller.signal),{spaceId:space,joined:true});
  assert.deepEqual(await setGroupMembership(f.client,uid,space,false,f.controller.signal),{spaceId:space,joined:false});
  assert.ok(f.calls.every(c=>c.authorization==="Bearer fixture-token"));
  assert.equal(f.calls.filter(c=>c.method==="GET").length,2);
  const d=fixture({duplicate:true,present:true});
  assert.deepEqual(await setGroupMembership(d.client,uid,space,true,d.controller.signal),{spaceId:space,joined:true});
});
test("missing, foreign or still-present rows, cancelled requests and revoked callers do not confirm membership",async()=>{
  for(const [opts,join] of [[{noWrite:true},true],[{noWrite:true,present:true},false],[{foreign:true},true],[{cancelRead:true},true],[{revoked:true},true]]){
    const f=fixture(opts);await assert.rejects(setGroupMembership(f.client,uid,space,join,f.controller.signal));
  }
  for(const opts of [{wrongUser:true},{inactive:true}]){
    const f=fixture(opts);await assert.rejects(setGroupMembership(f.client,uid,space,true,f.controller.signal));
    assert.ok(!f.calls.some(c=>c.url.pathname.endsWith("/hoop_group_members")));
  }
});
