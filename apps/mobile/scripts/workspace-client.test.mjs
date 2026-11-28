import assert from "node:assert/strict";
import {test} from "node:test";
import {parseNativeAccount} from "../src/native/accountClient.ts";
import {commissionBreakdown,readWorkspace,parseWorkspace} from "../src/native/workspaceClient.ts";
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
test("owner metrics stay account-scoped without opening browser administration", () => {
 const source=readFileSync(new URL("../components/PrivateWorkspace.tsx",import.meta.url),"utf8");
 assert.match(source,/session\.data\.session\.user\.id!==owner/);
 assert.match(source,/state.data.kind===kind/);
 assert.match(source,/account\?\.workspaces\?\.\[kind\]===true/);
 assert.doesNotMatch(source,/Linking\.openURL|openAdmin|\/admin\//);
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

test("commission parity uses authoritative referral, adjustments and earnings, preserving old payloads", () => {
 const invoice={id:"invoice",currency:"usd",earnings:0,subscription_plan:"pro",paid_invoice_at:"2026-11-24T00:00:00Z",commission_rate_bps:1300,status:"pending"};
 const details={attribution_id:"abc12345-other",gross_minor:4000,tax_minor:100,fee_minor:200,discount_minor:250,adjustment_minor:3700};
 const dashboard={code:"TEST",active:true,status:"active",clicks:1,signups:1,conversions:1,totals:[],referrals:[],payouts:[]};
 const payload=commission=>({kind:"ambassador",owner,dashboard:{...dashboard,commissions:[commission]}});
 const full={...invoice,...details};
 assert.deepEqual(commissionBreakdown(parseWorkspace(payload(full),owner,"ambassador").dashboard.commissions[0]),{referral:"abc12345",gross:4000,deductions:4000,discount:250,status:"Reversed"});
 assert.equal(commissionBreakdown(parseWorkspace(payload(invoice),owner,"ambassador").dashboard.commissions[0]),null);
 assert.throws(()=>parseWorkspace(payload({...invoice,gross_minor:4000}),owner,"ambassador"),/Invalid workspace data/);
 assert.throws(()=>parseWorkspace(payload({...full,tax_minor:"100"}),owner,"ambassador"),/Invalid workspace data/);
});

test("revoked workspace request cannot consume a successful late response", async () => {
 const controller=new AbortController();
 await assert.rejects(readWorkspace("https://fixture.example","token",owner,"ambassador",controller.signal,async()=>{
   controller.abort();
   return Response.json({kind:"ambassador",owner});
 }),/cancelled/);
});
