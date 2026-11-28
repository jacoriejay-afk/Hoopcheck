import {test} from "node:test";
import assert from "node:assert/strict";
import {parseChatThread,readLinkedChatThread} from "../src/native/hoopChatLink.ts";
import {notificationPath,noticeMatches} from "../src/native/notifications.ts";
import {nativeDestination} from "../src/native/deepLinks.ts";
const id="11111111-1111-4111-8111-111111111111",viewer="22222222-2222-4222-8222-222222222222",peer="33333333-3333-4333-8333-333333333333",foreign="44444444-4444-4444-8444-444444444444";
const notice={target_type:"conversation",target_id:id,notification_type:"chat_message",read_at:null};
test("private chat notification routes accept exactly one canonical UUID",()=>{
 assert.equal(notificationPath(notice),"/messages?thread="+id);
 assert.equal(nativeDestination("https://hoopcheck.online"+notificationPath(notice)),"/messages?thread="+id);
 assert.equal(nativeDestination("/messages?thread="+id+"&thread="+peer),"/messages");
 assert.equal(notificationPath({...notice,target_id:"../account"}),null);
 assert.equal(parseChatThread([id]),null);
 assert.equal(noticeMatches(notice,"messages"),true);assert.equal(noticeMatches(notice,"clubs"),false);
});
function db(row,sessionOwner=viewer,token="token",onRead=()=>{}){
 const calls=[];const q={select(v){calls.push(["select",v]);return q;},eq(...args){calls.push(["eq",...args]);return q;},or(v){calls.push(["or",v]);return q;},setHeader(...args){calls.push(["header",...args]);return q;},abortSignal(){return q;},async maybeSingle(){onRead();return {data:row,error:null};}};
 return {calls,client:{from(t){assert.equal(t,"player_contact_requests");return q;},auth:{getSession:async()=>({data:{session:{user:{id:sessionOwner},access_token:token}},error:null})}}};
}
const row={id,requester_id:viewer,player_id:peer,message:null,status:"accepted",created_at:"2026-11-28T00:00:00Z"};
test("older deep link requires exact accepted participant and unchanged bearer",async()=>{
 const {client,calls}=db(row);
 assert.deepEqual(await readLinkedChatThread(client,viewer,id,new Set(),"Bearer token",new AbortController().signal),row);
 assert.ok(calls.some(x=>x[0]==="or"&&x[1].includes(viewer)));assert.ok(calls.some(x=>x[0]==="eq"&&x[1]==="status"&&x[2]==="accepted"));
 for(const value of [{...row,status:"pending"},{...row,requester_id:foreign},{...row,id:foreign},null]){
 assert.equal(await readLinkedChatThread(db(value).client,viewer,id,new Set(),"Bearer token",new AbortController().signal),null);
 }
 assert.equal(await readLinkedChatThread(client,viewer,id,new Set([peer]),"Bearer token",new AbortController().signal),null);
 await assert.rejects(readLinkedChatThread(db(row,foreign).client,viewer,id,new Set(),"Bearer token",new AbortController().signal));
 await assert.rejects(readLinkedChatThread(db(row,viewer,"rotated").client,viewer,id,new Set(),"Bearer token",new AbortController().signal));
 const c=new AbortController();await assert.rejects(readLinkedChatThread(db(row,viewer,"token",()=>c.abort()).client,viewer,id,new Set(),"Bearer token",c.signal));
});
