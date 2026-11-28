import assert from "node:assert/strict";
import {test} from "node:test";
import {prepareGroupSend,submitGroupSend} from "../src/native/hoopGroupsSend.ts";
const owner="11111111-1111-4111-8111-111111111111",channel="22222222-2222-4222-8222-222222222222",parent="33333333-3333-4333-8333-333333333333",id="44444444-4444-4444-8444-444444444444";
test("reply target is bound to retry identity and server confirmation",async()=>{
 const draft=prepareGroupSend(null,owner,channel,"reply",()=>id,parent);
 assert.equal(draft.replyTo,parent);
 assert.equal(prepareGroupSend(draft,owner,channel,"reply",()=>assert.fail(),parent),draft);
 assert.notEqual(prepareGroupSend(draft,owner,channel,"reply",()=>parent),draft);
 assert.throws(()=>prepareGroupSend(null,owner,channel,"reply",()=>id,"bad"));
 const row={id,author_id:owner,channel_id:channel,body:"reply",moderation_status:"pending",reply_to_id:owner};
 const db={from:()=>{const q={select:()=>q,eq:()=>q,setHeader:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:row,error:null}),insert:()=>assert.fail("wrong parent must not insert")};return q;}};
 await assert.rejects(submitGroupSend(db,draft,"Bearer token",new AbortController().signal),/identity mismatch/);
});
