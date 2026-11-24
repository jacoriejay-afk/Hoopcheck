import assert from "node:assert/strict";
import {test} from "node:test";
import {groupModeration} from "../src/native/groupModeration.ts";
const id=n=>"11111111-1111-4111-8111-"+String(n).padStart(12,"0");
const row={id:id(1),space_id:id(2),channel_id:id(3),body:"Fixture message",moderation_status:"pending"};
test("group owner queue uses fixed HTTPS bearer and filters exact selected space",async()=>{
 const result=await groupModeration("https://api.test","token",id(2),undefined,async(url,options)=>{
  assert.equal(url,"https://api.test/api/hoopgroups/moderate");assert.equal(options.headers.Authorization,"Bearer token");
  assert.equal(options.method,"GET");assert.equal(options.redirect,"error");
  return Response.json({posts:[row,{...row,id:id(4),space_id:id(5)}]});
 });assert.deepEqual(result,[row]);
});
test("moderation action needs exact confirmed ID and status; disabled or malformed queues never pass",async()=>{
 const action={id:id(1),status:"approved"};
 await groupModeration("https://api.test","token",id(2),action,async(_,options)=>{
  assert.equal(options.method,"PATCH");assert.deepEqual(JSON.parse(options.body),action);return Response.json({post:{id:action.id,moderation_status:action.status}});
 });
 await assert.rejects(groupModeration("https://api.test","token",id(2),action,async()=>Response.json({post:{id:id(4),moderation_status:"approved"}})));
 await assert.rejects(groupModeration("https://api.test","token",id(2),undefined,async()=>Response.json({error:"Disabled"},{status:503})),/not active/);
 await assert.rejects(groupModeration("https://api.test","token",id(2),undefined,async()=>Response.json({posts:[{...row,moderation_status:"approved"}]})));
 await assert.rejects(groupModeration("http://api.test","token",id(2),undefined,async()=>{throw Error("unexpected");}),/verified/);
});
