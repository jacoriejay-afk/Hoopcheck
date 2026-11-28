// Scheduler entry point. No hosted registration and no default configuration.
// Run only from an approved private worker environment; never in a browser.
import { createClient } from "@supabase/supabase-js";
const allowed=new Set(["disabled","idle","ready","retry","failed"]);
if(process.env.ACCOUNT_EXPORT_WORKER_ENABLED!=="true"){
 console.log("account_export_worker: disabled");
}else{
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw Error("configuration");
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const r=await client.rpc("run_account_export_worker").abortSignal(AbortSignal.timeout(90000));
  if(r.error||!allowed.has(r.data))throw Error("worker failed");
  console.log("account_export_worker: "+r.data);
  if(r.data==="failed"||r.data==="retry")process.exitCode=1;
  if(process.env.ACCOUNT_EXPORT_MEDIA_WORKER_ENABLED==="true"&&["idle","ready"].includes(r.data)){
   const media=await client.rpc("prepare_next_account_export_media").abortSignal(AbortSignal.timeout(90000));
   if(media.error||!media.data||!["disabled","idle","prepared"].includes(media.data.status))throw Error("media inventory unavailable");
   console.log("account_export_media_worker: "+media.data.status);
  }
 }catch{
  console.error("account_export_worker: unavailable");
  process.exitCode=1;
 }
}
