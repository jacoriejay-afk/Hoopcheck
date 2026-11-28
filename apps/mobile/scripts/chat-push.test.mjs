import {test} from "node:test";import assert from "node:assert/strict";
import {readChatPushPreference,syncChatPushDevice} from "../src/native/chatPush.ts";
const uid="11111111-1111-4111-8111-111111111111",installation="22222222-2222-4222-8222-222222222222",other="33333333-3333-4333-8333-333333333333";
function mock(data,owner=uid){const calls=[];return {calls,client:{auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:"fixture"}}}),getUser:async()=>({data:{user:{id:owner}}})},rpc(name,args){calls.push([name,args]);return {setHeader(k,v){assert.equal(v,"Bearer fixture");return this;},async abortSignal(){return {data,error:null};}};}}};}
test("push preference and registration are verified-owner scoped",async()=>{
 const signal=new AbortController().signal,m=mock(true);
 assert.equal(await readChatPushPreference(m.client,uid,true,signal),true);
 await syncChatPushDevice(m.client,uid,installation,{platform:"ios",token:"ExpoPushToken[fixture_token_123456789]"},signal);
 await syncChatPushDevice(m.client,uid,installation,null,signal);
 assert.deepEqual(m.calls[2],["my_chat_push_device",{p_installation:installation,p_platform:null,p_token:null,p_revoke:true}]);
 await assert.rejects(readChatPushPreference(mock(false).client,uid,true,signal));
 await assert.rejects(syncChatPushDevice(mock(true,other).client,uid,installation,null,signal));
 await assert.rejects(syncChatPushDevice(m.client,uid,installation,{platform:"ios",token:"bad"},signal));
});
