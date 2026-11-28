import assert from "node:assert/strict";
import {test} from "node:test";
import {readGroupUnread,markGroupVisibleRead} from "../src/native/hoopGroupsRead.ts";
const id="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
function db(data,error=null){const calls=[];return{calls,client:{rpc:(name,args)=>{calls.push([name,args]);const q={setHeader:(k,v)=>{assert.equal(k,"Authorization");assert.equal(v,"Bearer token");return q;},abortSignal:()=>q,then:(resolve,reject)=>Promise.resolve({data,error}).then(resolve,reject)};return q;}}};}
const signal=()=>new AbortController().signal;
test("server counts only, scoped RPC and explicit observed IDs",async()=>{
 const f=db([{channel_id:id,unread_count:5}]);const counts=await readGroupUnread(f.client,other,"Bearer token",signal());assert.equal(counts[id],5);
 assert.deepEqual(f.calls,[["hoop_group_unread_counts",{p_space:other}]]);
 const g=db(1);await markGroupVisibleRead(g.client,id,[other,other],"Bearer token",signal());
 assert.deepEqual(g.calls,[["mark_hoop_group_posts_read",{p_channel:id,p_posts:[other]}]]);
});
test("invalid, duplicate, cancelled and denied read state cannot appear as zero unread",async()=>{
 for(const data of [[{channel_id:id,unread_count:-1}],[{channel_id:id,unread_count:1},{channel_id:id,unread_count:1}],[{channel_id:"bad",unread_count:1}]]){
  await assert.rejects(readGroupUnread(db(data).client,id,"Bearer token",signal()));
 }
 await assert.rejects(readGroupUnread(db(null,true).client,id,"Bearer token",signal()));
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(markGroupVisibleRead(db(0).client,id,[other],"Bearer token",ctrl.signal));
 await assert.rejects(markGroupVisibleRead(db(2).client,id,[other],"Bearer token",signal()));
});
