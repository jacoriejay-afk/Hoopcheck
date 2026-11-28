import "server-only";
import {authenticatePlayPush} from "./push-auth";
import {ingestPlayPush,reconcileOnePlayNotification} from "./notification-worker";
import type {createDisposablePlayAdapters} from "./disposable-adapters";
import type {createDisposablePlayRuntime} from "./disposable-runtime";
import type {createPlayTokenVault} from "./token-vault";
type Config={audience:string;email:string;subject:string;subscription:string};
const response=(status:number)=>new Response(null,{status,headers:{"Cache-Control":"no-store"}});
/** Explicitly registered disposable endpoint and worker. Default off; never
 * schedules a job or contacts Google unless an approved transport is injected. */
export function createPlayNotificationRuntime(p:{
 scope:"disposable_pg17";enabled?:()=>boolean;config:Config;
 db:ReturnType<typeof createDisposablePlayAdapters>;runtime:ReturnType<typeof createDisposablePlayRuntime>;
 vault:ReturnType<typeof createPlayTokenVault>;keyRequest:typeof fetch;now:()=>number;
}){
 if(p.scope!=="disposable_pg17")throw Error("Disposable Play runtime required");
 const config=Object.freeze({...p.config}),enabled=()=>p.enabled?.()===true;
 const fingerprint=(token:string)=>p.vault.fingerprint(token,"test");
 return {
  async POST(request:Request){
   if(!enabled())return response(503);
   if(request.method!=="POST")return response(405);
   if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??"")||Number(request.headers.get("content-length"))>65536||!request.body)return response(400);
   try{
    const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];
    try{for(;;){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>65536){await reader.cancel();return response(413);}chunks.push(v.value);}}finally{reader.releaseLock();}
    const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));
    const result=await ingestPlayPush(value,request.headers.get("authorization"),{enabled,authenticate:a=>authenticatePlayPush(a,config,p.keyRequest,p.now()),subscription:config.subscription,fingerprint,enqueue:p.db.enqueue,now:p.now});
    return response(result==="accepted"?204:503);
   }catch{return response(400);}
  },
  tick:()=>reconcileOnePlayNotification({enabled,lease:p.db.lease,lookup:p.db.lookup,open:async c=>p.vault.open(await p.db.credential(c),c.owner,"test"),fingerprint,begin:p.db.begin,verify:p.runtime.notificationVerify,complete:p.db.complete,finish:p.db.finish,now:p.now})
 };
}
