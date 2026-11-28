import assert from "node:assert/strict";
import {test} from "node:test";
import {createCallerPersonalReaders,personalSourceFields} from "../lib/server/personal-export-sources.ts";
const owner="11111111-1111-4111-8111-111111111111",foreign="22222222-2222-4222-8222-222222222222";
const id=n=>"33333333-3333-4333-8333-"+String(n).padStart(12,"0");
function fixture(rows){
 const calls=[];
 const db={from:table=>{const q={select:columns=>{calls.push(["select",table,columns]);return q;},eq:(k,v)=>{calls.push(["eq",k,v]);return q;},neq:(k,v)=>{calls.push(["neq",k,v]);return q;},gt:(k,v)=>{calls.push(["gt",k,v]);return q;},order:(k,v)=>{calls.push(["order",k,v]);return q;},limit:v=>{calls.push(["limit",v]);return q;},setHeader:(k,v)=>{calls.push([k,v]);return q;},abortSignal:()=>q,then:(resolve,reject)=>Promise.resolve({data:rows,error:null}).then(resolve,reject)};return q;}};
 return{db,calls};
}
const input=(after=null)=>({ownerId:owner,after,limit:100,signal:new AbortController().signal});
test("caller sources page by immutable ID, omit unapproved notification body and fields",async()=>{
 const f=fixture(Array.from({length:101},(_,i)=>({id:id(i),user_id:owner,notification_type:"review",created_at:"fixture",read_at:null,body:"private third party text"})));
 const readers=createCallerPersonalReaders(f.db,owner,"Bearer token",async()=>true);
 const page=await readers.notifications(input());
 assert.equal(page.rows.length,100);assert.equal(page.hasMore,true);
 assert.deepEqual(Object.keys(page.rows[0].data),personalSourceFields.notifications);
 assert.equal(page.rows[0].data.body,undefined);
 assert.ok(f.calls.some(c=>c[0]==="eq"&&c[1]==="user_id"&&c[2]===owner));
 assert.ok(f.calls.some(c=>c[0]==="Authorization"&&c[1]==="Bearer token"));
 assert.ok(f.calls.some(c=>c[0]==="limit"&&c[1]===101));
});
test("story and ordinary feed separation, only authored records, no review ACL bypass",async()=>{
 const f=fixture([]),readers=createCallerPersonalReaders(f.db,owner,"Bearer token",async()=>true);
 await readers.stories(input(id(1)));await readers.feed_posts(input());await readers.messages(input());
 assert.ok(f.calls.some(c=>c[0]==="eq"&&c[1]==="post_kind"&&c[2]==="story"));
 assert.ok(f.calls.some(c=>c[0]==="neq"&&c[1]==="post_kind"&&c[2]==="story"));
 assert.ok(f.calls.some(c=>c[0]==="eq"&&c[1]==="sender_id"&&c[2]===owner));
 assert.ok(f.calls.some(c=>c[0]==="gt"&&c[1]==="id"&&c[2]===id(1)));
 assert.equal(readers.reviews,undefined);
});
test("reject cross-account row, nonadvancing cursor, malformed projection and revoked scope",async()=>{
 const row={id:id(1),author_id:owner,body:"fixture",created_at:"fixture",channel_id:id(2)};
 for(const rows of [[{...row,author_id:foreign}],[row,row],[{...row,body:{secret:"never"}}]]){
  const f=fixture(rows);await assert.rejects(createCallerPersonalReaders(f.db,owner,"Bearer token",async()=>true).groups(input()));
 }
 const f=fixture([row]);let checks=0;
 await assert.rejects(createCallerPersonalReaders(f.db,owner,"Bearer token",async()=>++checks===1).groups(input()),/caller unavailable/);
 await assert.rejects(createCallerPersonalReaders(f.db,owner,"Bearer token",async()=>true).groups({...input(),ownerId:foreign}),/caller unavailable/);
});
