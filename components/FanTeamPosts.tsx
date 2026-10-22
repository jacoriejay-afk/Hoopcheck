"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useLanguage } from "./LanguageProvider";

type TeamFanPost = { id:string; author_id:string; body:string; image_url:string|null; created_at:string; expires_at:string; profiles?:{display_name:string|null;avatar_url:string|null}|null };

export default function FanTeamPosts({ teamId }: { teamId:string }) {
  const { t, formatDate } = useLanguage();
  const [posts,setPosts] = useState<TeamFanPost[]>([]);
  useEffect(() => {
    let active=true;
    void (async () => {
      const { data } = await supabase.from("fan_feed_posts")
        .select("id,author_id,body,image_url,created_at,expires_at,profiles(display_name,avatar_url)")
        .eq("team_id",teamId).eq("status","approved").gt("expires_at",new Date().toISOString())
        .order("created_at",{ascending:false}).limit(20);
      if(active) setPosts((data||[]).map((p:any)=>({...p,profiles:Array.isArray(p.profiles)?p.profiles[0]:p.profiles})) as TeamFanPost[]);
    })();
    return () => { active=false; };
  },[teamId]);
  if(!posts.length) return null;
  return <section className="dashboard-card" style={{marginTop:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><p className="eyebrow">{t("fanFeed.kicker")}</p><h2>{t("fanFeed.teamPosts")}</h2></div>
      <Link href="/fan-feed" className="btn dark">{t("fanFeed.openFeed")}</Link>
    </div>
    <div style={{display:"grid",gap:14,marginTop:14}}>
      {posts.map(post=><article key={post.id} style={{padding:"14px 0",borderTop:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {post.profiles?.avatar_url?<img src={post.profiles.avatar_url} alt="" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback">F</div>}
          <div><Link href={"/fans/"+post.author_id}><strong>{post.profiles?.display_name||t("fanFeed.fan")}</strong></Link><p className="muted" style={{margin:0,fontSize:12}}>{formatDate(post.created_at,{dateStyle:"medium",timeStyle:"short"})}</p></div>
        </div>
        {post.body&&<p style={{whiteSpace:"pre-wrap"}}>{post.body}</p>}
        {post.image_url&&<img src={post.image_url} alt={t("fanFeed.postPhoto")} style={{width:"100%",maxHeight:380,objectFit:"cover",borderRadius:14}}/>}
      </article>)}
    </div>
  </section>;
}
