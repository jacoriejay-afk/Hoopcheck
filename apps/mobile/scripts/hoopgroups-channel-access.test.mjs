import {test} from "node:test";import assert from "node:assert/strict";
import {readGroupChannelAccess} from "../src/native/hoopGroupsChannelAccess.ts";
const space="11111111-1111-4111-8111-111111111111",channel="22222222-2222-4222-8222-222222222222";
function mock(s,c){return {from(t){const q={select(){return q;},eq(){return q;},setHeader(k,v){assert.equal(k,"Authorization");assert.equal(v,"Bearer token");return q;},abortSignal(){return q;},async maybeSingle(){return {data:t==="hoop_group_spaces"?s:c,error:null};}};return q;}};}
test("private space or channel never authorizes raw realtime subscription; revocation returns no access",async()=>{
 const s={id:space,visibility:"public"},c={id:channel,space_id:space,visibility:"public"},call=(a,b)=>readGroupChannelAccess(mock(a,b),space,channel,"Bearer token",new AbortController().signal);
 assert.deepEqual(await call(s,c),{spaceVisible:true,channelVisible:true,private:false});
 assert.equal((await call({...s,visibility:"private"},c)).private,true);
 assert.equal((await call(s,{...c,visibility:"private"})).private,true);
 assert.deepEqual(await call(s,null),{spaceVisible:true,channelVisible:false,private:true});
 assert.deepEqual(await call(null,null),{spaceVisible:false,channelVisible:false,private:true});
 await assert.rejects(call(s,{...c,space_id:channel}));
});
