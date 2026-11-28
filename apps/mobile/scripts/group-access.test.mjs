import {test} from "node:test";
import assert from "node:assert/strict";
import {decodeGroupAccessSnapshot,readGroupAccess,mutateGroupAccess,readGroupMemberPage} from "../src/native/groupAccess.ts";
const uid="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",space="33333333-3333-4333-8333-333333333333";
const empty={space_id:space,is_owner:false,can_moderate:false,members:[],contacts:[],private_channels:[],banned:[],invitations:[],pending_invites:[],queue:[]};
test("private group snapshot rejects mismatched group, unauthorized member data, and malformed rows",()=>{
 assert.deepEqual(decodeGroupAccessSnapshot(empty,space),empty);
 assert.throws(()=>decodeGroupAccessSnapshot(empty,other));
 assert.throws(()=>decodeGroupAccessSnapshot({...empty,members:[{user_id:other,name:"Test",role:"member",channels:[]}]},space));
 assert.throws(()=>decodeGroupAccessSnapshot({...empty,invitations:[{id:"bad",group_name:"Group",expires_at:"2026-12-01"}]},space));
 assert.throws(()=>decodeGroupAccessSnapshot({...empty,is_owner:true,can_moderate:false},space));
});
function mock(data,change=false){const calls=[];let reads=0;return {calls,client:{auth:{getSession:async()=>({data:{session:{user:{id:change&&reads++>1?other:uid},access_token:"fixture"}},error:null}),getUser:async()=>({data:{user:{id:uid}},error:null})},rpc(name,args){calls.push({name,args});return {setHeader(k,v){assert.equal(k,"Authorization");assert.equal(v,"Bearer fixture");return this;},async abortSignal(s){assert.ok(s instanceof AbortSignal);return {data,error:null};}};}}};}
test("read and write pin the verified caller; reject switched account before publishing data",async()=>{
 const signal=new AbortController().signal,first=mock(empty);
 assert.deepEqual(await readGroupAccess(first.client,uid,space,signal),empty);
 assert.equal(first.calls[0].name,"hoop_group_access_snapshot");
 await assert.rejects(readGroupAccess(mock(empty,true).client,uid,space,signal));
 const write=mock({ok:true,id:other});
 assert.equal(await mutateGroupAccess(write.client,uid,space,{action:"invite",target:other},signal),other);
 assert.equal(write.calls[0].args.p_target,other);
 await assert.rejects(mutateGroupAccess(mock({ok:false}).client,uid,space,{action:"invite",target:other},signal));
});

test("roster cursor and owner scoping keep older members accessible",async()=>{
 const signal=new AbortController().signal,member={user_id:other,name:"Member",role:"member",channels:[]},f=mock({space_id:space,rows:[member],has_more:false});
 assert.deepEqual(await readGroupMemberPage(f.client,uid,space,null,"Member",signal),{members:[member],next:null});
 assert.equal(f.calls[0].name,"hoop_group_member_page");
 assert.deepEqual(f.calls[0].args,{p_space:space,p_after:null,p_query:"Member"});
 await assert.rejects(readGroupMemberPage(mock({space_id:other,rows:[member],has_more:false}).client,uid,space,null,"",signal));
 await assert.rejects(readGroupMemberPage(mock({space_id:space,rows:[member],has_more:false}).client,uid,space,other,"",signal));
});
