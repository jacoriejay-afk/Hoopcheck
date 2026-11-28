import "server-only";
import type {createDisposablePlayRuntime} from "./disposable-runtime";
type Runtime=ReturnType<typeof createDisposablePlayRuntime>;
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** In-process test transport. No deployed route or provider credentials. */
export function createDisposablePlayHandler(runtime:Runtime,scope:"disposable_pg17",approvedOrigin="https://fixture.invalid"){
 if(scope!=="disposable_pg17")throw Error("Disposable runtime required");
 const origin=new URL(approvedOrigin);
 if(origin.protocol!=="https:"||origin.href!==origin.origin+"/"||/(^|\.)hoopcheck\.online$/i.test(origin.hostname)||origin.hostname==="ucbdceaieyenljcwlhnj.supabase.co")throw Error("Isolated runtime origin required");
 return async(request:Request):Promise<Response>=>{
  try{
   const url=new URL(request.url);
   if(url.origin!==origin.origin||url.search||request.method!=="POST")return response(null,404);
   const action=url.pathname.match(/^\/api\/mobile\/play\/runtime\/(identity|issue|consume|sync|replacement)$/)?.[1];
   if(!action||!request.headers.get("content-type")?.startsWith("application/json"))return response(null,400);
   const reader=request.body?.getReader();if(!reader)return response(null,400);
   const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const v=await reader.read();if(v.done)break;size+=v.value.byteLength;if(size>8192){await reader.cancel();return response(null,413);}chunks.push(v.value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   const raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes),body:unknown=JSON.parse(raw);
   if(!body||typeof body!=="object"||Array.isArray(body))return response(null,400);
   const b=body as Record<string,unknown>;
   const verifiedRequest=new Request(request.url,{method:"POST",headers:request.headers,body:raw});
   if(action==="issue"||action==="consume")return runtime.intent(verifiedRequest,action);
   if(action==="identity"){if(Object.keys(b).length)return response(null,400);const result=await runtime.identity(verifiedRequest);return response(result,result?200:403);}
   if(action==="replacement"){
    if(Object.keys(b).sort().join(",")!=="intentId,oldToken"||typeof b.intentId!=="string"||typeof b.oldToken!=="string")return response(null,400);
    const result=await runtime.reviewReplacement(verifiedRequest,b.intentId,b.oldToken);return response(result,result?200:403);
   }
   if(Object.keys(b).some(k=>!["productId","purchaseToken","intentId"].includes(k))||typeof b.productId!=="string"||typeof b.purchaseToken!=="string"||(b.intentId!==null&&typeof b.intentId!=="string"))return response(null,400);
   const result=await runtime.sync(verifiedRequest,b.productId,b.purchaseToken,b.intentId);return response(result,result?200:403);
  }catch{return response(null,400);}
 };
}
