import {test} from "node:test";
import assert from "node:assert/strict";
import {loadExportMedia,downloadExportMedia,downloadExportMediaToSink,validateMediaManifest} from "../src/native/accountExportMedia.ts";
const job="11111111-1111-4111-8111-111111111111",id="22222222-2222-4222-8222-222222222222",item={id,bytes:4},signal=new AbortController().signal;
const manifest={id:job,complete:false,state:"prepared",items:[item],next_after:null,pending_count:2,denied_count:1};
test("manifest strips untrusted private fields and rejects foreign job, cursor and complete claim",()=>{
 assert.deepEqual(validateMediaManifest({...manifest,items:[{...item,path:"private"}]},job,null),manifest);
 for(const m of [{...manifest,id},{...manifest,complete:true},{...manifest,items:[item,item]},{...manifest,items:[{...item,bytes:0}]},{...manifest,next_after:id}])assert.throws(()=>validateMediaManifest(m,job,null));
 assert.throws(()=>validateMediaManifest(manifest,job,id));
});
test("media request contains only opaque IDs and validates exact download bytes",async()=>{
 const result=await loadExportMedia("https://api.test","token",job,null,signal,async(url,init)=>{assert.equal(url,"https://api.test/api/account/export-media");assert.deepEqual(JSON.parse(init.body),{action:"manifest",job,after:null});assert.equal(init.headers.Authorization,"Bearer token");return Response.json(manifest);});
 assert.deepEqual(result,manifest);
 const data=await downloadExportMedia("https://api.test","token",job,item,signal,async(_,init)=>{assert.deepEqual(JSON.parse(init.body),{action:"download",job,item:id});return new Response("data",{headers:{"content-type":"application/octet-stream","content-length":"4"}});});
 assert.equal(new TextDecoder().decode(data),"data");
 await assert.rejects(downloadExportMedia("https://api.test","token",job,item,signal,async()=>new Response("bad",{headers:{"content-type":"application/octet-stream","content-length":"4"}})));
});
test("late cancellation and unsafe origin prevent delivery",async()=>{
 const c=new AbortController();await assert.rejects(downloadExportMedia("https://api.test","token",job,item,c.signal,async()=>{c.abort();return new Response("data",{headers:{"content-type":"application/octet-stream","content-length":"4"}});}));
 await assert.rejects(loadExportMedia("http://api.test","token",job,null,signal,async()=>{throw Error("must not dispatch");}),/request unavailable/);
});

test("large media is assembled only from contiguous version-bound chunks",async()=>{
 const total=4194305,parts=[],offsets=[],tag='"fixture-etag"';
 await downloadExportMediaToSink("https://api.test","token",job,{id,bytes:total},signal,bytes=>{parts.push(bytes.byteLength);},async()=>{},()=>{},async(_,init)=>{
  const body=JSON.parse(init.body);offsets.push(body.offset);assert.equal(body.etag,body.offset===0?null:tag);
  const end=Math.min(total-1,body.offset+2097152-1),len=end-body.offset+1;
  return new Response(new Uint8Array(len),{status:206,headers:{"content-type":"application/octet-stream","content-length":String(len),"content-range":`bytes ${body.offset}-${end}/${total}`,etag:tag}});
 });
 assert.deepEqual(offsets,[0,2097152,4194304]);assert.deepEqual(parts,[2097152,2097152,1]);
 let writes=0;
 await assert.rejects(downloadExportMediaToSink("https://api.test","token",job,{id,bytes:total},signal,()=>{writes++;},async()=>{},()=>{},async(_,init)=>{
  const body=JSON.parse(init.body),end=Math.min(total-1,body.offset+2097152-1),len=end-body.offset+1;
  return new Response(new Uint8Array(len),{status:206,headers:{"content-type":"application/octet-stream","content-length":String(len),"content-range":`bytes ${body.offset}-${end}/${total}`,etag:body.offset===0?tag:'"changed"'}});
 }));assert.equal(writes,1);
});
