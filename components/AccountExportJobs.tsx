"use client";
import { useEffect,useRef,useState } from "react";
import { supabase } from "../lib/supabase";
import {loadExportMedia,downloadExportMedia,type ExportMediaManifest,type ExportMediaItem} from "../apps/mobile/src/native/accountExportMedia";
const mediaEnabled=process.env.NEXT_PUBLIC_ACCOUNT_EXPORT_MEDIA_ENABLED==="true";

type Job={id:string;state:string;row_count:number;expires_at:string|null};
type Action="request"|"status"|"cancel"|"download";
export default function AccountExportJobs({uid}:{uid:string}){
 const [job,setJob]=useState<Job|null>(null),[after,setAfter]=useState<number|null>(0),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [media,setMedia]=useState<ExportMediaManifest|null>(null);
 const current=useRef<AbortController|null>(null),active=useRef(true),key=useRef<string|null>(null);
 useEffect(()=>{
  active.current=true;
  const sub=supabase.auth.onAuthStateChange((event,session)=>{
   if(event==="SIGNED_OUT"||session?.user.id!==uid){active.current=false;current.current?.abort();setJob(null);setMedia(null);setAfter(0);setMessage("");}
  });
  return()=>{active.current=false;current.current?.abort();sub.data.subscription.unsubscribe();};
 },[uid]);
 async function action(kind:Action){
  if(!active.current||current.current)return;
  const id=job?.id??key.current??crypto.randomUUID();
  key.current=id;
  const cursor=kind==="download"?after:0;
  if(cursor===null)return;
  const c=new AbortController();current.current=c;setBusy(true);setMessage("");
  const timeout=setTimeout(()=>c.abort(),30000);
  try{
   const session=await supabase.auth.getSession();
   if(session.error||session.data.session?.user.id!==uid||!active.current||c.signal.aborted)throw Error("account");
   const token=session.data.session.access_token;
   const result=await fetch("/api/account/export-job",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action:kind,job:id,after:cursor}),cache:"no-store",redirect:"error",signal:c.signal});
   if(!result.ok)throw Error("unavailable");
   const value=await result.json();
   const verified=await supabase.auth.getUser(token),latest=await supabase.auth.getSession();
   if(verified.error||verified.data.user?.id!==uid||latest.error||latest.data.session?.user.id!==uid||latest.data.session.access_token!==token||!active.current||c.signal.aborted)throw Error("account");
   if(kind==="download"){
    if(value.id!==id||value.complete!==false||!Array.isArray(value.rows)||Date.parse(value.expires_at)<=Date.now())throw Error("unavailable");
    const href=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
    try{const a=document.createElement("a");a.href=href;a.download="hoopcheck-export-"+id+"-after-"+cursor+".json";a.click();}
    finally{setTimeout(()=>URL.revokeObjectURL(href),1000);}
    setAfter(value.next_after);
    setMessage(value.next_after===null?"All available pages downloaded. This is not a complete legal data export.":"Page downloaded. Continue for the next page.");
   }else{
    setJob(value);key.current=value.id;
    if(value.state!=="ready")setMedia(null);
    if(kind==="cancel")setAfter(0);
    setMessage(kind==="request"?"Export job located. Check its status before downloading.":"Export status updated.");
   }
  }catch{if(active.current)setMessage("Export action could not be confirmed. Refresh or retry with the same job.");}
  finally{clearTimeout(timeout);if(current.current===c){current.current=null;if(active.current)setBusy(false);}}
 }
 async function mediaAction(item?:ExportMediaItem,next=false){
  if(!mediaEnabled||!active.current||current.current||job?.state!=="ready"||!job.expires_at||Date.parse(job.expires_at)<=Date.now())return;
  const id=job.id,expiry=job.expires_at;
  const c=new AbortController();current.current=c;setBusy(true);setMessage("");
  const timer=setTimeout(()=>c.abort(),65000);
  try{
   const session=await supabase.auth.getSession();
   if(session.error||session.data.session?.user.id!==uid)throw Error("account");
   const token=session.data.session.access_token;
   const verify=async()=>{const user=await supabase.auth.getUser(token),latest=await supabase.auth.getSession();if(user.error||user.data.user?.id!==uid||latest.error||latest.data.session?.user.id!==uid||latest.data.session.access_token!==token||!active.current||c.signal.aborted||Date.parse(expiry)<=Date.now())throw Error("account");};
   await verify();
   if(item){
    const bytes=await downloadExportMedia(window.location.origin,token,id,item,c.signal);
    await verify();
    const href=URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer],{type:"application/octet-stream"}));
    try{const a=document.createElement("a");a.href=href;a.download="hoopcheck-original-"+item.id+".bin";a.click();}finally{setTimeout(()=>URL.revokeObjectURL(href),1000);}
    setMessage("Approved original downloaded.");
   }else{
    const value=await loadExportMedia(window.location.origin,token,id,next?media?.next_after??null:null,c.signal);
    await verify();setMedia(value);
   }
  }catch{if(active.current){setMedia(null);setMessage("Media could not be verified. Refresh to retry.");}}
  finally{clearTimeout(timer);if(current.current===c){current.current=null;if(active.current)setBusy(false);}}
 }
 return <section aria-label="Personal data export">
  <h2>Personal data export</h2>
  <p>Request and download an available copy of selected records. This pilot is not complete privacy-request fulfillment.</p>
  {!job?<button className="btn" disabled={busy} onClick={()=>void action("request")}>Request or resume export</button>:<>
   <p role="status">Status: {job.state} · {job.row_count} records</p>
   {job.expires_at&&<p>Download expires: {new Date(job.expires_at).toLocaleString()}</p>}
   <button className="btn" disabled={busy} onClick={()=>void action("status")}>Refresh export</button>
   {job.state==="ready"&&<><button className="btn" disabled={busy||after===null} onClick={()=>void action("download")}>Download {after===0?"first":"next"} page</button><button className="btn" disabled={busy} onClick={()=>setAfter(0)}>Restart download</button></>}
   {mediaEnabled&&job.state==="ready"&&<section aria-label="Approved original media">
    <h3>Original media</h3><p>Only individually approved files are available. Other files may require review.</p>
    <button className="btn" disabled={busy} onClick={()=>void mediaAction()}>Refresh approved originals</button>
    {media&&<><p role="status">{media.state==="pending_inventory"?"Inventory not prepared":media.pending_count+" pending · "+media.denied_count+" not approved"}</p>
     {media.items.map(item=><button key={item.id} className="btn" disabled={busy} onClick={()=>void mediaAction(item)}>Download original {item.id.slice(0,8)} ({Math.ceil(item.bytes/1024)} KB)</button>)}
     {media.next_after&&<button className="btn" disabled={busy} onClick={()=>void mediaAction(undefined,true)}>Next media page</button>}
    </>}
   </section>}
   {["queued","ready"].includes(job.state)?<button className="btn" disabled={busy} onClick={()=>void action("cancel")}>Cancel export</button>:<button className="btn" disabled={busy} onClick={()=>{setJob(null);setMedia(null);setAfter(0);key.current=null;}}>New export</button>}
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
