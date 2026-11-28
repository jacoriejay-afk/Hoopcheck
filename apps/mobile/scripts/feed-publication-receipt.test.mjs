import {test} from "node:test";
import assert from "node:assert/strict";
import {publicationStorageKey,resolvePublication,requirePublicationAck} from "../src/native/publicationReceiptCore.ts";
const owner="00000000-0000-4000-8000-000000000001",key="10000000-0000-4000-8000-000000000001",post="20000000-0000-4000-8000-000000000001";
test("owner-scoped journal and verified receipt",async()=>{
 assert.notEqual(publicationStorageKey(owner),publicationStorageKey(post));
 assert.throws(()=>publicationStorageKey("other"));
 assert.throws(()=>requirePublicationAck(key,{allowed:true}));
 assert.throws(()=>requirePublicationAck(key,{publication_id:post,post_id:post}));
 requirePublicationAck(key,{publication_id:key,post_id:post});
 const request=async(url,options)=>{
  assert.equal(url,"https://example.invalid/api/hoopfeed/publication");
  assert.equal(options.headers.Authorization,"Bearer fixture");
  assert.deepEqual(JSON.parse(options.body),{publication_id:key,cancel_missing:true});
  return new Response(JSON.stringify({publication_id:key,state:"cancelled"}),{status:200});
 };
 assert.equal(await resolvePublication("https://example.invalid","fixture",key,true,request),"cancelled");
 await assert.rejects(resolvePublication("https://example.invalid","fixture",key,true,async()=>new Response(JSON.stringify({publication_id:key,state:"missing"}),{status:200})));
 await assert.rejects(resolvePublication("https://example.invalid","fixture",key,true,async()=>new Response(JSON.stringify({publication_id:post,state:"published"}),{status:200})));
});
