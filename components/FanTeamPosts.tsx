"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useLanguage } from "./LanguageProvider";
import { fanFeedI18n } from "../app/fan-feed/i18n";
import ReportContentAction from "./ReportContentAction";

type TeamFanPost = { id:string; author_id:string; body:string; image_url:string|null; video_url?:string|null; created_at:string; expires_at:string; profiles?:{display_name:string|null;avatar_url:string|null}|null };
type TeamGame = { id:string; opponent_name:string; status:string; scheduled_at:string|null; started_at:string|null; home_score:number|null; away_score:number|null; period_label:string|null; league_name:string|null };

export default function FanTeamPosts({ teamId }: { teamId:string }) {
  const { language } = useLanguage();
  const ft = (key: Parameters<typeof fanFeedI18n>[0]) => fanFeedI18n(key, language);
  const [posts,setPosts] = useState<TeamFanPost[]>([]);
  const [games,setGames] = useState<TeamGame[]>([]);
  useEffect(() => {
    let active=true;
    const load=async()=>{
      const now=new Date().toISOString();
      const [{data:postRows},{data:gameRows},{data:blockedRows}]=await Promise.all([
        supabase.rpc("get_fan_team_hub_posts", { p_team_id: teamId }),
        supabase.from("fan_live_games").select("id,opponent_name,status,scheduled_at,started_at,home_score,away_score,period_label,league_name").eq("team_id",teamId).in("status",["scheduled","live","in_progress"]).order("scheduled_at",{ascending:true}).limit(10),
        (async()=>{const {data:{user}}=await supabase.auth.getUser();return user?supabase.from("user_blocks").select("blocked_id").eq("blocker_id",user.id):{data:[] as {blocked_id:string}[]};})()
      ]);
      if(!active)return;
      const blockedIds=new Set((blockedRows||[]).map((row:any)=>row.blocked_id));
      setPosts((postRows||[]).filter((p:any)=>!blockedIds.has(p.author_id)).map((p:any)=>({...p,profiles:{display_name:p.display_name,avatar_url:p.avatar_url}})) as TeamFanPost[]);
      setGames(((gameRows||[]) as TeamGame[]).filter(g=>["live","in_progress"].includes(g.status.toLowerCase())||Boolean(g.scheduled_at&&g.scheduled_at>=now)).slice(0,5));
    };
    void load(); const timer=window.setInterval(()=>void load(),30000);
    return () => { active=false; window.clearInterval(timer); };
  },[teamId]);
  if(!posts.length&&!games.length) return null;
  return <section className="dashboard-card" style={{marginTop:20,padding:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><p className="eyebrow">FAN HQ · TEAM HUB</p><h2 style={{marginBottom:4}}>Your Team Hub</h2><p className="muted">Upcoming games and the latest fan updates for this team.</p></div>
      <Link href="/fan-feed" className="btn">Open Fan HoopFeed</Link>
    </div>
    {!!games.length&&<div style={{display:"grid",gap:10,marginTop:14}}><h3 style={{margin:0}}>Next games & live score</h3>{games.map(game=><article key={game.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 14px",border:"1px solid var(--border)",borderRadius:12,background:"var(--paper)"}}><div><strong>{game.status==="live"||game.status==="in_progress"?"LIVE NOW":"vs. "+game.opponent_name}</strong><p className="muted" style={{margin:"4px 0 0",fontSize:12}}>{game.league_name||"Basketball"}{game.scheduled_at?" · "+new Date(game.scheduled_at).toLocaleString():""}{game.period_label?" · "+game.period_label:""}</p></div><strong style={{whiteSpace:"nowrap",fontSize:18}}>{game.home_score!=null&&game.away_score!=null?`${game.home_score} – ${game.away_score}`:"UP NEXT"}</strong></article>)}</div>}
    {!!posts.length&&<div style={{display:"grid",gap:14,marginTop:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3 style={{margin:0}}>{ft("teamPosts")}</h3><Link href="/fan-feed" style={{color:"var(--orange)",fontWeight:900}}>All fan updates →</Link></div>{posts.map(post=><article key={post.id} style={{padding:"14px 0",borderTop:"1px solid var(--border)"}}><div style={{display:"flex",alignItems:"center",gap:10}}>{post.profiles?.avatar_url?<img src={post.profiles.avatar_url} alt="" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback">F</div>}<div><Link href={"/fans/"+post.author_id}><strong>{post.profiles?.display_name||ft("fan")}</strong></Link><p className="muted" style={{margin:0,fontSize:12}}>{new Date(post.created_at).toLocaleString()}</p></div></div>{post.body&&<p style={{whiteSpace:"pre-wrap",lineHeight:1.6}}>{post.body}</p>}{post.image_url&&<img src={post.image_url} alt="Fan update" style={{width:"100%",maxHeight:360,objectFit:"cover",borderRadius:12}}/>}{post.video_url&&<video src={post.video_url} controls playsInline preload="metadata" style={{width:"100%",maxHeight:360,borderRadius:12}}/>}<div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}><ReportContentAction contentType="fan_feed_post" contentId={post.id} contentSnapshot={post.body}/></div></article>)}</div>}
  </section>;
}
