"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../components/LanguageProvider";

type TeamPost = { id:string; author_id:string; body:string; image_url:string|null; created_at:string; expires_at:string; profiles?:{display_name:string|null;avatar_url:string|null}|null };

export default function FanTeamPosts({ teamId }: { teamId:string }) {
  const { t, formatDate } = useLanguage();
  const [visible,setVisible]=useState(false);
  const [posts,setPosts]=useState<TeamPost[]>([]);
  useEffect(()=>{
    let alive=true;
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const {data:profile}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
      if(!alive||profile?.account_type!=="fan")return;
      setVisible(true);
      const {data}=await supabase.from("fan_feed_posts")
        .select("id,author_id,body,image_url,created_at,expires_at,profiles!fan_feed_posts_author_id_fkey(display_name,avatar_url)")
        .eq("team_id",teamId).gt("expires_at",new Date().toISOString()).eq("status","approved").order("created_at",{ascending:false}).limit(10);
      if(alive)setPosts((data||[]).map((p:any)=>({...p,profiles:Array.isArray(p.profiles)?p.profiles[0]:p.profiles})));
    })();
    return ()=>{alive=false;};
  },[teamId]);
  if(!visible)return null;
  return <section className="hero hc-fan-team-posts" style={{margin:"24px 0",padding:"20px",borderRadius:18}}>
    <div className="eyebrow">{t("fanFeed.kicker")}</div>
    <h2>{t("fanFeed.teamPosts")}</h2>
    {posts.length? <div style={{display:"grid",gap:14}}>{posts.map(post=><article key={post.id} style={{padding:"14px 0",borderTop:"1px solid var(--hc-border,#ddd)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        {post.profiles?.avatar_url?<img src={post.profiles.avatar_url} alt="" style={{width:36,height:36,objectFit:"cover",borderRadius:"50%"}}/>:<span style={{width:36,height:36,display:"grid",placeItems:"center",borderRadius:"50%",background:"var(--hc-surface,#222)",color:"var(--athletic-orange,#ff5500)"}}>HC</span>}
        <div><Link href={"/fans/"+post.author_id} style={{fontWeight:800}}>{post.profiles?.display_name||t("fanFeed.fan")}</Link><div style={{fontSize:12,opacity:.7}}>{formatDate(post.created_at,{dateStyle:"medium",timeStyle:"short"})}</div></div>
      </div>
      {post.body&&<p style={{whiteSpace:"pre-wrap"}}>{post.body}</p>}
      {post.image_url&&<img src={post.image_url} alt={t("fanFeed.postPhoto")} style={{width:"100%",maxHeight:420,objectFit:"cover",borderRadius:12,marginTop:8}}/>}
    </article>)}</div>:<p className="muted">{t("fanFeed.emptyBody")}</p>}
    <Link className="btn" href="/fan-feed" style={{marginTop:12}}>{t("fanFeed.openFeed")}</Link>
  </section>;
}
