type Action="identity"|"issue"|"consume"|"sync";
const paths:Record<Action,string>={identity:"identity",issue:"issue",consume:"consume",sync:"sync"};
export function createPlaySandboxTransport(origin:string,enabled:()=>boolean,request:typeof fetch=fetch){
 let root:string|null=null;
 try{const u=new URL(origin);if(u.protocol==="https:"&&u.pathname==="/"&&!u.username&&!u.password&&!u.search&&!u.hash&&
  !/(^|\.)hoopcheck\.online$/i.test(u.hostname)&&u.hostname!=="ucbdceaieyenljcwlhnj.supabase.co")root=u.origin;}catch{}
 return async(action:Action,token:string,body?:Record<string,unknown>):Promise<unknown>=>{
  if(!root||!enabled()||!Object.hasOwn(paths,action)||typeof token!=="string"||!token||token.length>16384)return null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const reply=await request(root+"/api/mobile/play/runtime/"+paths[action],{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(body??{}),redirect:"error",cache:"no-store",signal:controller.signal});
   if(!enabled()||!reply.ok||reply.redirected||Number(reply.headers.get("content-length"))>8192)return null;
   const text=await reply.text();if(text.length>8192||!enabled())return null;
   return JSON.parse(text) as unknown;
  }catch{return null;}finally{clearTimeout(timer);}
 };
}
