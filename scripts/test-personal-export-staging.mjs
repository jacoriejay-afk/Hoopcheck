import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePersonalExport } from "../lib/server/personal-export-staging.ts";
const owner="11111111-1111-4111-8111-111111111111",request="22222222-2222-4222-8222-222222222222",foreign="33333333-3333-4333-8333-333333333333";
const plan=()=>({requestId:request,ownerId:owner,policyVersion:"fixture-approved",expiresAt:new Date(Date.now()+60000).toISOString(),byteLimit:4*1024*1024,sections:[{name:"profile",fields:["display_name"]},{name:"reviews",fields:["body"]}]});
const signal=()=>new AbortController().signal;
async function sandbox(fn){const root=await mkdtemp(join(tmpdir(),"hc-export-fixture-"));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
const goodRow=(id,data,ownerId=owner)=>({id,ownerId,data});
test("stream all approved sections without internal fields, bind retrieval and digest",async()=>{
 await sandbox(async root=>{
  let pages=0;
  const readers={profile:async({ownerId,after,limit})=>{assert.equal(ownerId,owner);assert.equal(after,null);assert.equal(limit,100);return{rows:[goodRow("p1",{display_name:"Synthetic",secret:"NEVER"})],hasMore:false};},reviews:async({after,limit})=>{
   assert.equal(limit,100);pages++;
   const start=after===null?0:Number(after.slice(1))+1;
   const rows=Array.from({length:Math.min(100,205-start)},(_,i)=>goodRow("r"+String(start+i).padStart(4,"0"),{body:"fixture",author_id:foreign}));
   return{rows,hasMore:start+rows.length<205};
  }};
  const artifact=await stagePersonalExport(plan(),readers,async()=>true,root,signal());
  assert.equal(pages,3);assert.equal(artifact.rows,206);
  const dirs=await readdir(root);assert.equal(dirs.length,1);
  assert.equal((await stat(join(root,dirs[0]))).mode&0o777,0o700);
  assert.equal((await stat(join(root,dirs[0],"export.ndjson"))).mode&0o777,0o600);
  await assert.rejects(async()=>{for await(const chunk of artifact.read(foreign,request,signal()))void chunk;},/unavailable/);
  const chunks=[];for await(const chunk of artifact.read(owner,request,signal()))chunks.push(chunk);
  const body=Buffer.concat(chunks);
  assert.equal(body.length,artifact.bytes);assert.equal(createHash("sha256").update(body).digest("hex"),artifact.sha256);
  assert.doesNotMatch(body.toString(),/NEVER|secret|author_id|33333333/);
  const records=body.toString().trimEnd().split("\n").map(JSON.parse);
  assert.equal(records.at(-1).rows,206);assert.equal(records.filter(r=>r.section==="reviews").length,205);
  await artifact.dispose();assert.deepEqual(await readdir(root),[]);
 });
});
test("foreign rows, duplicated cursors, nested raw data and missing readers leave no artifact",async()=>{
 await sandbox(async root=>{
  const base={profile:async()=>({rows:[goodRow("p1",{display_name:"Synthetic"})],hasMore:false})};
  for(const reviews of [
   async()=>({rows:[goodRow("r1",{body:"foreign"},foreign)],hasMore:false}),
   async()=>({rows:[goodRow("r1",{body:"a"}),goodRow("r1",{body:"b"})],hasMore:false}),
   async()=>({rows:[goodRow("r1",{body:{internal:"never"}})],hasMore:false}),
   async()=>({rows:[],hasMore:true}),
  ]){
   await assert.rejects(stagePersonalExport(plan(),{...base,reviews},async()=>true,root,signal()));
   assert.deepEqual(await readdir(root),[]);
  }
  await assert.rejects(stagePersonalExport(plan(),base,async()=>true,root,signal()),/source unavailable/);
  const invalid=plan();invalid.sections[1].fields=["refresh_token"];
  await assert.rejects(stagePersonalExport(invalid,base,async()=>true,root,signal()),/projection/);
  assert.deepEqual(await readdir(root),[]);
 });
});
test("cancellation, budget exhaustion and late approval loss discard staged data",async()=>{
 await sandbox(async root=>{
  for(const mode of ["cancel","budget","revoked"]){
   const abort=new AbortController();let allowed=true;
   const p=plan();if(mode==="budget")p.byteLimit=64;
   const readers={profile:async()=>({rows:[goodRow("p1",{display_name:"Synthetic"})],hasMore:false}),reviews:async()=>{if(mode==="cancel")abort.abort();if(mode==="revoked")allowed=false;return{rows:[goodRow("r1",{body:"fixture"})],hasMore:false};}};
   await assert.rejects(stagePersonalExport(p,readers,async()=>allowed,root,abort.signal));
   assert.deepEqual(await readdir(root),[]);
  }
 });
});
test("retrieval is denied on expired or revoked authorization and does not disclose bytes",async()=>{
 await sandbox(async root=>{
  let allowed=true;
  const readers={profile:async()=>({rows:[goodRow("p1",{display_name:"Synthetic"})],hasMore:false}),reviews:async()=>({rows:[],hasMore:false})};
  const artifact=await stagePersonalExport(plan(),readers,async()=>allowed,root,signal());
  allowed=false;let bytes=0;
  await assert.rejects(async()=>{for await(const part of artifact.read(owner,request,signal()))bytes+=part.length;});
  assert.equal(bytes,0);
  await artifact.dispose();
  const expired=plan();expired.expiresAt=new Date(Date.now()-1000).toISOString();
  await assert.rejects(stagePersonalExport(expired,readers,async()=>true,root,signal()),/Invalid approved/);
  assert.deepEqual(await readdir(root),[]);
 });
});
