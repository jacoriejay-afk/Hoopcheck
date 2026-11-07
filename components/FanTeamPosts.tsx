"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useLanguage } from "./LanguageProvider";
import { fanFeedI18n } from "../app/fan-feed/i18n";

type TeamFanPost = { id:string; author_id:string; body:string; image_url:string|null; image_src?:string|null; is_pinned:boolean; created_at:string; profiles?:{display_name:string|null;avatar_url:string|null}|null };
type TeamGame = { id:string; opponent_name:string; status:string; scheduled_at:string|null; started_at:string|null; home_score:number|null; away_score:number|null; period_label:string|null; league_name:string|null };

export default function FanTeamPosts({ teamId }: { teamId:string }) {
  const { language } = useLanguage();
  const ft = (key: Parameters<typeof fanFeedI18n>[0]) => fanFeedI18n(key, language);
  const [posts,setPosts] = useState<TeamFanPost[]>([]);
  const [games,setGames] = useState<TeamGame[]>([]);
  const [groupName,setGroupName] = useState("");
  useEffect(() => {
    let active=true;
    const load=async()=>{
      const now=new Date().toISOString();
      const [{data:gameRows},{data:group},{data:userResult}]=await Promise.all([
        supabase.from("fan_live_games").select("id,opponent_name,status,scheduled_at,started_at,home_score,away_score,period_label,league_name").eq("team_id",teamId).in("status",["scheduled","live","in_progress"]).order("scheduled_at",{ascending:true}).limit(10),
        supabase.from("team_fan_groups").select("group_name").eq("team_id",teamId).maybeSingle(),
        supabase.auth.getUser()
      ]);
      if(!active)return;
      setGroupName(group?.group_name || "Fan Group");
      const viewer=userResult.user;
      let postRows:any[]=[];
      if(viewer){
        const [{data:profile},{data:member},{data:moderator}]=await Promise.all([
          supabase.from("profiles").select("account_type").eq("id",viewer.id).maybeSingle(),
          supabase.from("team_fan_group_members").select("team_id").eq("team_id",teamId).eq("user_id",viewer.id).maybeSingle(),
          supabase.from("team_fan_group_moderators").select("team_id").eq("team_id",teamId).eq("user_id",viewer.id).maybeSingle()
        ]);
        if(profile?.account_type==="fan" && (member || moderator)){
          const {data:rows}=await supabase.from("team_fan_group_posts")
            .select("id,team_id,author_id,body,image_url,is_pinned,created_at,profiles:profiles!team_fan_group_posts_author_id_fkey(display_name,avatar_url)")
            .eq("team_id",teamId).eq("status","published").order("is_pinned",{ascending:false}).order("created_at",{ascending:false}).limit(3);
          postRows=await Promise.all((rows||[]).map(async(p:any)=>{
            const {data:signed}=p.image_url?await supabase.storage.from("fan-group-images").createSignedUrl(p.image_url,600):{data:null};
            return {...p,image_src:signed?.signedUrl||null,profiles:Array.isArray(p.profiles)?p.profiles[0]:p.profiles};
          }));
        }
      }
      setPosts(postRows as TeamFanPost[]);
      setGames(((gameRows||[]) as TeamGame[]).filter(g=>["live","in_progress"].includes(g.status.toLowerCase())||Boolean(g.scheduled_at&&g.scheduled_at>=now)).slice(0,5));
    };
    void load(); const timer=window.setInterval(()=>void load(),30000);
    return () => { active=false; window.clearInterval(timer); };
  },[teamId]);
  if(!posts.length&&!games.length) return null;
  return <section className="dashboard-card" style={{marginTop:20,padding:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><p className="eyebrow">FAN HQ · TEAM HUB</p><h2 style={{marginBottom:4}}>Your Team Hub</h2><p className="muted">Upcoming games and posts from {groupName}.</p></div>
      <Link href="/fan-feed" className="btn">Open Fan HQ</Link>
    </div>
    {!!games.length&&<div style={{display:"grid",gap:10,marginTop:14}}><h3 style={{margin:0}}>Next games & live score</h3>{games.map(game=><article key={game.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 14px",border:"1px solid var(--border)",borderRadius:12,background:"var(--paper)"}}><div><strong>{game.status==="live"||game.status==="in_progress"?"LIVE NOW":"vs. "+game.opponent_name}</strong><p className="muted" style={{margin:"4px 0 0",fontSize:12}}>{game.league_name||"Basketball"}{game.scheduled_at?" · "+new Date(game.scheduled_at).toLocaleString():""}{game.period_label?" · "+game.period_label:""}</p></div><strong style={{whiteSpace:"nowrap",fontSize:18}}>{game.home_score!=null&&game.away_score!=null?`${game.home_score} – ${game.away_score}`:"UP NEXT"}</strong></article>)}</div>}
    {!!posts.length&&<div style={{display:"grid",gap:14,marginTop:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3 style={{margin:0}}>{groupName + " posts"}</h3><Link href="/fan-feed" style={{color:"var(--orange)",fontWeight:900}}>Open Fan HQ →</Link></div>{posts.map(post=><article key={post.id} style={{padding:"14px 0",borderTop:"1px solid var(--border)"}}><div style={{display:"flex",alignItems:"center",gap:10}}>{post.profiles?.avatar_url?<img src={post.profiles.avatar_url} alt="" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback">F</div>}<div><Link href={"/fans/"+post.author_id}><strong>{post.profiles?.display_name||ft("fan")}</strong></Link><p className="muted" style={{margin:0,fontSize:12}}>{new Date(post.created_at).toLocaleString()}</p></div></div>{post.body&&<p style={{whiteSpace:"pre-wrap",lineHeight:1.6}}>{post.body}</p>}{post.image_src&&<img src={post.image_src} alt="Fan Group post" style={{width:"100%",maxHeight:360,objectFit:"cover",borderRadius:12}}/>}{post.is_pinned&&<small className="muted">Pinned by a group moderator</small>}</article>)}</div>}
  </section>;
}
