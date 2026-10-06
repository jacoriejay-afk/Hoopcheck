"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type RequestRow = { id:string; requester_id:string; player_id:string; message:string|null; status:string; created_at:string; };
type MessageRow = { id:string; request_id:string; sender_id:string; body:string; created_at:string; };

export default function PlayerContactButton({ playerId }: { playerId:string }) {
  const [userId,setUserId]=useState("");
  const [accountType,setAccountType]=useState("");
  const [premium,setPremium]=useState(false);
  const [request,setRequest]=useState<RequestRow|null>(null);
  const [message,setMessage]=useState("");
  const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [info,setInfo]=useState("");
  const [messages,setMessages]=useState<MessageRow[]>([]);

  async function load(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){return;}
    setUserId(user.id);
    const {data:p}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
    setAccountType(p?.account_type||"");
    const {data:s}=await supabase.from("subscriptions").select("plan,status").eq("user_id",user.id).maybeSingle();
    setPremium(s?.plan==="premium" && (s?.status==="active" || s?.status==="trialing"));
    const {data:r}=await supabase.from("player_contact_requests").select("id,requester_id,player_id,message,status,created_at").or(`requester_id.eq.${user.id},player_id.eq.${user.id}`).eq("player_id",playerId).maybeSingle();
    setRequest(r as RequestRow|null);
    if(r?.status==="accepted"){
      const {data:m}=await supabase.from("player_contact_messages").select("id,request_id,sender_id,body,created_at").eq("request_id",r.id).order("created_at",{ascending:true});
      setMessages((m||[]) as MessageRow[]);
    }
  }
  useEffect(()=>{void load()},[playerId]);

  async function sendRequest(){
    if(!userId){location.href="/login";return;}
    setBusy(true);setInfo("");
    const {error}=await supabase.from("player_contact_requests").insert({requester_id:userId,player_id:playerId,message:message.trim()||null});
    setInfo(error ? error.message : "Contact request sent. The player must accept before you can message them.");
    if(!error){setRequest({id:"",requester_id:userId,player_id:playerId,message:message.trim()||null,status:"pending",created_at:new Date().toISOString()});}
    setBusy(false);
  }

  async function respond(status:"accepted"|"rejected"){
    if(!request?.id)return;
    setBusy(true);setInfo("");
    const {error}=await supabase.from("player_contact_requests").update({status,responded_at:new Date().toISOString()}).eq("id",request.id).eq("player_id",userId);
    setInfo(error ? error.message : status==="accepted" ? "Request accepted. You can now message this contact." : "Request declined.");
    if(!error){setRequest({...request,status});}
    setBusy(false);
  }

  async function sendMessage(){
    if(!request?.id || !draft.trim())return;
    setBusy(true);setInfo("");
    const {error}=await supabase.from("player_contact_messages").insert({request_id:request.id,sender_id:userId,body:draft.trim()});
    if(error)setInfo(error.message); else {setDraft(""); const {data:m}=await supabase.from("player_contact_messages").select("id,request_id,sender_id,body,created_at").eq("request_id",request.id).order("created_at",{ascending:true});setMessages((m||[]) as MessageRow[]);}
    setBusy(false);
  }

  if(accountType==="scout" || accountType==="agent"){
    if(!premium)return <div className="contact-gate"><strong>Premium Scout/Agent feature</strong><p className="muted">Upgrade to Premium to request contact with professional players. Players control whether requests are accepted.</p></div>;
    if(request?.status==="accepted")return <div className="contact-box"><span className="card-kicker">CONTACT ACCEPTED</span><h3>You can now get in touch</h3><div className="contact-messages">{messages.map(m=><div key={m.id} className={m.sender_id===userId?"contact-message mine":"contact-message"}>{m.body}<small>{new Date(m.created_at).toLocaleString()}</small></div>)}</div><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a message to the player..." rows={3}/><button className="btn" onClick={()=>void sendMessage()} disabled={busy||!draft.trim()}>{busy?"Sending...":"Send Message"}</button>{info&&<p className="muted">{info}</p>}</div>;
    if(request?.status==="pending")return <div className="contact-gate"><strong>Contact request pending</strong><p className="muted">The player will decide whether to accept your request.</p></div>;
    if(request?.status==="rejected")return <div className="contact-gate"><strong>Request declined</strong><p className="muted">This player declined the contact request.</p></div>;
    return <div className="contact-box"><span className="card-kicker">PREMIUM SCOUT / AGENT</span><h3>Get in touch with this player</h3><p className="muted">Send a request. The player must accept before either side can message.</p><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Introduce yourself and explain the opportunity..." rows={3}/><button className="btn" onClick={()=>void sendRequest()} disabled={busy}>{busy?"Sending...":"Request Contact"}</button>{info&&<p className="muted">{info}</p>}</div>;
  }

  if(accountType==="player" && request?.player_id===userId && request.status==="pending"){
    return <div className="contact-box"><span className="card-kicker">CONTACT REQUEST</span><h3>Someone wants to connect with you</h3><p className="muted">{request.message||"A premium scout or agent would like to get in touch."}</p><div className="actions"><button className="btn" onClick={()=>void respond("accepted")} disabled={busy}>Accept</button><button className="btn dark" onClick={()=>void respond("rejected")} disabled={busy}>Decline</button></div>{info&&<p className="muted">{info}</p>}</div>;
  }
  if(accountType==="player" && request?.player_id===userId && request.status==="accepted"){
    return <div className="contact-box"><span className="card-kicker">CONTACT</span><h3>Accepted contact</h3><div className="contact-messages">{messages.map(m=><div key={m.id} className={m.sender_id===userId?"contact-message mine":"contact-message"}>{m.body}<small>{new Date(m.created_at).toLocaleString()}</small></div>)}</div><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a reply..." rows={3}/><button className="btn" onClick={()=>void sendMessage()} disabled={busy||!draft.trim()}>{busy?"Sending...":"Send Message"}</button></div>;
  }
  return null;
}
