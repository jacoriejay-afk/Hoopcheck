"use client";
import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {exitReasons,membershipExitTicket,type ExitReason} from "../apps/mobile/src/native/membershipExitFeedback";
export default function MembershipExitFeedback({uid}:{uid:string}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState<ExitReason|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[done,setDone]=useState(false);
 const live=useRef(true),locked=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 async function submit(){
  const ticket=membershipExitTicket(reason);
  if(!consent||!ticket||locked.current||done||process.env.NEXT_PUBLIC_HOOPCHECK_EXIT_FEEDBACK_ENABLED!=="true")return;
  locked.current=true;setBusy(true);setMessage("");
  try{const {data,error}=await supabase.auth.getUser();if(error||data.user?.id!==uid||!live.current)throw Error("Account changed");
   const result=await supabase.from("support_tickets").insert({requester_id:uid,...ticket});if(result.error)throw Error("Unavailable");
   if(live.current){setDone(true);setMessage("Thank you. Feedback submitted; your membership and renewal have not changed.");}
  }catch{if(live.current)setMessage("Could not confirm submission. Check your support tickets before trying again.");}
  finally{locked.current=false;if(live.current)setBusy(false);}
 }
 return <section className="dashboard-card" aria-label="Optional membership feedback"><h2>Help us improve</h2><p>Thinking about leaving? Share optional feedback. You can manage or cancel your subscription without answering.</p><button className="btn" type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?"Hide feedback":"Give optional feedback"}</button>
 {open?<div>{!done?<><fieldset disabled={busy}><legend>Reason</legend>{exitReasons.map(r=><label key={r.id} style={{display:"block"}}><input type="radio" name="exit-reason" checked={reason===r.id} onChange={()=>setReason(r.id)}/>{r.label}</label>)}</fieldset><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> Send this reason to authorized support staff with my account. This is not anonymous.</label><button type="button" className="btn" disabled={!reason||!consent||busy} onClick={()=>void submit()}>{busy?"Submitting…":"Submit feedback"}</button></>:null}{message?<p role="status">{message}</p>:null}</div>:null}</section>;
}
