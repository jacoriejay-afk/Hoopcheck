"use client";
import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {requestPlayerReference,referenceLabels,type ReferenceAction,type ReferenceState} from "../apps/mobile/src/native/playerReferences";
export default function PlayerReferencePanel({userId,connectionId}:{userId:string;connectionId:string}){
 const [state,setState]=useState<ReferenceState|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const active=useRef(false),lock=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  active.current=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user.id!==userId){active.current=false;controller.current?.abort();setState(null);setMessage("");}});
  return()=>{active.current=false;controller.current?.abort();subscription.unsubscribe();};
 },[userId,connectionId]);
 async function act(action:ReferenceAction){
  if(!active.current||lock.current||process.env.NEXT_PUBLIC_HOOPCHECK_PLAYER_REFERENCES_ENABLED!=="true")return;
  lock.current=true;setBusy(true);setMessage("");const abort=new AbortController();controller.current=abort;const deadline=setTimeout(()=>abort.abort(),12000);
  try{const {data,error}=await supabase.auth.getSession();if(error||data.session?.user.id!==userId||!active.current||abort.signal.aborted)throw Error("Session changed");
   const result=await requestPlayerReference("/api/player-references",data.session.access_token,connectionId,action,abort.signal);
   const after=await supabase.auth.getSession();if(!active.current||abort.signal.aborted||after.error||after.data.session?.user.id!==userId)return;
   setState(result);
  }catch{if(active.current){setState(null);setMessage("Reference state unavailable. Only eligible verified player connections can use this feature. Refresh before retrying.");}}
  finally{clearTimeout(deadline);lock.current=false;if(active.current)setBusy(false);}
 }
 if(process.env.NEXT_PUBLIC_HOOPCHECK_PLAYER_REFERENCES_ENABLED!=="true")return null;
 return <section aria-label="Private reference consent" className="dashboard-card"><h3>Player reference</h3><p>Both verified players must have an accepted connection. Agreement is only consent to discuss basketball experience, not an endorsement, public rating or permission to share private documents. Either participant can withdraw consent; requests expire after 30 days.</p><button type="button" className="btn dark" disabled={busy} onClick={()=>void act("read")}>{busy?"Checking…":"Check reference status"}</button>
 {state?<div><p role="status">{referenceLabels[state.state]}</p>{state.canRequest?<button type="button" className="btn" disabled={busy} onClick={()=>void act("request")}>Request reference consent</button>:null}{state.canRespond?<><button type="button" className="btn" disabled={busy} onClick={()=>void act("accept")}>Agree to discuss</button><button type="button" className="btn dark" disabled={busy} onClick={()=>void act("decline")}>Decline</button></>:null}{state.canRevoke?<button type="button" className="btn dark" disabled={busy} onClick={()=>void act("revoke")}>Withdraw consent / request</button>:null}</div>:null}{message?<p role="alert">{message}</p>:null}</section>;
}
