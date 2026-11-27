import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { prepareConversationMessage, sendConversationMessage } from "../src/native/hoopChatSend.ts";

const viewer = "11111111-1111-4111-8111-111111111111";
const thread = "22222222-2222-4222-8222-222222222222";
const bearer = "Bearer fixture-session";
const signal = new AbortController().signal;

test("retries only reuse the identifier of the same account's pending draft", () => {
  const pending = new Map();
  let attempts = 0;
  const createId = () => String(++attempts);
  const first = prepareConversationMessage(pending, thread, viewer, "  Our next game  ", createId);
  assert.equal(first.body, "Our next game");
  assert.equal(prepareConversationMessage(pending, thread, viewer, "Our next game", createId), first);
  assert.notEqual(prepareConversationMessage(pending, thread, "other-account", first.body, createId).id, first.id);
  assert.notEqual(prepareConversationMessage(pending, "other-thread", viewer, first.body, createId).id, first.id);
  pending.delete(thread);
  assert.notEqual(prepareConversationMessage(pending, thread, viewer, first.body, createId).id, first.id);
});

test("a lost acknowledgement followed by a duplicate confirms exactly one caller-owned message", async () => {
  const message = { id: "33333333-3333-4333-8333-333333333333", request_id: thread, sender_id: viewer, body: "Private message" };
  const calls = [];
  let saved;
  let readable = true;
  const client = createClient("https://fixture.supabase.co", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      calls.push({ url, auth: new Headers(init.headers).get("authorization"), method: init.method });
      if (init.method === "POST") {
        const attempted = JSON.parse(init.body);
        assert.deepEqual(attempted, message);
        if (saved) return Response.json({ code: "23505" }, { status: 409 });
        saved = attempted;
        return Response.json({ message: "Connection lost after insert" }, { status: 503 });
      }
      assert.equal(url.searchParams.get("id"), `eq.${message.id}`);
      assert.equal(url.searchParams.get("request_id"), `eq.${thread}`);
      assert.equal(url.searchParams.get("sender_id"), `eq.${viewer}`);
      assert.ok(!url.searchParams.has("body"));
      return Response.json(readable ? [saved] : []);
    } },
  });
  await assert.rejects(sendConversationMessage(client, message, signal, bearer), /could not be confirmed/);
  await sendConversationMessage(client, message, signal, bearer);
  assert.deepEqual(calls.map(call => call.method), ["POST", "POST", "GET"]);
  assert.ok(calls.every(call => call.auth === bearer));
  readable = false;
  await assert.rejects(sendConversationMessage(client, message, signal, bearer), /could not be confirmed/);
});

test("structured reply duplicate acknowledgement requires matching private reply target", async () => {
 const reply="44444444-4444-4444-8444-444444444444";
 const message={id:"33333333-3333-4333-8333-333333333333",request_id:thread,sender_id:viewer,body:"Private reply",reply_to_id:reply};
 let returnedReply=reply;
 const calls=[];
 const client=createClient("https://fixture.supabase.co","fixture-key",{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:async(input,init)=>{
   const url=new URL(String(input));
   assert.equal(new Headers(init.headers).get("authorization"),bearer);
   calls.push(init.method);
   if(init.method==="POST"){
    assert.deepEqual(JSON.parse(init.body),message);
    return Response.json({code:"23505"},{status:409});
   }
   assert.equal(url.searchParams.get("id"),"eq."+message.id);
   assert.equal(url.searchParams.get("request_id"),"eq."+thread);
   assert.equal(url.searchParams.get("sender_id"),"eq."+viewer);
   assert.equal(url.searchParams.get("select"),"body,reply_to_id");
   return Response.json([{body:message.body,reply_to_id:returnedReply}]);
  }}
 });
 await sendConversationMessage(client,message,signal,bearer);
 returnedReply="55555555-5555-4555-8555-555555555555";
 await assert.rejects(sendConversationMessage(client,message,signal,bearer),/could not be confirmed/);
 returnedReply=null;
 await assert.rejects(sendConversationMessage(client,message,signal,bearer),/could not be confirmed/);
 assert.deepEqual(calls,["POST","GET","POST","GET","POST","GET"]);
});
