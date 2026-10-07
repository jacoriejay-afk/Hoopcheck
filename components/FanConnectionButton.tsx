"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type RequestRow={id:string;requester_id:string;fan_id:string;message:string|null;status:string;created_at:string};

export default function FanConnectionButton({fanId}:{fanId:string}){
  const [userId,setUserId]=useState(""); const [allowed,setAllowed]=useState(false); const [request,setRequest]=useState<RequestRow|null>(null);
  const [message,setMessage]=useState(""); const [info,setInfo]=useState(""); const [busy,setBusy]=useState(false);

  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
    setUserId(user.id);
    const [{data:p},{data:s},{data:r}]=await Promise.all([
      supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status").eq("user_id",user.id).maybeSingle(),
      supabase.from("fan_connection_requests").select("id,requester_id,fan_id,message,status,created_at").or(`requester_id.eq.${user.id},fan_id.eq.${user.id}`).eq("fan_id",fanId).maybeSingle()
    ]);
    setAllowed(p?.account_type==="fan" && ["pro","premium"].includes(s?.plan||"") && ["active","trialing"].includes(s?.status||""));
    setRequest((r||null) as RequestRow|null);
  }
  useEffect(()=>{void load()},[fanId]);

  async function send(){
    if(!userId){location.href="/login";return;} setBusy(true);setInfo("");
    const {error}=await supabase.from("fan_connection_requests").insert({requester_id:userId,fan_id:fanId,message:message.trim()||null});
    if(error)setInfo(error.message); else {setInfo("Fan request sent. They must accept before the connection is active.");setMessage("");await load();}
    setBusy(false);
  }
  async function respond(status:"accepted"|"rejected"){
    if(!request?.id)return; setBusy(true);setInfo("");
    const {error}=await supabase.from("fan_connection_requests").update({status,responded_at:new Date().toISOString()}).eq("id",request.id).eq("fan_id",userId);
    if(error)setInfo(error.message); else {setInfo(status==="accepted"?"Fan connection accepted.":"Fan request declined.");await load();}
    setBusy(false);
  }

  if(!allowed)return <div className="contact-gate"><strong>Pro/Premium Fan feature</strong><p className="muted">Upgrade to Pro or Premium to send fan requests.</p></div>;
  if(userId===fanId)return null;
  if(request?.status==="pending" && request.fan_id===userId)return <div className="contact-gate"><strong>Fan request received</strong><p className="muted">{request.message||"Another fan wants to connect with you."}</p><div className="actions"><button className="btn" onClick={()=>void respond("accepted")} disabled={busy}>Accept</button><button className="btn dark" onClick={()=>void respond("rejected")} disabled={busy}>Decline</button></div>{info&&<p className="muted">{info}</p>}</div>;
  if(request?.status==="pending")return <div className="contact-gate"><strong>Fan request pending</strong><p className="muted">This fan has not responded yet.</p></div>;
  if(request?.status==="accepted")return <div className="contact-gate"><strong>Connected fan</strong><p className="muted">You are connected with this fan.</p></div>;
  if(request?.status==="rejected")return <div className="contact-gate"><strong>Request declined</strong><p className="muted">This fan declined the request.</p></div>;
  return <div className="contact-box"><span className="card-kicker">FAN CONNECTION</span><h3>Connect with this fan</h3><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={2} maxLength={500} placeholder="Optional message..." /><button className="btn" onClick={()=>void send()} disabled={busy}>{busy?"Sending...":"Send Fan Request"}</button>{info&&<p className="muted">{info}</p>}</div>;
}
