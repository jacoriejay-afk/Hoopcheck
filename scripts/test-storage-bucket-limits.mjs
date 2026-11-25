import assert from "node:assert/strict";
import { test } from "node:test";
import { hardenBuckets, limits } from "./harden-storage-buckets.mjs";
function fixture() {
  const buckets = new Map(limits.map(s => [s.id, {id:s.id,public:s.public,file_size_limit:null,allowed_mime_types:null}]));
  const writes=[];
  const storage={
    async getBucket(id){return {data:buckets.get(id),error:null}},
    async updateBucket(id,opts){writes.push(id);buckets.set(id,{id,public:opts.public,file_size_limit:opts.fileSizeLimit,allowed_mime_types:opts.allowedMimeTypes});return {error:null}}
  };
  return {buckets,writes,storage};
}
test("dry run never writes",async()=>{const f=fixture();assert.equal(await hardenBuckets(f.storage),4);assert.deepEqual(f.writes,[])});
test("apply changes only four reviewed buckets and is idempotent",async()=>{const f=fixture();await hardenBuckets(f.storage,{apply:true});assert.deepEqual(f.writes,limits.map(s=>s.id));for(const s of limits){const b=f.buckets.get(s.id);assert.equal(b.public,s.public);assert.equal(b.file_size_limit,s.fileSizeLimit);assert.deepEqual(b.allowed_mime_types,s.allowedMimeTypes)}await hardenBuckets(f.storage,{apply:true});assert.equal(f.writes.length,4)});
test("preflight rejects changed visibility before any write",async()=>{const f=fixture();f.buckets.get("profile-avatars").public=false;await assert.rejects(hardenBuckets(f.storage,{apply:true}),/Unexpected bucket/);assert.equal(f.writes.length,0)});
test("preflight never loosens tighter limits",async()=>{const f=fixture();f.buckets.get("profile-avatars").file_size_limit=1024;await assert.rejects(hardenBuckets(f.storage,{apply:true}),/Unexpected bucket/);assert.equal(f.writes.length,0)});
test("missing bucket stops all writes",async()=>{const f=fixture();f.buckets.delete("profile-avatars");await assert.rejects(hardenBuckets(f.storage,{apply:true}),/Could not read/);assert.equal(f.writes.length,0)});
test("fails closed on API rejection",async()=>{const f=fixture();f.storage.updateBucket=async()=>({error:{message:"mock failure"}});await assert.rejects(hardenBuckets(f.storage,{apply:true}),/Storage API rejected/);assert.equal(f.writes.length,0)});
test("detects unverified writes",async()=>{const f=fixture();f.storage.updateBucket=async()=>({error:null});await assert.rejects(hardenBuckets(f.storage,{apply:true}),/Verification failed/)});
