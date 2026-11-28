// Only a verified service RPC may supply this locator; never accept a caller
// path, URL, owner ID, bucket, filename, MIME type or byte limit.
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const buckets=new Set(["fan-group-images","feed-images","feed-videos","hoopfeed-private-images","hoopfeed-private-videos","player-verification-documents","profile-avatars","profile-claim-proofs"]);
export type ExportMediaLocator={id:string;bucket:string;path:string;version:string;object_id:string;bytes:number;expires_at:string};
export function validMediaLocator(value:unknown,id:string,now=Date.now()):ExportMediaLocator{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Media unavailable.");
 const v=value as Record<string,unknown>;
 if(v.id!==id||!uuid.test(id)||typeof v.bucket!=="string"||!buckets.has(v.bucket)||typeof v.path!=="string"||v.path.length<1||v.path.length>1024||
  v.path.includes("\\")||/[\x00-\x1f\x7f]/.test(v.path)||v.path.split("/").some(p=>!p||p==="."||p==="..")||
  typeof v.version!=="string"||v.version.length<1||v.version.length>1024||typeof v.object_id!=="string"||!uuid.test(v.object_id)||
  typeof v.bytes!=="number"||!Number.isSafeInteger(v.bytes)||v.bytes<1||v.bytes>134217728||
  typeof v.expires_at!=="string"||!Number.isFinite(Date.parse(v.expires_at))||Date.parse(v.expires_at)<=now)throw Error("Media unavailable.");
 return {id,bucket:v.bucket,path:v.path,version:v.version,object_id:v.object_id,bytes:v.bytes,expires_at:v.expires_at};
}
export async function readApprovedOriginalMedia(id:string,resolve:()=>Promise<unknown>,read:(locator:Readonly<ExportMediaLocator>,signal:AbortSignal)=>Promise<Blob>,verify:()=>Promise<boolean>,signal:AbortSignal){
 async function boundary(){if(signal.aborted||!await verify()||signal.aborted)throw Error("Media unavailable.");}
 await boundary();
 const first=Object.freeze(validMediaLocator(await resolve(),id));
 await boundary();
 const file=await read(first,signal);
 if(signal.aborted||!(file instanceof Blob)||file.size!==first.bytes)throw Error("Media unavailable.");
 // Never hand over bytes after an ownership, version, approval, cancellation
 // or expiry change. The entire bounded file is checked before delivery.
 const last=validMediaLocator(await resolve(),id);
 if(JSON.stringify(first)!==JSON.stringify(last))throw Error("Media changed.");
 await boundary();
 if(Date.parse(last.expires_at)<=Date.now())throw Error("Media expired.");
 return file;
}

export const singleMediaLimit=3*1024*1024;
export const mediaChunkSize=2*1024*1024;
export function strongMediaEtag(value:unknown):value is string{
 return typeof value==="string"&&/^"[A-Za-z0-9._:-]{1,128}"$/.test(value);
}
export async function readApprovedOriginalRange(id:string,offset:number,expectedEtag:string|null,resolve:()=>Promise<unknown>,read:(locator:Readonly<ExportMediaLocator>,start:number,end:number,etag:string|null,signal:AbortSignal)=>Promise<Response>,verify:()=>Promise<boolean>,signal:AbortSignal){
 if(!Number.isSafeInteger(offset)||offset<0||offset%mediaChunkSize!==0||(offset>0&&!strongMediaEtag(expectedEtag))||(offset===0&&expectedEtag!==null))throw Error("Invalid media range.");
 async function boundary(){if(signal.aborted||!await verify()||signal.aborted)throw Error("Media unavailable.");}
 await boundary();
 const first=Object.freeze(validMediaLocator(await resolve(),id));
 if(offset>=first.bytes)throw Error("Invalid media range.");
 const end=Math.min(first.bytes-1,offset+mediaChunkSize-1),length=end-offset+1;
 await boundary();
 const response=await read(first,offset,end,expectedEtag,signal);
 const etag=response.headers.get("etag");
 if(signal.aborted||response.status!==206||response.headers.get("content-range")!==`bytes ${offset}-${end}/${first.bytes}`||response.headers.get("content-length")!==String(length)||!strongMediaEtag(etag)||(expectedEtag!==null&&etag!==expectedEtag)||!response.body){
  await response.body?.cancel();throw Error("Media range unavailable.");
 }
 const buffer=new Uint8Array(length),reader=response.body.getReader();let written=0;
 try{
  for(;;){
   if(signal.aborted)throw Error("Media range cancelled.");
   const next=await reader.read();if(next.done)break;
   if(written+next.value.byteLength>length)throw Error("Media range size mismatch.");
   buffer.set(next.value,written);written+=next.value.byteLength;
  }
 }finally{try{await reader.cancel();}finally{reader.releaseLock();}}
 if(written!==length)throw Error("Media range size mismatch.");
 const last=validMediaLocator(await resolve(),id);
 if(JSON.stringify(first)!==JSON.stringify(last))throw Error("Media changed.");
 await boundary();
 if(Date.parse(last.expires_at)<=Date.now())throw Error("Media expired.");
 return {buffer,etag,start:offset,end,total:first.bytes};
}
