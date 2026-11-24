import assert from "node:assert/strict";
import {test} from "node:test";
import {parseNativeAccount} from "../src/native/accountClient.ts";
import {readWorkspace} from "../src/native/workspaceClient.ts";
const owner="11111111-1111-4111-8111-111111111111";
const base={user:{id:owner,displayName:"Fixture",accountType:"player"},entitlements:{tier:"free",hasPaidMembership:false,canReadHoopFeed:false,canWriteHoopFeed:false,canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:false}};
test("old and malformed bootstrap grants default to denied",()=>{
 assert.deepEqual(parseNativeAccount(base).workspaces,{owner:false,ambassador:false});
 assert.deepEqual(parseNativeAccount({...base,workspaces:{owner:"true",ambassador:1}}).workspaces,{owner:false,ambassador:false});
 assert.deepEqual(parseNativeAccount({...base,workspaces:{owner:true,ambassador:false}}).workspaces,{owner:true,ambassador:false});
});
test("private workspace reads have verified owner and no-store bearer request",async()=>{
 let args;const data={kind:"owner",owner,metrics:[],stripe:{}};
 assert.deepEqual(await readWorkspace("https://fixture.example","token",owner,"owner",undefined,async(...a)=>{args=a;return Response.json(data);}),data);
 assert.equal(args[0],"https://fixture.example/api/mobile/workspaces?kind=owner");
 assert.equal(args[1].cache,"no-store");assert.equal(args[1].redirect,"error");assert.equal(args[1].headers.Authorization,"Bearer token");
 await assert.rejects(readWorkspace("https://fixture.example","token",owner,"owner",undefined,async()=>Response.json({...data,owner:"other"})));
 await assert.rejects(readWorkspace("https://fixture.example","token",owner,"owner",undefined,async()=>new Response("{}",{status:403})));
});
