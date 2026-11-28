import assert from "node:assert/strict";
import {test} from "node:test";
import {removeApprovedPrivateRows} from "../lib/server/account-deletion-private-rows.ts";
const lease={requestId:"11111111-1111-4111-8111-111111111111",ownerId:"22222222-2222-4222-8222-222222222222",fence:"33333333-3333-4333-8333-333333333333",policyVersion:"approved-test"};
const plan={requestId:lease.requestId,ownerId:lease.ownerId,policyVersion:lease.policyVersion,categories:["notifications","saved_feed","archived_feed","group_memberships"]};
function fixture(){
 const calls=[],remaining=new Map([["notifications",2],["feed_post_bookmarks",1],["feed_post_archives",3],["hoop_group_members",1]]);
 let failTable=null,uncertain=false;
 const admin={from:table=>{let action="read";const q={delete:()=>{action="delete";return q;},select:(column,options)=>{assert.equal(column,"user_id");assert.deepEqual(options,{count:"exact",head:true});return q;},eq:async(column,owner)=>{assert.equal(column,"user_id");assert.equal(owner,lease.ownerId);calls.push([action,table,owner]);if(action==="delete"){if(table===failTable)return{error:true};if(!uncertain)remaining.set(table,0);return{error:null};}return{error:null,count:remaining.get(table)};}};return q;}};
 const guards={assertLease:async()=>{},assertFrozen:async()=>{},assertApprovedCategory:async()=>{}};
 return{admin,guards,calls,fail:table=>{failTable=table;},uncertain:()=>{uncertain=true;}};
}
test("actual private cleanup uses fixed ownership predicates and verifies zero remaining rows; retry is idempotent",async()=>{
 const f=fixture();assert.equal((await removeApprovedPrivateRows(f.admin,lease,plan,f.guards)).confirmed,true);
 assert.equal((await removeApprovedPrivateRows(f.admin,lease,plan,f.guards)).confirmed,true);
 assert.equal(f.calls.length,16);assert.ok(f.calls.every(c=>c[2]===lease.ownerId));
});
test("unapproved retention category or foreign plan never dispatches destructive effects",async()=>{
 const f=fixture();
 for(const bad of [{...plan,ownerId:lease.fence},{...plan,categories:["reviews"]},{...plan,categories:["notifications","notifications"]}])await assert.rejects(removeApprovedPrivateRows(f.admin,lease,bad,f.guards));
 f.guards.assertApprovedCategory=async(l,c)=>{if(c==="group_memberships")throw Error("retention not approved");};
 await assert.rejects(removeApprovedPrivateRows(f.admin,lease,plan,f.guards),/retention not approved/);assert.deepEqual(f.calls,[]);
});
test("partial failure stops later effects, retry rechecks previous work, ambiguous absence never completes",async()=>{
 const f=fixture();f.fail("feed_post_bookmarks");
 await assert.rejects(removeApprovedPrivateRows(f.admin,lease,plan,f.guards),/not confirmed/);
 assert.ok(!f.calls.some(c=>c[1]==="hoop_group_members"));
 f.fail(null);assert.equal((await removeApprovedPrivateRows(f.admin,lease,plan,f.guards)).confirmed,true);
 const g=fixture();g.uncertain();await assert.rejects(removeApprovedPrivateRows(g.admin,lease,plan,g.guards),/rows remain/);
 assert.ok(!g.calls.some(c=>c[1]==="feed_post_bookmarks"));
});
