"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { PageShell } from "../../components/LayoutSystem";

type Share = { id:string; post_id:string; sender_id:string; created_at:string };
type InboxItem = Share & { senderName:string; available:boolean };

export default function HoopFeedInboxPage() {
  const [items,setItems]=useState<InboxItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let live=true;
    (async()=>{
      try {
        const {data:{session}}=await supabase.auth.getSession();
        if(!session?.user) { if(live)setError("Sign in to view your shared posts."); return; }
        // Recipient-only RLS also filters blocked senders and revoked post access.
        const {data:shares,error:sharesError}=await supabase.from("hoopfeed_post_shares")
          .select("id,post_id,sender_id,created_at").eq("recipient_id",session.user.id)
          .order("created_at",{ascending:false}).limit(100);
        if(sharesError)throw sharesError;
        const rows=(shares||[]) as Share[];
        const postIds=[...new Set(rows.map(x=>x.post_id))];
        const senderIds=[...new Set(rows.map(x=>x.sender_id))];
        const [posts,senders]=await Promise.all([
          postIds.length?supabase.from("feed_posts").select("id").in("id",postIds).eq("status","approved"):Promise.resolve({data:[],error:null}),
          senderIds.length?supabase.from("profiles").select("id,display_name").in("id",senderIds):Promise.resolve({data:[],error:null})
        ]);
        if(posts.error)throw posts.error;
        if(senders.error)throw senders.error;
        const visible=new Set((posts.data||[]).map(x=>x.id));
        const names=new Map((senders.data||[]).map(x=>[x.id,x.display_name||"HoopCheck member"]));
        if(live)setItems(rows.map(x=>({...x,senderName:names.get(x.sender_id)||"HoopCheck member",available:visible.has(x.post_id)})));
      } catch(e) { if(live)setError("Couldn't load your shared posts. Please refresh."); console.error("HoopFeed inbox load failed",e); }
      finally { if(live)setLoading(false); }
    })();
    return()=>{live=false};
  },[]);
  return <PageShell><main className="page-shell"><div className="page-container" style={{maxWidth:760}}>
    <header className="hero-card"><p className="eyebrow">HOOPFEED™</p><h1>Shared with you</h1><p className="muted">Posts HoopCheck members sent to you. Access is checked again when you open a post.</p><Link href="/feed">Back to HoopFeed</Link></header>
    {loading?<p role="status">Loading shared posts…</p>:error?<p role="alert">{error} <Link href="/login?returnTo=%2Ffeed%2Finbox">Sign in</Link></p>:items.length===0?<section className="dashboard-card"><h2>No shared posts yet</h2><p className="muted">Posts sent to you inside HoopCheck will appear here.</p></section>:<section aria-label="Shared posts" style={{display:"grid",gap:12,marginTop:16}}>
      {items.map(item=><article className="dashboard-card" key={item.id}>
        <strong>{item.senderName}</strong><p className="muted" style={{margin:"6px 0"}}>Shared a HoopFeed post · {new Date(item.created_at).toLocaleDateString()}</p>
        {item.available?<Link href={`/feed#post-${item.post_id}`} className="btn">View post</Link>:<p role="status">This post is no longer available to you.</p>}
      </article>)}
    </section>}
  </div></main></PageShell>;
}
