"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type PendingPost={id:string;space_id:string;channel_id:string;author_id:string;body:string;created_at:string};
export default function HoopGroupsOwnerModeration({userId,spaceId,isOwner}:{
  userId:string;spaceId:string;isOwner:boolean;
}) {
  const generation=useRef(0);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [posts,setPosts]=useState<PendingPost[]>([]);
  const [feedback,setFeedback]=useState("");
  useEffect(()=>{generation.current+=1;setOpen(false);setPosts([]);setFeedback("");setBusy(false);return ()=>{generation.current+=1;};},[userId,spaceId]);
  if(!isOwner||!userId||!spaceId) return null;
  async function token() {
    const {data:{session}}=await supabase.auth.getSession();
    if(session?.user?.id!==userId || !session.access_token) throw new Error("Sign in as the server owner.");
    return session.access_token;
  }
  async function load() {
    if(busy) return;
    const revision=generation.current;
    setBusy(true);setFeedback("");
    try {
      const bearer=await token();
      const response=await fetch("/api/hoopgroups/moderate",{
        headers:{"Authorization":"Bearer "+bearer},cache:"no-store"
      });
      if(!response.ok) throw new Error(response.status===503?"Community moderation is not active yet.":"Unable to load pending messages.");
      const data=await response.json();
      if(revision!==generation.current) return;
      setPosts(((data.posts||[]) as PendingPost[]).filter(post=>post.space_id===spaceId));
    } catch(error) {if(revision===generation.current) setFeedback(error instanceof Error?error.message:"Unable to load messages.");}
    finally{if(revision===generation.current) setBusy(false);}
  }
  async function decide(postId:string,status:"approved"|"rejected") {
    if(busy) return;
    const revision=generation.current;
    setBusy(true);setFeedback("");
    try {
      const bearer=await token();
      const response=await fetch("/api/hoopgroups/moderate",{
        method:"PATCH",headers:{"Authorization":"Bearer "+bearer,"Content-Type":"application/json"},
        body:JSON.stringify({id:postId,status}),cache:"no-store"
      });
      if(!response.ok) throw new Error(response.status===403?"You cannot moderate this community.":"Unable to save moderation.");
      if(revision!==generation.current) return;
      setPosts(items=>items.filter(post=>post.id!==postId));
      setFeedback(status==="approved"?"Message approved. It will appear in the channel.":"Message rejected.");
    } catch(error) {if(revision===generation.current) setFeedback(error instanceof Error?error.message:"Unable to moderate.");}
    finally {if(revision===generation.current) setBusy(false);}
  }
  return <section className="hc-hoopgroups-owner-queue">
    <button type="button" className="hc-hoopgroups-queue-toggle" aria-expanded={open}
      onClick={()=>{setOpen(value=>!value);if(!open)void load();}}>Review pending messages</button>
    {open&&<div className="hc-hoopgroups-queue-panel">
      <div><strong>Server moderation</strong><button type="button" disabled={busy} onClick={()=>void load()}>Refresh queue</button></div>
      <p>Messages require review before other members can read them. You can approve or reject posts only in your own server. HoopCheck moderators retain oversight.</p>
      {posts.length?posts.map(post=><article key={post.id}>
        <p>{post.body}</p><small>{new Date(post.created_at).toLocaleString()}</small>
        <div><button type="button" disabled={busy} onClick={()=>void decide(post.id,"approved")}>Approve</button><button type="button" disabled={busy} onClick={()=>void decide(post.id,"rejected")}>Reject</button></div>
      </article>):<p>No pending messages in this server.</p>}
      {feedback&&<p role="status">{feedback}</p>}
    </div>}
  </section>;
}
