"use client";

import { useEffect, useState } from "react";
import { getCachedSession, supabase } from "../lib/supabase";

type RequestRow = { id:string; requester_id:string; player_id:string; message:string|null; status:string; created_at:string; };
type MessageRow = { id:string; request_id:string; sender_id:string; body:string; created_at:string; };

export default function PlayerContactButton({ playerId, compact = false }: { playerId:string; compact?: boolean }) {
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
    const {data:{session}}=await getCachedSession();
    const user=session?.user;
    if(!user){return;}
    setUserId(user.id);
    const [profileResult,subscriptionResult,requestResult]=await Promise.all([
      supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status").eq("user_id",user.id).maybeSingle(),
      supabase.from("player_contact_requests").select("id,requester_id,player_id,message,status,created_at").or(`requester_id.eq.${user.id},player_id.eq.${user.id}`).eq("player_id",playerId).maybeSingle()
    ]);
    setAccountType(profileResult.data?.account_type||"");
    setPremium(["pro","premium"].includes(subscriptionResult.data?.plan||"") && (subscriptionResult.data?.status==="active" || subscriptionResult.data?.status==="trialing"));
    const r=requestResult.data as RequestRow|null;
    setRequest(r);
    if(r?.status==="accepted"){
      const {data:m}=await supabase.from("player_contact_messages").select("id,request_id,sender_id,body,created_at").eq("request_id",r.id).order("created_at",{ascending:true});
      setMessages((m||[]) as MessageRow[]);
    }
  }
  useEffect(()=>{void load()},[playerId]);

  useEffect(()=>{
    if(!request?.id || request.status!=="accepted") return;
    const channel=supabase.channel("hoopchat-"+request.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"player_contact_messages",filter:"request_id=eq."+request.id},payload=>{
        const next=payload.new as MessageRow;
        setMessages(current=>current.some(m=>m.id===next.id)?current:[...current,next]);
      })
      .subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[request?.id,request?.status]);

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
    if(error)setInfo(error.message); else {
      const {data:m}=await supabase.from("player_contact_messages").select("id,request_id,sender_id,body,created_at").eq("request_id",request.id).order("created_at",{ascending:true});
      setMessages((m||[]) as MessageRow[]);setDraft("");
    }
    setBusy(false);
  }

  if (compact) {
    if (!userId) {
      return <Link href="/login" className="btn">Sign in to Add</Link>;
    }
    if (request?.status === "accepted") {
      return <span className="contact-gate" style={{ display: "inline-flex", alignItems: "center", margin: 0, padding: "8px 12px" }}><strong>Connected</strong></span>;
    }
    if (request?.status === "pending" && request.requester_id === userId) {
      return <span className="contact-gate" style={{ display: "inline-flex", alignItems: "center", margin: 0, padding: "8px 12px" }}><strong>Pending</strong></span>;
    }
    if (request?.status === "pending" && request.player_id === userId) {
      return <span className="contact-gate" style={{ display: "inline-flex", alignItems: "center", margin: 0, padding: "8px 12px" }}><strong>Request waiting</strong></span>;
    }
    if (accountType === "player" && !premium) {
      return <Link href="/membership" className="btn">Upgrade to Add</Link>;
    }
    if ((accountType === "player" || accountType === "scout" || accountType === "agent") && premium) {
      return <button className="btn" onClick={() => void sendRequest()} disabled={busy}>{busy ? "Adding..." : "Add Player"}</button>;
    }
    return null;
  }

  if(accountType==="player" && request?.player_id===userId && request.status==="pending"){
    return <div className="contact-box"><span className="card-kicker">PLAYER REQUEST</span><h3>Another Pro/Premium player wants to connect</h3><p className="muted">{request.message||"A player wants access to your profile and HoopFeed connection."}</p><div className="actions"><button className="btn" onClick={()=>void respond("accepted")} disabled={busy}>Accept</button><button className="btn dark" onClick={()=>void respond("rejected")} disabled={busy}>Decline</button></div>{info&&<p className="muted">{info}</p>}</div>;
  }
  if(accountType==="player" && request?.requester_id===userId && request.status==="pending"){
    return <div className="contact-gate"><strong>Player request pending</strong><p className="muted">The player must accept before HoopChat messaging opens.</p></div>;
  }
  if(accountType==="player" && request?.status==="accepted"){
    return <div className="contact-box"><span className="card-kicker">HOOPCHAT</span><h3>Connected player</h3><div className="contact-messages">{messages.map(m=><div key={m.id} className={m.sender_id===userId?"contact-message mine":"contact-message"}>{m.body}<small>{new Date(m.created_at).toLocaleString()}</small></div>)}</div><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a message..." rows={3}/><button className="btn" onClick={()=>void sendMessage()} disabled={busy||!draft.trim()}>{busy?"Sending...":"Send Message"}</button></div>;
  }
  if(accountType==="player" && !request){
    if(!premium)return <div className="contact-gate"><strong>Pro/Premium Player feature</strong><p className="muted">Upgrade to Pro or Premium to send a player request.</p></div>;
    return <div className="contact-box"><span className="card-kicker">PLAYER CONNECTION</span><h3>Request player access</h3><p className="muted">Send a request to connect. The player must accept before HoopChat messaging opens.</p><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Introduce yourself..." rows={3}/><button className="btn" onClick={()=>void sendRequest()} disabled={busy}>{busy?"Sending...":"Send Player Request"}</button>{info&&<p className="muted">{info}</p>}</div>;
  }

  if(accountType==="scout" || accountType==="agent"){
    if(!premium)return <div className="contact-gate"><strong>Pro/Premium Scout/Agent feature</strong><p className="muted">Upgrade to Pro or Premium to request contact with professional players. Players control whether requests are accepted.</p></div>;
    if(request?.status==="accepted")return <div className="contact-box"><span className="card-kicker">CONTACT ACCEPTED</span><h3>You can now get in touch</h3><div className="contact-messages">{messages.map(m=><div key={m.id} className={m.sender_id===userId?"contact-message mine":"contact-message"}>{m.body}<small>{new Date(m.created_at).toLocaleString()}</small></div>)}</div><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a message to the player..." rows={3}/><button className="btn" onClick={()=>void sendMessage()} disabled={busy||!draft.trim()}>{busy?"Sending...":"Send Message"}</button>{info&&<p className="muted">{info}</p>}</div>;
    if(request?.status==="pending")return <div className="contact-gate"><strong>Contact request pending</strong><p className="muted">The player will decide whether to accept your request.</p></div>;
    if(request?.status==="rejected")return <div className="contact-gate"><strong>Request declined</strong><p className="muted">This player declined the contact request.</p></div>;
    return <div className="contact-box"><span className="card-kicker">PREMIUM SCOUT / AGENT</span><h3>Get in touch with this player</h3><p className="muted">Send a request. The player must accept before either side can message.</p><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Introduce yourself and explain the opportunity..." rows={3}/><button className="btn" onClick={()=>void sendRequest()} disabled={busy}>{busy?"Sending...":"Request Contact"}</button>{info&&<p className="muted">{info}</p>}</div>;
  }

  return null;
}
