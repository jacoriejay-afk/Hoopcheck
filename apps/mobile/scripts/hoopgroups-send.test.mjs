import {test} from "node:test";
import assert from "node:assert/strict";
import {prepareGroupSend,submitGroupSend} from "../src/native/hoopGroupsSend.ts";
const owner="11111111-1111-4111-8111-111111111111",channel="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333";
const message=prepareGroupSend(null,owner,channel," hello ",()=>id);
function fixture(){
 let stored=null,insertions=0,deny=false,lose=false;
 const db={from:table=>{
  assert.equal(table,"hoop_group_posts");let mode="read",body;
  const filters={};
  const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},setHeader:(k,v)=>{assert.equal(k,"Authorization");assert.equal(v,"Bearer token");return q;},abortSignal:()=>q,
  maybeSingle:async()=>{assert.deepEqual(filters,{id,author_id:owner,channel_id:channel});return deny?{error:true}:{data:stored,error:null};},
  insert:value=>{mode="insert";body=value;return q;},then:(resolve,reject)=>{assert.equal(mode,"insert");insertions++;if(!stored)stored=body;if(lose){lose=false;return Promise.reject(Error("network")).then(resolve,reject);}return Promise.resolve({error:null}).then(resolve,reject);}};
  return q;
 }};
 return{db,count:()=>insertions,deny:()=>{deny=true;},lose:()=>{lose=true;},replace:v=>{stored=v;}};
}
const signal=()=>new AbortController().signal;
test("same scoped draft keeps its cryptographic ID; changed draft cannot reuse it",()=>{
 assert.equal(prepareGroupSend(message,owner,channel,"hello",()=>assert.fail()),message);
 assert.notEqual(prepareGroupSend(message,owner,channel,"changed",()=>owner),message);
 assert.throws(()=>prepareGroupSend(null,"bad",channel,"hello",()=>id));
});
test("retry after an interrupted insert reconciles existing primary key without a second insert",async()=>{
 const f=fixture();f.lose();
 await assert.rejects(submitGroupSend(f.db,message,"Bearer token",signal()),/network/);
 await submitGroupSend(f.db,message,"Bearer token",signal());
 assert.equal(f.count(),1);
});
test("denied read or mismatched row cannot acknowledge or submit",async()=>{
 const f=fixture();f.deny();await assert.rejects(submitGroupSend(f.db,message,"Bearer token",signal()));assert.equal(f.count(),0);
 const g=fixture();g.replace({id,channel_id:channel,author_id:owner,body:"different",moderation_status:"approved"});
 await assert.rejects(submitGroupSend(g.db,message,"Bearer token",signal()),/identity mismatch/);assert.equal(g.count(),0);
 const abort=new AbortController();abort.abort();await assert.rejects(submitGroupSend(g.db,message,"Bearer token",abort.signal));assert.equal(g.count(),0);
});
