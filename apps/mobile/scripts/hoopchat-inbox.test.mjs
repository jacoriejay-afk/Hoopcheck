import {test} from "node:test";
import assert from "node:assert/strict";
import {readChatInbox,chatInboxBatches,CHAT_INBOX_MAX_PAGES} from "../src/native/hoopChatInbox.ts";
const uid="11111111-1111-4111-8111-111111111111",peer="22222222-2222-4222-8222-222222222222",foreign="33333333-3333-4333-8333-333333333333";
const id=i=>"aaaaaaaa-aaaa-4aaa-8aaa-"+String(i).padStart(12,"0");
const row=i=>({id:id(i),requester_id:uid,player_id:peer,status:"accepted",message:null,created_at:"2026-11-28T00:00:00.123456Z"});
function mock(pages,session=uid){const calls=[];let page=0;const client={from(){const q={select(){return q;},or(s){calls.push(s);return q;},order(){return q;},limit(n){assert.equal(n,100);return q;},setHeader(){return q;},async abortSignal(){return {data:pages[page++]||[],error:null};}};return q;},auth:{getSession:async()=>({data:{session:{user:{id:session},access_token:"token"}},error:null})}};return {client,calls};}
test("stable inbox pagination keeps microsecond cursor and filters blocked rows after paging",async()=>{
 const first=Array.from({length:100},(_,i)=>row(200-i)),older=[{...row(1),player_id:foreign}],{client,calls}=mock([first,older]);
 const result=await readChatInbox(client,uid,"Bearer token",new AbortController().signal,2,new Set([peer]));
 assert.deepEqual(result.rows,older);assert.equal(result.hasMore,false);assert.ok(calls.some(c=>c.includes("created_at.lt.2026-11-28T00:00:00.123456Z")&&c.includes(id(101))));
 assert.deepEqual(chatInboxBatches(Array.from({length:201},(_,i)=>i)).map(x=>x.length),[100,100,1]);
});
test("reject duplicate cursor rows, foreign rows and switched session",async()=>{
 const first=Array.from({length:100},(_,i)=>row(200-i)),signal=new AbortController().signal;
 await assert.rejects(readChatInbox(mock([first,[first[99]]]).client,uid,"Bearer token",signal,2,new Set()));
 await assert.rejects(readChatInbox(mock([[{...row(1),requester_id:foreign}]]).client,uid,"Bearer token",signal,1,new Set()));
 await assert.rejects(readChatInbox(mock([[row(1)]],foreign).client,uid,"Bearer token",signal,1,new Set()));
 await assert.rejects(readChatInbox(mock([]).client,uid,"Bearer token",signal,CHAT_INBOX_MAX_PAGES+1,new Set()));
});
