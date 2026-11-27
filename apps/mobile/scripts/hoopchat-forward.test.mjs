import assert from "node:assert/strict";
import {test} from "node:test";
import {createClient} from "@supabase/supabase-js";
import {forwardDraft,forwardDestinations,readForwardDraft} from "../src/native/hoopChatForward.ts";
const uid="11111111-1111-4111-8111-111111111111",peer="22222222-2222-4222-8222-222222222222",other="33333333-3333-4333-8333-333333333333",source="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",destination="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",message="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const threads=[{id:source,requester_id:uid,player_id:peer,status:"accepted"},{id:destination,requester_id:uid,player_id:other,status:"accepted"}];
test("forward draft preserves existing draft, rejects quoted text and filters recipients",()=>{
 assert.equal(forwardDraft("My message",""),"My message");assert.equal(forwardDraft("My message","unsent"),null);assert.equal(forwardDraft("> Private quote",""),null);
 assert.deepEqual(forwardDestinations([...threads,{...threads[1],status:"pending"}],uid,source),[threads[1]]);
});
function fixture({blocked=false,wrongSender=false,wrongIdentity=false}={}){
 const calls=[];
 const db=createClient("https://fixture.supabase.co","key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));calls.push({url,method:init.method,auth:new Headers(init.headers).get("authorization")});
  if(url.pathname.endsWith("/player_contact_requests"))return Response.json(threads);
  if(url.pathname.endsWith("/user_blocks"))return Response.json(blocked?[{blocked_id:other}]:[]);
  if(url.pathname.endsWith("/player_contact_messages"))return Response.json([{id:message,request_id:source,sender_id:wrongSender?peer:uid,body:"My text"}]);
  throw Error("Unexpected request");
 }}});
 db.auth.getSession=async()=>({error:null,data:{session:{user:{id:uid},access_token:"fixture-token"}}});
 db.auth.getUser=async()=>({error:null,data:{user:{id:wrongIdentity?other:uid}}});
 return {db,calls};
}
test("forwarding makes read-only pinned-session requests and rejects blocked or foreign messages",async()=>{
 const signal=new AbortController().signal;
 const run=f=>readForwardDraft(f.db,uid,source,message,destination,signal);
 const ok=fixture();assert.equal(await run(ok),"My text");
 assert.ok(ok.calls.every(x=>x.method==="GET"&&x.auth==="Bearer fixture-token"));
 assert.equal(ok.calls.at(-1).url.searchParams.get("sender_id"),"eq."+uid);
 await assert.rejects(run(fixture({blocked:true})),/unavailable/);
 await assert.rejects(run(fixture({wrongSender:true})),/unavailable/);
 const wrong=fixture({wrongIdentity:true});await assert.rejects(run(wrong),/Verify your account/);assert.equal(wrong.calls.length,0);
});
