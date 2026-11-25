import assert from "node:assert/strict";
import {test} from "node:test";
import {parseNativeAccount} from "../src/native/accountClient.ts";
import {readWorkspace,parseWorkspace} from "../src/native/workspaceClient.ts";
const owner="11111111-1111-4111-8111-111111111111";
const base={user:{id:owner,displayName:"Fixture",accountType:"player"},entitlements:{tier:"free",hasPaidMembership:false,canReadHoopFeed:false,canWriteHoopFeed:false,canUseLiveGameHub:false,canUseLiveGameChat:false,canSwitchBasketballSide:false,canUseFanGroups:false}};
test("old and malformed bootstrap grants default to denied",()=>{
 assert.deepEqual(parseNativeAccount(base).workspaces,{owner:false,ambassador:false});
 assert.deepEqual(parseNativeAccount({...base,workspaces:{owner:"true",ambassador:1}}).workspaces,{owner:false,ambassador:false});
 assert.deepEqual(parseNativeAccount({...base,workspaces:{owner:true,ambassador:false}}).workspaces,{owner:true,ambassador:false});
});
test("private workspace reads have verified owner and no-store bearer request",async()=>{
 let args;const data={kind:"owner",owner,metrics:[],stripe:{paidInvoices:0,activeSubscriptions:null,grossPaidMinor:0,refundedMinor:null,incomplete:false,subscriptionsIncomplete:false,refundsIncomplete:false,error:"Stripe reporting unavailable"}};
 assert.deepEqual(await readWorkspace("https://fixture.example","token",owner,"owner",undefined,async(...a)=>{args=a;return Response.json(data);}),data);
 assert.equal(args[0],"https://fixture.example/api/mobile/workspaces?kind=owner");
 assert.equal(args[1].cache,"no-store");assert.equal(args[1].redirect,"error");assert.equal(args[1].headers.Authorization,"Bearer token");
 await assert.rejects(readWorkspace("https://fixture.example","token",owner,"owner",undefined,async()=>Response.json({...data,owner:"other"})));
 await assert.rejects(readWorkspace("https://fixture.example","token",owner,"owner",undefined,async()=>new Response("{}",{status:403})));
});

import {readFileSync} from "node:fs";
test("owner administration shortcuts stay behind verified workspace and use fixed web origin",()=>{
 const source=readFileSync(new URL("../components/PrivateWorkspace.tsx",import.meta.url),"utf8");
 assert.ok(source.includes('if(!active||!allowed||kind!=="owner"||data?.kind!=="owner"||data.owner!==owner)return;'));
 assert.ok(source.includes("session.data.session?.user.id!==owner"));
 assert.ok(source.includes('Linking.openURL("https://hoopcheck.online"+path)'));
 assert.ok(source.includes("No app session is transferred."));
 assert.ok(source.includes("state.data.kind===kind"));
 for(const path of ["/admin/directory","/admin/reviews","/admin/ambassadors"])assert.ok(source.includes(`openAdmin("${path}")`));
});

test("workspace validation refuses malformed data instead of rendering fabricated totals or crashing",()=>{
 const stripe={paidInvoices:3,activeSubscriptions:2,grossPaidMinor:2000,refundedMinor:500,incomplete:false,subscriptionsIncomplete:false,refundsIncomplete:false};
 const data={kind:"owner",owner,metrics:[{label:"Registered profiles",value:"Unavailable"}],stripe};
 assert.deepEqual(parseWorkspace(data,owner,"owner"),data);
 for(const wrong of [{...data,metrics:[null]},{...data,metrics:[{label:"Bad",value:123}]},{...data,stripe:{}},{...data,stripe:{...stripe,paidInvoices:-1}},{...data,stripe:{...stripe,incomplete:"false"}}]){
   assert.throws(()=>parseWorkspace(wrong,owner,"owner"),/Invalid workspace data/);
 }
 const dashboard={code:"TEST",active:false,status:"pending",clicks:2,signups:1,conversions:0,totals:[{currency:"usd",earned:-50}],referrals:[{id:"ref",captured_at:"2026-11-24T00:00:00Z",first_paid_at:null,stripe_status:null}],commissions:[],payouts:[]};
 const ambassador={kind:"ambassador",owner,dashboard};
 assert.deepEqual(parseWorkspace(ambassador,owner,"ambassador"),ambassador);
 for(const wrong of [{...dashboard,active:"false"},{...dashboard,conversions:null},{...dashboard,totals:[{currency:"bad!",earned:1}]},{...dashboard,referrals:[{id:null}]},{...dashboard,payouts:[null]}]){
   assert.throws(()=>parseWorkspace({...ambassador,dashboard:wrong},owner,"ambassador"),/Invalid workspace data/);
 }
 assert.throws(()=>parseWorkspace(ambassador,"other","ambassador"),/identity/);
});
test("stale workspace permissions cannot render for the newly verified identity",()=>{
 const source=readFileSync(new URL("../src/native/useNativeAccount.ts",import.meta.url),"utf8");
 assert.ok(source.includes('!offline && security.phase === "ready" && account?.user.id === security.owner ? account : null'));
 assert.ok(source.includes('account: verifiedAccount'));
});
