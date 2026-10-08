"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";

type Game={id:string;team_id:string;opponent_name:string;status:string;home_score:number|null;away_score:number|null;started_at:string|null};
type Team={id:string;name:string};

export default function FanLivePage(){
  const [games,setGames]=useState<Game[]>([]);
  const [teams,setTeams]=useState<Record<string,Team>>({});
  const [selected,setSelected]=useState<Game|null>(null);
  const [messages,setMessages]=useState<any[]>([]);
  const [body,setBody]=useState("");
  const [loading,setLoading]=useState(true);
  const [allowed,setAllowed]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const {data:{session}}=await supabase.auth.getSession();
    const user=session?.user;
    if(!user){setLoading(false);return;}
    const [{data:p},{data:s}]=await Promise.all([
      supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,current_period_end").eq("user_id",user.id).maybeSingle()
    ]);
    const active=(s?.status==="active"||s?.status==="trialing")&&(!s?.current_period_end||new Date(s.current_period_end)>new Date());
    const ok=p?.account_type==="fan"&&s?.plan==="premium"&&active;
    setAllowed(ok);
    if(!ok){setLoading(false);return;}
    const {data:follows}=await supabase.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").limit(50);
    const ids=(follows||[]).map((x:any)=>x.target_id).filter(Boolean);
    if(!ids.length){setLoading(false);return;}
    const [{data:g},{data:t}]=await Promise.all([
      supabase.from("fan_live_games").select("id,team_id,opponent_name,status,home_score,away_score,started_at").eq("status","live").in("team_id",ids).order("started_at",{ascending:false}),
      supabase.from("teams").select("id,name").in("id",ids)
    ]);
    setGames((g||[]) as Game[]);setTeams(Object.fromEntries((t||[]).map((x:any)=>[x.id,x])));
    setSelected((g?.[0] as Game)||null);setLoading(false);
  }

  async function loadMessages(gameId:string){
    const {data}=await supabase.from("fan_live_chat_messages").select("id,body,created_at,user_id").eq("game_id",gameId).order("created_at",{ascending:true}).limit(200);
    setMessages(data||[]);
  }

  useEffect(()=>{void load();},[]);
  useEffect(()=>{
  if(!selected)return;
  void loadMessages(selected.id);
  const channel=supabase.channel("fan-live-"+selected.id)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"fan_live_chat_messages",filter:"game_id=eq."+selected.id},payload=>setMessages(x=>x.some(m=>m.id===payload.new.id)?x:[...x,payload.new]))
    .subscribe();
  return()=>{void supabase.removeChannel(channel);};
},[selected?.id]);

  async function send(){
    const text=body.trim();if(!text||!selected)return;
    const {data:{session}}=await supabase.auth.getSession();const user=session?.user;if(!user)return;
    const {error}=await supabase.from("fan_live_chat_messages").insert({game_id:selected.id,user_id:user.id,body:text});
    if(error){setMessage(error.message);return;}setBody("");setMessage("");
  }

  if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading live games..." /></div></main>;
  if(!allowed)return <main className="page-shell"><div className="page-container"><section className="hero-card"><p className="eyebrow">PREMIUM FAN</p><h1>Live Game Chat</h1><p className="muted">Premium Fans can chat live during current games involving teams they follow.</p><div className="actions"><Link href="/membership" className="btn">Upgrade to Premium</Link><Link href="/teams" className="btn dark">Find Teams</Link></div></section></div></main>;

  return <main className="page-shell"><div className="page-container">
    <header className="topbar"><Link href="/" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/feed">HoopFeed</Link><Link href="/teams">Teams</Link></nav></header>
    <section className="hero-card"><p className="eyebrow">PREMIUM FAN · LIVE</p><h1>Game Chat</h1><p className="muted">Live conversations are available only for current games involving teams you follow.</p></section>
    {!games.length?<section className="dashboard-card"><h2>No followed team is live right now.</h2><p className="muted">Follow a team and come back when its current game starts.</p><Link href="/teams" className="btn">Browse Teams</Link></section>:
    <section className="live-chat-layout">
      <div className="dashboard-card"><span className="card-kicker">LIVE NOW</span>{games.map(g=><button key={g.id} type="button" className={selected?.id===g.id?"live-game-row selected":"live-game-row"} onClick={()=>setSelected(g)}><strong>{teams[g.team_id]?.name||"Team"}</strong><span>vs {g.opponent_name}</span><b>{g.home_score??"—"} : {g.away_score??"—"}</b></button>)}</div>
      {selected&&<div className="dashboard-card live-chat-card"><div className="live-chat-header"><div><span className="card-kicker">LIVE CHAT</span><h2>{teams[selected.team_id]?.name||"Team"} vs {selected.opponent_name}</h2></div><strong>🔴 LIVE</strong></div><div className="live-chat-messages">{messages.map(m=><div className="live-chat-message" key={m.id}><small>{new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small><span>{m.body}</span></div>)}{!messages.length&&<p className="muted">Be the first Premium Fan to say something.</p>}</div><div className="live-chat-compose"><input value={body} onChange={e=>setBody(e.target.value)} maxLength={500} placeholder="Talk about the game..." onKeyDown={e=>{if(e.key==="Enter")void send()}}/><button className="btn" onClick={()=>void send()}>Send</button></div>{message&&<p className="muted">{message}</p>}</div>}
    </section>}
    <div className="bottom-back"><button className="btn dark" type="button" onClick={()=>window.history.back()}>← Back</button></div>
  </div></main>;
}
