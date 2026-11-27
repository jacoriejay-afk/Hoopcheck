"use client";
import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {withHoopChatDeadline} from "../apps/mobile/src/native/hoopChatLoad";

const validId=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export default function HoopChatSafety({uid,requestId,peerId,disabled,isCurrent,onBlocked}:{uid:string;requestId:string;peerId:string;disabled:boolean;isCurrent:()=>boolean;onBlocked:()=>void}){
  const [mode,setMode]=useState<"report"|"block"|null>(null);
  const [reason,setReason]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>{pending.current?.abort();pending.current=null;},[]);
  if(!validId(uid)||!validId(requestId)||!validId(peerId)||uid===peerId)return null;

  async function submit(){
    const action=mode,clean=reason.trim();
    if(!action||disabled||pending.current||!isCurrent()||(action==="report"&&(clean.length<10||clean.length>500)))return;
    const request=new AbortController();pending.current=request;setBusy(true);setNotice("");
    const active=()=>pending.current===request&&!request.signal.aborted&&isCurrent();
    try{
      await withHoopChatDeadline(async signal=>{
        const {data:{session},error}=await supabase.auth.getSession();
        if(error||session?.user.id!==uid||!active()||signal.aborted)throw Error("Verify account.");
        const {data:{user},error:authError}=await supabase.auth.getUser(session.access_token);
        if(authError||user?.id!==uid||!active()||signal.aborted)throw Error("Verify account.");
        const header="Bearer "+session.access_token;
        const target=await supabase.from("player_contact_requests").select("id,requester_id,player_id").eq("id",requestId).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
        if(target.error||target.data?.id!==requestId||!((target.data.requester_id===uid&&target.data.player_id===peerId)||(target.data.player_id===uid&&target.data.requester_id===peerId))||!active()||signal.aborted)throw Error("Conversation unavailable.");
        if(action==="report"){
          const result=await supabase.from("support_tickets").insert({requester_id:uid,subject:"Report a private HoopChat conversation",category:"security",priority:"normal",description:"Conversation ID: "+requestId+"\nReported account ID: "+peerId+"\nReason: "+clean}).setHeader("Authorization",header).abortSignal(signal);
          if(result.error)throw Error("Report unconfirmed.");
        }else{
          const result=await supabase.from("user_blocks").insert({blocker_id:uid,blocked_id:peerId}).setHeader("Authorization",header).abortSignal(signal);
          if(result.error&&result.error.code!=="23505")throw Error("Block unconfirmed.");
          const row=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",uid).eq("blocked_id",peerId).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
          if(row.error||row.data?.blocked_id!==peerId)throw Error("Block unconfirmed.");
        }
      },undefined,request);
      if(!active())return;
      setMode(null);setReason("");
      if(action==="block")onBlocked();else setNotice("Confidential report submitted. Staff will review the details you provided.");
    }catch{if(active())setNotice("Action could not be confirmed. Check Settings or support tickets before retrying.");}
    finally{if(pending.current===request){pending.current=null;if(!request.signal.aborted&&isCurrent())setBusy(false);}}
  }

  return <section aria-label="Conversation safety" className="hc-courtside-compose">
    <div className="hc-courtside-thread-actions">
      <button type="button" disabled={disabled||busy} onClick={()=>{setMode("report");setNotice("");}}>Report conversation</button>
      <button type="button" disabled={disabled||busy} onClick={()=>{setMode("block");setNotice("");}}>Block account</button>
    </div>
    {mode?<><p>{mode==="block"?"Block this member? You can manage blocked accounts in Settings.":"Report a safety concern privately. Include only necessary information, not passwords, payment details or unrelated private messages."}</p>
      {mode==="report"?<label>Conversation report reason<textarea value={reason} maxLength={500} disabled={busy} onChange={event=>setReason(event.target.value)} placeholder="Reason (10–500 characters)"/></label>:null}
      <div className="hc-courtside-thread-actions"><button type="button" disabled={disabled||busy||(mode==="report"&&reason.trim().length<10)} onClick={()=>void submit()}>{busy?"Submitting…":mode==="block"?"Confirm block":"Submit confidential report"}</button>
      <button type="button" disabled={busy} onClick={()=>{setMode(null);setReason("");}}>Cancel</button></div>
    </>:null}
    {notice?<p role="status">{notice}</p>:null}
  </section>;
}
