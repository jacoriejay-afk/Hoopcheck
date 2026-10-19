"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ResponseRow = { id:string; body:string; created_at:string; responder_id:string };

export default function OfficialReviewResponse({reviewId,entityType,entityId,entityName}:{
  reviewId:string;entityType:"team"|"coach";entityId:string;entityName:string;
}) {
  const [response,setResponse] = useState<ResponseRow|null>(null);
  const [canRespond,setCanRespond] = useState(false);
  const [draft,setDraft] = useState("");
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");

  useEffect(()=>{
    let active=true;
    void (async()=>{
      const {data:existing}=await supabase.from("review_official_responses").select("id,body,created_at,responder_id").eq("review_id",reviewId).maybeSingle();
      if(active&&existing)setResponse(existing as ResponseRow);
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.user||existing)return;
      const {data:claim}=await supabase.from("profile_claim_requests").select("id").eq("requester_id",session.user.id).eq("entity_type",entityType).eq("entity_id",entityId).eq("status","approved").maybeSingle();
      if(active)setCanRespond(Boolean(claim));
    })();
    return ()=>{active=false;};
  },[reviewId,entityId,entityType]);

  async function submit() {
    const body=draft.trim();
    if(!body||body.length>2000||busy)return;
    setBusy(true);setMessage("");
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.user){setMessage("Sign in with the approved organization account to respond.");setBusy(false);return;}
    const {data,error}=await supabase.from("review_official_responses").insert({
      review_id:reviewId,entity_type:entityType,entity_id:entityId,responder_id:session.user.id,body
    }).select("id,body,created_at,responder_id").single();
    if(error)setMessage(error.code==="23505"?"An official response has already been posted under this review.":"Unable to post the official response. Please try again.");
    else {setResponse(data as ResponseRow);setDraft("");setOpen(false);}
    setBusy(false);
  }

  if(response)return <aside className="hc-official-response"><div className="hc-official-response__label"><span className="hc-official-response__crest">{entityName.split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()}</span><span><strong>Official response</strong><small>{entityName} · {new Date(response.created_at).toLocaleDateString()}</small></span></div><p>{response.body}</p></aside>;
  if(!canRespond)return null;
  return <div className="hc-official-response-action"><button type="button" onClick={()=>setOpen(value=>!value)}>{open?"Cancel":"Post official response"}</button>{open&&<div className="hc-official-response-form"><label>Official response<textarea value={draft} onChange={event=>setDraft(event.target.value)} maxLength={2000} rows={4} placeholder="Respond professionally to the player's review…"/></label><small>One response per review. Responses cannot edit or hide player reviews.</small>{message&&<p role="status">{message}</p>}<button type="button" className="btn" disabled={busy||!draft.trim()} onClick={()=>void submit()}>{busy?"Posting…":"Publish Official Response"}</button></div>}</div>;
}
