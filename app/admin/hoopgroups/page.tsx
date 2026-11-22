"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Post={id:string;channel_id:string;author_id:string;body:string;moderation_status:string;created_at:string};
type Report={id:string;post_id:string;reporter_id:string;reason:string;created_at:string};
export default function HoopGroupsModeration() {
  const [posts,setPosts]=useState<Post[]>([]);
  const [reported,setReported]=useState<Post[]>([]);
  const [reports,setReports]=useState<Report[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [unavailable,setUnavailable]=useState(false);
  const token=useCallback(async ()=>{
    const {data:{session},error}=await supabase.auth.getSession();
    if(error || !session?.access_token)throw Error("Sign in with an authorized account.");
    return session.access_token;
  },[]);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const auth=await token();
      const response=await fetch("/api/admin/hoopgroups",{headers:{Authorization:"Bearer "+auth},cache:"no-store"});
      if(response.status===503){setUnavailable(true);return;}
      if(!response.ok)throw Error(response.status===403?"Moderator or admin role required.":"Moderation queue could not load.");
      const result=await response.json();
      setPosts(Array.isArray(result.posts)?result.posts:[]);
      setReported(Array.isArray(result.reported)?result.reported:[]);
      setReports(Array.isArray(result.reports)?result.reports:[]);
    }catch(failure){setError(failure instanceof Error?failure.message:"Unable to load moderation queue");}
    finally{setLoading(false);}
  },[token]);
  useEffect(()=>{void load();},[load]);

  async function change(id:string,status:"approved"|"rejected"|"removed"){
    if(busy || !window.confirm(`Confirm ${status} for this community post?`))return;
    setBusy(id);setError("");
    try{
      const auth=await token();
      const response=await fetch("/api/admin/hoopgroups",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+auth},body:JSON.stringify({id,status}),cache:"no-store"});
      if(!response.ok)throw Error("Change was not recorded. Refresh and try again.");
      await load();
    }catch(failure){setError(failure instanceof Error?failure.message:"Moderation action failed.");}
    finally{setBusy("");}
  }
  return <main className="page-shell hc-group-moderation"><div className="page-container" style={{maxWidth:1050}}>
    <header style={{margin:"22px 0"}}><p className="eyebrow">HOOPCHECK SAFETY</p><h1>HoopGroups moderation</h1><p className="muted">Approve or reject pending messages and remove reported posts. Every action uses a checked moderator role and an atomic audit log.</p><Link href="/admin/directory">Admin Control Center</Link></header>
    {loading&&<p role="status">Loading moderation queue…</p>}
    {unavailable&&<section className="dashboard-card"><h2>Not yet active</h2><p>The HoopGroups backend and server moderation flag must pass security acceptance before this queue becomes available.</p></section>}
    {error&&<p role="alert">{error}</p>}
    {!unavailable&&!loading&&<><button type="button" className="btn dark" onClick={()=>void load()}>Refresh queue</button>
      <section className="dashboard-card" style={{marginTop:16}}><h2>Pending posts ({posts.length})</h2>
        {posts.length?posts.map(post=><article key={post.id} style={{borderTop:"1px solid var(--hc-card-border,var(--border))",padding:"16px 0",overflowWrap:"anywhere"}}>
          <small>{new Date(post.created_at).toLocaleString()} · Channel {post.channel_id}</small>
          <p>{post.body}</p><div className="actions" style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={()=>void change(post.id,"approved")}>Approve</button>
            <button type="button" className="btn dark" disabled={Boolean(busy)} onClick={()=>void change(post.id,"rejected")}>Reject</button>
          </div>
        </article>):<p className="muted">No posts awaiting moderation.</p>}
      </section>
      <section className="dashboard-card" style={{marginTop:16,marginBottom:25}}><h2>Recent reports ({reports.length})</h2>
        {reports.length?reports.map(report=>{
          const post=reported.find(item=>item.id===report.post_id);
          return <article key={report.id} style={{borderTop:"1px solid var(--hc-card-border,var(--border))",padding:"16px 0",overflowWrap:"anywhere"}}>
            <small>{new Date(report.created_at).toLocaleString()} · {post?.moderation_status||"Post unavailable"}</small>
            <p><strong>Reported:</strong> {post?.body || "The post is unavailable."}</p>
            <p><strong>Reason:</strong> {report.reason}</p>
            {post?.moderation_status==="approved"&&<button type="button" className="btn dark" disabled={Boolean(busy)} onClick={()=>void change(post.id,"removed")}>Remove post</button>}
          </article>;
        }):<p className="muted">No reports have been filed.</p>}
      </section>
    </>}
  </div></main>;
}
