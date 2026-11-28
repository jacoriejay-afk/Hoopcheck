// Shared owner-export media contract; callers never provide storage locators.
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export type ExportMediaItem={id:string;bytes:number};
export type ExportMediaManifest={id:string;complete:false;state:"pending_inventory"|"prepared";items:ExportMediaItem[];next_after:string|null;pending_count:number;denied_count:number};
const maxBytes=134217728;
const singleLimit=3*1024*1024,chunkSize=2*1024*1024;
function isObject(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function validCount(v:unknown):v is number{return typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;}
export function validateMediaManifest(v:unknown,job:string,after:string|null):ExportMediaManifest{
 if(!isObject(v)||v.id!==job||v.complete!==false||(v.state!=="prepared"&&v.state!=="pending_inventory")||!Array.isArray(v.items)||v.items.length>50||!validCount(v.pending_count)||!validCount(v.denied_count))throw Error("Media manifest unavailable.");
 const items:ExportMediaItem[]=v.items.map(x=>{
  if(!isObject(x)||typeof x.id!=="string"||!uuid.test(x.id)||!validCount(x.bytes)||x.bytes<1||x.bytes>maxBytes)throw Error("Media item unavailable.");
  return {id:x.id,bytes:x.bytes};
 });
 if(items.some((x,i)=>x.id<=(i?items[i-1].id:after??""))||!(v.next_after===null||items.length===50&&v.next_after===items.at(-1)?.id)||v.state==="pending_inventory"&&(items.length>0||v.next_after!==null))throw Error("Media manifest unavailable.");
 return {id:job,complete:false,state:v.state,items,next_after:v.next_after as string|null,pending_count:v.pending_count,denied_count:v.denied_count};
}
async function request(origin:string,token:string,body:Record<string,unknown>,signal:AbortSignal,fetcher:typeof fetch){
 const u=new URL(origin);
 if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash||!/^\S{1,16384}$/.test(token)||typeof body.job!=="string"||!uuid.test(body.job)||signal.aborted)throw Error("Media request unavailable.");
 u.pathname="/api/account/export-media";
 const r=await fetcher(u.toString(),{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(body),cache:"no-store",redirect:"error",signal});
 if(!r.ok||signal.aborted||(r.url&&r.url!==u.toString()))throw Error("Media unavailable.");
 return r;
}
export async function loadExportMedia(origin:string,token:string,job:string,after:string|null,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(after!==null&&!uuid.test(after))throw Error("Invalid media cursor.");
 const r=await request(origin,token,{action:"manifest",job,after},signal,fetcher);
 const v:unknown=await r.json();if(signal.aborted)throw Error("Media unavailable.");
 return validateMediaManifest(v,job,after);
}
export async function downloadExportMedia(origin:string,token:string,job:string,item:ExportMediaItem,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(!uuid.test(item.id)||!validCount(item.bytes)||item.bytes<1||item.bytes>maxBytes)throw Error("Invalid media item.");
 if(item.bytes>singleLimit)throw Error("Use bounded range delivery.");
 const r=await request(origin,token,{action:"download",job,item:item.id},signal,fetcher);
 if(r.headers.get("content-type")!=="application/octet-stream"||r.headers.get("content-length")!==String(item.bytes))throw Error("Media response mismatch.");
 const bytes=await r.arrayBuffer();
 if(signal.aborted||bytes.byteLength!==item.bytes)throw Error("Media response mismatch.");
 return new Uint8Array(bytes);
}

export async function downloadExportMediaToSink(origin:string,token:string,job:string,item:ExportMediaItem,signal:AbortSignal,write:(bytes:Uint8Array)=>Promise<void>|void,verify:()=>Promise<void>,progress:(done:number,total:number)=>void,fetcher:typeof fetch=fetch){
 if(!uuid.test(item.id)||!validCount(item.bytes)||item.bytes<1||item.bytes>maxBytes)throw Error("Invalid media item.");
 await verify();
 if(item.bytes<=singleLimit){
  const bytes=await downloadExportMedia(origin,token,job,item,signal,fetcher);
  await verify();if(signal.aborted)throw Error("Media cancelled.");
  await write(bytes);progress(item.bytes,item.bytes);return;
 }
 let etag:string|null=null;
 for(let offset=0;offset<item.bytes;offset+=chunkSize){
  await verify();if(signal.aborted)throw Error("Media cancelled.");
  const end=Math.min(item.bytes-1,offset+chunkSize-1),length=end-offset+1;
  const r=await request(origin,token,{action:"chunk",job,item:item.id,offset,etag},signal,fetcher);
  const received=r.headers.get("etag");
  if(r.status!==206||r.headers.get("content-type")!=="application/octet-stream"||r.headers.get("content-range")!==`bytes ${offset}-${end}/${item.bytes}`||r.headers.get("content-length")!==String(length)||!received||!/^"[A-Za-z0-9._:-]{1,128}"$/.test(received)||(etag!==null&&etag!==received))throw Error("Media range changed.");
  etag=received;
  const buffer=await r.arrayBuffer();if(buffer.byteLength!==length||signal.aborted)throw Error("Media range unavailable.");
  await verify();if(signal.aborted)throw Error("Media cancelled.");
  await write(new Uint8Array(buffer));progress(end+1,item.bytes);
 }
 await verify();
}
