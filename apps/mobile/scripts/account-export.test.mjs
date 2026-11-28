import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {requestDurableExport,validateExportResponse} from "../src/native/accountExport.ts";
const id="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const expiry=new Date(Date.now()+3600000).toISOString();
const base={id,scope:"owned-records-v1",complete:false,row_count:2,expires_at:expiry};
test("owner-scoped API posts a job id and cursor only and accepts an existing request id",async()=>{
 const ctrl=new AbortController();
 const result=await requestDurableExport("https://api.test","token","request",id,0,ctrl.signal,async(url,init)=>{
  assert.equal(url,"https://api.test/api/account/export-job");
  assert.deepEqual(JSON.parse(init.body),{action:"request",job:id,after:0});
  assert.equal(init.headers.Authorization,"Bearer token");
  assert.equal(init.redirect,"error");assert.equal(init.cache,"no-store");
  return Response.json({...base,id:other,state:"ready"});
 });
 assert.equal(result.kind,"job");assert.equal(result.value.id,other);
});
test("download rejects cross-job, expired, malformed, noncontiguous and falsely complete pages",()=>{
 const page={...base,rows:[{ordinal:1,section:"profile",data:{id}},{ordinal:2,section:"reviews",data:{body:"own"}}],next_after:null};
 assert.equal(validateExportResponse(page,"download",id,0).kind,"page");
 for(const bad of [{...page,id:other},{...page,complete:true},{...page,expires_at:new Date(0).toISOString()},{...page,next_after:2},{...page,rows:[{...page.rows[0],ordinal:2},page.rows[1]]},{...page,rows:[]}])assert.throws(()=>validateExportResponse(bad,"download",id,0));
 assert.throws(()=>validateExportResponse(page,"download",id,3));
});
test("late cancelled response is never delivered and invalid origins never dispatch",async()=>{
 const ctrl=new AbortController();
 await assert.rejects(requestDurableExport("https://api.test","token","status",id,0,ctrl.signal,async()=>{ctrl.abort();return Response.json({...base,state:"ready"});}));
 for(const origin of ["http://api.test","https://api.test/other","https://u:p@api.test","https://api.test/?x=1"])await assert.rejects(requestDurableExport(origin,"token","status",id,0,new AbortController().signal,async()=>{throw Error("must not dispatch");}),/Invalid export request/);
});
test("native export is separately gated, account keyed, uses temporary private cache and never stores payload in state",()=>{
 const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const page=read("app/account/privacy-center.tsx"),ui=read("components/AccountExportJobs.tsx"),helper=read("src/native/accountExport.ts");
 assert.match(page,/durableExportEnabled\?<AccountExportJobs key=\{owner\}/);
 assert.match(helper,/EXPO_PUBLIC_ACCOUNT_EXPORT_FULFILLMENT_ENABLED==="true"/);
 assert.match(ui,/latest\.data\.session\.access_token!==token/);
 assert.match(ui,/current\.current\?\.abort\(\)/);
 assert.match(ui,/new File\(Paths.cache/);assert.match(ui,/Sharing\.shareAsync/);
 assert.match(ui,/if\(file.exists\)file.delete\(\)/);
 assert.doesNotMatch(ui,/AsyncStorage|SecureStore|setPayload|console\./);
});
