import {test} from "node:test";import assert from "node:assert/strict";
import {deliverPrivateChatPush,createOfflinePushProvider} from "./private-chat-push-worker.mjs";
const id="11111111-1111-4111-8111-111111111111",device="22222222-2222-4222-8222-222222222222",fence="33333333-3333-4333-8333-333333333333";
const lease={state:"leased",notice_id:id,device_id:device,fence};
function mock(recipient={platform:"ios",token:"ExpoPushToken[fixture_token_123456789]"},claim=lease,ack=true){const calls=[];return {calls,client:{async rpc(name,args){calls.push([name,args]);return {data:name==="claim_private_chat_push"?claim:name==="resolve_private_chat_push"?recipient:ack};}}};}
test("only generic notification payload goes to offline provider; no sensitive identifiers",async()=>{
 const f=mock(),p=createOfflinePushProvider();assert.equal(await deliverPrivateChatPush(f.client,p),"sent");
 assert.deepEqual(p.receipts,[{title:"HoopCheck",body:"You have a new update.",data:{path:"/notifications"}}]);
 assert.deepEqual(f.calls[2][1],{p_notice:id,p_device:device,p_fence:fence,p_outcome:"sent"});
});
test("revoked recipient, disabled state, invalid token and uncertain delivery",async()=>{
 const p=createOfflinePushProvider(),r=mock(null);assert.equal(await deliverPrivateChatPush(r.client,p),"cancelled");assert.equal(p.receipts.length,0);
 assert.equal(await deliverPrivateChatPush(mock(null,{state:"disabled"}).client,p),"disabled");
 assert.equal(await deliverPrivateChatPush(mock().client,{async send(){throw Error("timeout");}}),"uncertain");
 assert.equal(await deliverPrivateChatPush(mock().client,createOfflinePushProvider("not_accepted")),"retry");
 assert.equal(await deliverPrivateChatPush(mock().client,createOfflinePushProvider("invalid_token")),"invalid_token");
 await assert.rejects(deliverPrivateChatPush(mock({platform:"ios",token:"bad"}).client,p));
 await assert.rejects(deliverPrivateChatPush(mock(undefined,lease,false).client,p),/do not replay/);
});
