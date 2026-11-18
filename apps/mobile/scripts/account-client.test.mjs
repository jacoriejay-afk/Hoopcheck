import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNativeAccount, requestNativeAccount } from '../src/native/accountClient.ts';
const input = {user:{id:'11111111-1111-4111-8111-111111111111',displayName:'Fixture',accountType:'player',email:'private@example.test'},entitlements:{tier:'pro',hasPaidMembership:true,canReadHoopFeed:true,canWriteHoopFeed:false,canUseLiveGameHub:true,canUseFanGroups:false}};
test('native account projects only verified contract fields',()=>{
 const account=parseNativeAccount(input);
 assert.equal(account.tier,'pro');assert.equal(account.features.canWriteHoopFeed,false);
 assert.equal(JSON.stringify(account).includes('private@example.test'),false);
 assert.equal(account.user.accountType,'player');
});
test('malformed permissions cannot grant native feature access',()=>{
 for(const value of [null,{}, {...input,user:{...input.user,id:'../other'}}, {...input,entitlements:{...input.entitlements,tier:'owner'}}, {...input,entitlements:{...input.entitlements,canReadHoopFeed:'true'}}]) assert.throws(()=>parseNativeAccount(value));
});
test('native account fetch uses authenticated no-store request and fails closed',async()=>{
 let call;
 const account=await requestNativeAccount('https://sandbox.example','fixture-token',undefined,async(...args)=>{call=args;return Response.json(input);});
 assert.equal(call[0],'https://sandbox.example/api/mobile/bootstrap');
 assert.equal(call[1].headers.Authorization,'Bearer fixture-token');assert.equal(call[1].cache,'no-store');assert.equal(call[1].redirect,'error');
 assert.equal(account.features.canUseLiveGameHub,true);
 for(const status of [401,403,404,503]) await assert.rejects(requestNativeAccount('https://sandbox.example','fixture-token',undefined,async()=>new Response('{}',{status})));
});
test('invalid API origin never receives a session token',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json(input);};
 for(const origin of ['http://sandbox.example','https://user:pass@sandbox.example','https://sandbox.example/path','https://sandbox.example?x=1'])await assert.rejects(requestNativeAccount(origin,'fixture-token',undefined,fetcher));
 await assert.rejects(requestNativeAccount('https://sandbox.example','',undefined,fetcher));assert.equal(calls,0);
});
