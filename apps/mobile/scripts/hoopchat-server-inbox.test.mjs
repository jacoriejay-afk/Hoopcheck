import {test} from "node:test";
import assert from "node:assert/strict";
import {readServerInbox,readAllUnread} from "../src/native/hoopChatServerInbox.ts";
const viewer="11111111-1111-4111-8111-111111111111",peer="22222222-2222-4222-8222-222222222222",foreign="33333333-3333-4333-8333-333333333333";
const row=i=>({id:"aaaaaaaa-aaaa-4aaa-8aaa-"+String(i).padStart(12,"0"),requester_id:viewer,player_id:peer,status:"accepted",message:null,created_at:"2026-11-28T00:00:00.123456+00:00"});
function mock(data,owner=viewer){const calls=[];const client={rpc(name,args){calls.push({name,args});return {setHeader(k,v){assert.equal(k,"Authorization");assert.equal(v,"Bearer token");return this;},async abortSignal(){return {data,error:null};}};},auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:"token"}},error:null})}};return {client,calls};}
test("server inbox accepts cursor past initial 500 rows and preserves timestamp precision",async()=>{
 const rows=Array.from({length:100},(_,i)=>row(100-i)),cursor=row(101),f=mock({rows,has_more:true}),s=new AbortController().signal;
 const page=await readServerInbox(f.client,viewer,"Bearer token",s,"old message","all",cursor,new Set());
 assert.equal(page.rows.length,100);assert.deepEqual(page.next,{id:row(1).id,created_at:row(1).created_at});
 assert.deepEqual(f.calls[0],{name:"hoopchat_inbox_page",args:{p_query:"old message",p_mode:"all",p_before_at:cursor.created_at,p_before_id:cursor.id}});
 assert.equal((await readServerInbox(f.client,viewer,"Bearer token",s,"","all",cursor,new Set([peer]))).rows.length,0);
});
test("server page rejects foreign/duplicate data, account switches and false cursors",async()=>{
 const s=new AbortController().signal,call=f=>readServerInbox(f.client,viewer,"Bearer token",s,"","all",null,new Set());
 for(const data of [{rows:[{...row(1),requester_id:foreign}],has_more:false},{rows:[row(1),row(1)],has_more:false},{rows:[],has_more:true}])await assert.rejects(call(mock(data)));
 await assert.rejects(call(mock({rows:[row(1)],has_more:false},foreign)));
 assert.equal(await readAllUnread(mock(1042).client,"Bearer token",s),1042);
 await assert.rejects(readAllUnread(mock(-1).client,"Bearer token",s));
});
