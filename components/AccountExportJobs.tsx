"use client";
import { useEffect,useRef,useState } from "react";
import { supabase } from "../lib/supabase";

type Job={id:string;state:string;row_count:number;expires_at:string|null};
type Action="request"|"status"|"cancel"|"download";
export default function AccountExportJobs({uid}:{uid:string}){
 const [job,setJob]=useState<Job|null>(null),[after,setAfter]=useState<number|null>(0),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const current=useRef<AbortController|null>(null),active=useRef(true),key=useRef<string|null>(null);
 useEffect(()=>{
  active.current=true;
  const sub=supabase.auth.onAuthStateChange((event,session)=>{
   if(event==="SIGNED_OUT"||session?.user.id!==uid){active.current=false;current.current?.abort();setJob(null);setAfter(0);setMessage("");}
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
    if(kind==="cancel")setAfter(0);
    setMessage(kind==="request"?"Export job located. Check its status before downloading.":"Export status updated.");
   }
  }catch{if(active.current)setMessage("Export action could not be confirmed. Refresh or retry with the same job.");}
  finally{clearTimeout(timeout);if(current.current===c){current.current=null;if(active.current)setBusy(false);}}
 }
 return <section aria-label="Personal data export">
  <h2>Personal data export</h2>
  <p>Request and download an available copy of selected records. This pilot is not complete privacy-request fulfillment.</p>
  {!job?<button className="btn" disabled={busy} onClick={()=>void action("request")}>Request or resume export</button>:<>
   <p role="status">Status: {job.state} · {job.row_count} records</p>
   {job.expires_at&&<p>Download expires: {new Date(job.expires_at).toLocaleString()}</p>}
   <button className="btn" disabled={busy} onClick={()=>void action("status")}>Refresh export</button>
   {job.state==="ready"&&<><button className="btn" disabled={busy||after===null} onClick={()=>void action("download")}>Download {after===0?"first":"next"} page</button><button className="btn" disabled={busy} onClick={()=>setAfter(0)}>Restart download</button></>}
   {["queued","ready"].includes(job.state)?<button className="btn" disabled={busy} onClick={()=>void action("cancel")}>Cancel export</button>:<button className="btn" disabled={busy} onClick={()=>{setJob(null);setAfter(0);key.current=null;}}>New export</button>}
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
