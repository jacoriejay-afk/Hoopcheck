import assert from "node:assert/strict";
import {test} from "node:test";
import {readApprovedOriginalMedia,validMediaLocator} from "../lib/server/account-export-media.ts";
const id="11111111-1111-4111-8111-111111111111",object="22222222-2222-4222-8222-222222222222";
const locator={id,object_id:object,bucket:"hoopfeed-private-images",path:"owner/original.jpg",version:"v1",bytes:4,expires_at:new Date(Date.now()+60000).toISOString()};
test("approved original bytes require matching current locator before and after read",async()=>{
 let reads=0,resolves=0,checks=0;
 const file=await readApprovedOriginalMedia(id,async()=>{resolves++;return locator;},async(l)=>{reads++;assert.ok(Object.isFrozen(l));return new Blob(["data"]);},async()=>{checks++;return true;},new AbortController().signal);
 assert.equal(await file.text(),"data");assert.equal(reads,1);assert.equal(resolves,2);assert.equal(checks,3);
});
test("path injection, unapproved buckets, wrong object identity, and oversize responses are rejected",()=>{
 for(const bad of [{...locator,path:"owner/../private"},{...locator,path:"/other"},{...locator,path:"owner\\other"},{...locator,bucket:"team-logos"},{...locator,id:object},{...locator,bytes:20971521},{...locator,expires_at:new Date(0).toISOString()}])assert.throws(()=>validMediaLocator(bad,id));
});
test("changed version, cancellation, wrong size, and account change prevent delivery",async()=>{
 for(const mode of ["version","cancel","size","account"]){
  const ctrl=new AbortController();let n=0,checks=0;
  await assert.rejects(readApprovedOriginalMedia(id,async()=>{n++;return mode==="version"&&n===2?{...locator,version:"v2"}:locator;},async()=>{if(mode==="cancel")ctrl.abort();return new Blob([mode==="size"?"bad":"data"]);},async()=>{checks++;return mode!=="account"||checks<3;},ctrl.signal));
 }
});
