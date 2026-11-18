import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
function compile(source,imports=require){const compiled={exports:{}};const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',js)(imports,compiled.exports,compiled);return compiled.exports;}
const helper=compile(await readFile(new URL('../lib/apple-app-site-association.ts',import.meta.url),'utf8'));
const route=compile(await readFile(new URL('../app/.well-known/apple-app-site-association/route.ts',import.meta.url),'utf8'),name=>{
 if(name==='next/server')return {NextResponse:{json:(data,init)=>Response.json(data,init)}};
 if(name==='../../../lib/apple-app-site-association')return helper;
 throw Error(`Unexpected route import ${name}`);
});
test('association uses the owner-confirmed signing prefix and rejects mismatched overrides and uses the exact bundle ID',()=>{
 for(const value of ['','6835366982x','testonly01','https://evil.test','TESTONLY01.other','TESTONLY01\nBAD'])assert.equal(helper.appleAppSiteAssociation(value),null);
 const association=helper.appleAppSiteAssociation(' Y778LM35G5 ');assert.deepEqual(association.applinks.details[0].appIDs,['Y778LM35G5.online.hoopcheck.app']);assert.ok(!('webcredentials'in association));
});
test('association allows implemented native paths while browser auth/referral and nested fallback paths remain excluded',()=>{
 const entries=helper.appleAppSiteAssociation().applinks.details[0].components;
 const matches=path=>{for(const entry of entries){const escaped=entry['/'].split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');if(new RegExp('^'+escaped+'$').test(path))return entry.exclude!==true;}return false;};
 for(const path of ['/','/feed','/search','/account','/account/edit','/fan-live','/team-hub/groups','/team-hub/groups/fixture','/teams/fixture','/womens/fixture','/womens/leagues/fixture'])assert.equal(matches(path),true,path);
 for(const path of ['/auth/callback','/reset-password','/login','/signup','/referral/CODE','/r/CODE','/admin/ambassadors','/coaches/fixture','/teams/id/review','/womens/id/review','/womens/leagues/id/review','/womens/leagues','/account/security','/team-hub/groups/id/nested'])assert.equal(matches(path),false,path);
 assert.equal(entries.some(entry=>entry['/']==='*'||entry['/']==='/*'),false);
});
test('actual route serves the confirmed identity by default and never caches mismatched configuration',async()=>{
 const original=process.env.HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX;
 try{
  process.env.HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX='TESTONLY01';let response=route.GET();assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
  delete process.env.HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX;response=route.GET();assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/json');assert.equal(response.headers.get('cache-control'),'public, max-age=3600');assert.deepEqual((await response.json()).applinks.details[0].appIDs,['Y778LM35G5.online.hoopcheck.app']);assert.equal(route.dynamic,'force-dynamic');
 }finally{if(original===undefined)delete process.env.HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX;else process.env.HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX=original;}
});
