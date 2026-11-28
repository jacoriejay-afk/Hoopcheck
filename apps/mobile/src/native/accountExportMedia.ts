// Shared owner-export media contract; callers never provide storage locators.
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export type ExportMediaItem={id:string;bytes:number};
export type ExportMediaManifest={id:string;complete:false;state:"pending_inventory"|"prepared";items:ExportMediaItem[];next_after:string|null;pending_count:number;denied_count:number};
const maxBytes=20971520;
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
 const r=await request(origin,token,{action:"download",job,item:item.id},signal,fetcher);
 if(r.headers.get("content-type")!=="application/octet-stream"||r.headers.get("content-length")!==String(item.bytes))throw Error("Media response mismatch.");
 const bytes=await r.arrayBuffer();
 if(signal.aborted||bytes.byteLength!==item.bytes)throw Error("Media response mismatch.");
 return new Uint8Array(bytes);
}
