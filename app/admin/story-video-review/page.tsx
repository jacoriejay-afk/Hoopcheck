"use client";
import {useEffect,useRef,useState} from "react";
import {supabase} from "../../../lib/supabase";
type Job={id:string;created_at:string;duration_ms:number;audio:boolean};
type Asset={id:string;fence:string;video_sha256:string;thumbnail_sha256:string;video_url:string;thumbnail_url:string;audio:boolean;expires_in:number};
const enabled=process.env.NEXT_PUBLIC_HOOPCHECK_VIDEO_STORY_HUMAN_REVIEW_ENABLED==="true";
export default function StoryVideoReview(){
 const [jobs,setJobs]=useState<Job[]>([]),[asset,setAsset]=useState<Asset|null>(null),[visual,setVisual]=useState(""),[audio,setAudio]=useState(""),[watched,setWatched]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const generation=useRef(0),lock=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  const reset=()=>{generation.current++;controller.current?.abort();setJobs([]);setAsset(null);setVisual("");setAudio("");setWatched(false);setMessage("");};
  const sub=supabase.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT"||event==="SIGNED_IN")reset();});
  const hidden=()=>{if(document.visibilityState==="hidden")reset();};document.addEventListener("visibilitychange",hidden);
  return()=>{generation.current++;controller.current?.abort();sub.data.subscription.unsubscribe();document.removeEventListener("visibilitychange",hidden);};
 },[]);
 async function act(payload:Record<string,unknown>){
  if(!enabled||lock.current)return;
  lock.current=true;setBusy(true);setMessage("");
  const rev=generation.current,c=new AbortController();controller.current=c;const timer=setTimeout(()=>c.abort(),15000);
  try{
   const session=await supabase.auth.getSession(),token=session.data.session?.access_token,uid=session.data.session?.user.id;
   if(session.error||!uid||!token||rev!==generation.current)throw Error("Verify account.");
   const r=await fetch("/api/hoopfeed/story-video-review",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",redirect:"error",signal:c.signal});
   const data=await r.json().catch(()=>null),after=await supabase.auth.getSession();
   if(!r.ok||!data||c.signal.aborted||rev!==generation.current||after.error||after.data.session?.user.id!==uid||after.data.session.access_token!==token)throw Error("Review unavailable.");
   if(payload.action==="queue"){if(!Array.isArray(data.jobs)||data.jobs.length>25)throw Error("Invalid queue.");setJobs(data.jobs);setAsset(null);}
   else if(payload.action==="asset"){
    const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||"https://invalid.invalid").origin;
    if(data.id!==payload.id||typeof data.audio!=="boolean"||typeof data.video_url!=="string"||typeof data.thumbnail_url!=="string"||new URL(data.video_url).origin!==origin||new URL(data.thumbnail_url).origin!==origin)throw Error("Invalid preview.");
    setAsset(data);setVisual("");setAudio(data.audio?"":"no_audio");setWatched(false);
   }else{
    if(data.id!==payload.id||data.published!==false||payload.action==="decision"&&data.recorded!==true||payload.action==="revoke"&&data.revoked!==true)throw Error("Decision unavailable.");
    setJobs(old=>old.filter(j=>j.id!==payload.id));setAsset(null);setMessage(payload.action==="revoke"?"Decision revoked.":"Moderation decision recorded. Publication remains disabled.");
   }
  }catch(e){if(rev===generation.current){setAsset(null);setMessage(e instanceof Error?e.message:"Review unavailable.");}}
  finally{clearTimeout(timer);if(controller.current===c)controller.current=null;lock.current=false;setBusy(false);}
 }
 return <main className="page-shell"><div className="page-container"><h1>Private Video Story review</h1><p>Authorized moderators only. Review the entire video and audio before recording a decision. Approval does not publish content.</p>{enabled?<><button type="button" disabled={busy} onClick={()=>void act({action:"queue"})}>Load pending video reviews</button>{message&&<p role="status">{message}</p>}{jobs.map(j=><article key={j.id} className="dashboard-card"><p>{Math.ceil(j.duration_ms/1000)} seconds · {j.audio?"Audio present":"No audio"}</p><button type="button" disabled={busy} onClick={()=>void act({action:"asset",id:j.id})}>Review private video</button></article>)}{asset&&<section className="dashboard-card"><video key={asset.fence} src={asset.video_url} poster={asset.thumbnail_url} controls playsInline preload="metadata" style={{width:"100%",maxHeight:440}} onEnded={()=>setWatched(true)} onError={()=>{setWatched(false);setMessage("Preview unavailable. Reopen the asset.");}}/><label>Visual decision <select value={visual} onChange={e=>setVisual(e.target.value)}><option value="">Choose decision</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label><label>Audio decision <select value={audio} disabled={!asset.audio} onChange={e=>setAudio(e.target.value)}><option value="">Choose decision</option>{asset.audio?<><option value="approved">Approved</option><option value="rejected">Rejected</option></>:<option value="no_audio">No audio present</option>}</select></label><p>Submitting attests that you reviewed all visual and audio content.</p><button type="button" disabled={busy||!watched||!visual||!audio} onClick={()=>void act({action:"decision",id:asset.id,fence:asset.fence,video_sha256:asset.video_sha256,thumbnail_sha256:asset.thumbnail_sha256,visual,audio,attested:true})}>Record decision</button></section>}</>:<p>Review is not enabled.</p>}</div></main>;
}
