import assert from "node:assert/strict";
import {test} from "node:test";
import {createClient} from "@supabase/supabase-js";
import {appendConversationPage,matchesConversationSearch,readConversationPage} from "../src/native/hoopChatHistory.ts";
const req="11111111-1111-4111-8111-111111111111";
const id="22222222-2222-4222-8222-222222222222";
const row={id,request_id:req,sender_id:id,body:"hello",created_at:"2026-11-25T00:00:00.123456+00:00"};
test("conversation pages remain scoped to a single request with stable validated cursor",async()=>{
 const calls=[];const db=createClient("https://fixture.supabase.co","key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{calls.push(new URL(String(input)));return Response.json([row,{...row,request_id:"other"}]);}}});
 const signal=new AbortController().signal;
 assert.deepEqual(await readConversationPage(db,req,signal),[row]);
 assert.deepEqual(await readConversationPage(db,req,signal,row),[row]);
 assert.equal(calls[1].searchParams.get("request_id"),"eq."+req);
 assert.equal(calls[1].searchParams.get("limit"),"50");
 assert.equal(calls[1].searchParams.get("order"),"created_at.desc,id.desc");
 assert.equal(calls[1].searchParams.get("or"),`(created_at.lt.${row.created_at},and(created_at.eq.${row.created_at},id.lt.${id}))`);
 await assert.rejects(readConversationPage(db,"bad",signal));
 await assert.rejects(readConversationPage(db,req,signal,{...row,created_at:"2026-11-25T00:00:00Z),id.gt.0"}));
 assert.equal(calls.length,2);
});
test("older pages deduplicate and keep newest-first sequence",()=>{
 const older={...row,id:"33333333-3333-4333-8333-333333333333"};
 assert.deepEqual(appendConversationPage([row],[row,older,older]),[row,older]);
});
test("inbox search matches names and handles, not private message bodies",()=>{
 assert.ok(matchesConversationSearch("  jo ","Jordan","jhoops"));
 assert.ok(matchesConversationSearch("@JH","Jordan","jhoops"));
 assert.ok(matchesConversationSearch("","Jordan",null));
 assert.equal(matchesConversationSearch("hello","Jordan","jhoops"),false);
});
