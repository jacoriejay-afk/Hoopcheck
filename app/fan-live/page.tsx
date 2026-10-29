"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { getGameAvailability } from "../../lib/game-availability";
import "./fan-live.css";
import "../game-predictions.css";
import GameWinnerPrediction from "../../components/GameWinnerPrediction";
import TeamLogo from "../../components/TeamLogo";

type Game = { id:string; team_id:string; opponent_team_id:string|null; opponent_name:string; status:string; home_score:number|null; away_score:number|null; started_at:string|null; ends_at:string|null; scheduled_at:string|null; league_name:string|null; country:string|null; period_label:string|null };
type Team = { id:string; name:string; logo_url?:string|null; logo_bg?:"transparent"|"light"|"dark"|null };
type ChatMessage = { id:string; body:string; created_at:string; user_id:string; pending?:boolean; failed?:boolean };
type Profile = { display_name:string|null; avatar_url:string|null };

const finalStatus = (status:string) => ["final","finished","cancelled","canceled","postponed","abandoned"].includes(status.toLowerCase());
const initials = (name:string) => name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "HC";
const renderTeamLogo = (team:Team|null|undefined) => <TeamLogo name={team?.name||"Team"} logoUrl={team?.logo_url} logoBg={team?.logo_bg} size={44} className="hc-live-team-logo" />;

const roomOpen = (game:Game, now=new Date()) => {
  if (finalStatus(game.status)) return false;
  const tip = Date.parse(game.scheduled_at || game.started_at || "");
  if (!Number.isFinite(tip)) return ["live","in_progress"].includes(game.status.toLowerCase());
  if (now.getTime() < tip - 30*60_000) return false;
  const end = Date.parse(game.ends_at || "");
  if (Number.isFinite(end)) return now.getTime() < end;
  return !Number.isFinite(tip) || now.getTime() < tip + 4*60*60_000;
};

export default function FanLivePage() {
  const [games,setGames]=useState<Game[]>([]);
  const [teams,setTeams]=useState<Record<string,Team>>({});
  const [selected,setSelected]=useState<Game|null>(null);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [profiles,setProfiles]=useState<Record<string,Profile>>({});
  const [body,setBody]=useState("");
  const [loading,setLoading]=useState(true);
  const [allowed,setAllowed]=useState(false);
  const [chatEnabled,setChatEnabled]=useState(false);
  const [userId,setUserId]=useState<string|null>(null);
  const [sending,setSending]=useState(false);
  const [message,setMessage]=useState("");
  const [presenceCount,setPresenceCount]=useState(0);
  const [mutedUsers,setMutedUsers]=useState<Set<string>>(new Set());
  const [blockedUsers,setBlockedUsers]=useState<Set<string>>(new Set());
  const [reporting,setReporting]=useState<string|null>(null);
  const [reportReason,setReportReason]=useState("harassment");
  const [reportDetails,setReportDetails]=useState("");
  const [clock,setClock]=useState(()=>new Date());
  const basketballSide = useFanBasketballSide();
  const bottomRef=useRef<HTMLDivElement|null>(null);

  const load = useCallback(async (showLoader=false) => {
    if(showLoader) setLoading(true);
    const {data:{session}}=await supabase.auth.getSession();
    const user=session?.user;
    if(!user){setUserId(null);setAllowed(false);setGames([]);setLoading(false);return;}
    setUserId(user.id);
    const [{data:profile},{data:subscription}] = await Promise.all([
      supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,current_period_end,access_status").eq("user_id",user.id).maybeSingle()
    ]);
    const active=profile?.account_type==="fan" && ["pro","premium"].includes(subscription?.plan||"") &&
      ["active","trialing"].includes(subscription?.status||"") &&
      ["active","trialing","pro","premium"].includes(subscription?.access_status??"active") &&
      (!subscription?.current_period_end || new Date(subscription.current_period_end)>new Date());
    const playerCanPredict=profile?.account_type==="player";
    setChatEnabled(Boolean(active));
    setAllowed(Boolean(active||playerCanPredict));
    if(!active&&!playerCanPredict){setGames([]);setSelected(null);setLoading(false);return;}
    const gameResult = profile?.account_type === "player"
      ? await fetch("/api/game-predictions?mode=games", { headers: { Authorization: "Bearer " + (session?.access_token || "") }, cache: "no-store" })
          .then(async response => { const json = await response.json(); return { data: json.games || [], error: response.ok ? null : new Error("player-game-list-unavailable") }; })
      : await supabase.from("fan_live_games").select("id,team_id,opponent_team_id,opponent_name,status,home_score,away_score,started_at,ends_at,scheduled_at,league_name,country,period_label").in("status",["scheduled","live","final","cancelled","postponed","abandoned"]).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(500);
    const {data:controls}=await supabase.from("fan_live_chat_user_controls").select("target_user_id,is_blocked,is_muted").eq("user_id",user.id);
    if(gameResult.error) setMessage("Game updates are temporarily unavailable. Reconnecting…");
    const rawGames=(gameResult.data||[]) as Game[];
    const candidateIds=Array.from(new Set(rawGames.flatMap(g=>[g.team_id,g.opponent_team_id].filter((x):x is string=>Boolean(x)))));
    const {data:sideRows}=candidateIds.length?await supabase.from("teams").select("id").in("id",candidateIds).eq("basketball_type",basketballSide==="womens"?"womens":"mens"):{data:[] as {id:string}[]};
    const sideIds=new Set((sideRows||[]).map((row:any)=>row.id));
    const next=rawGames.filter(g=>sideIds.has(g.team_id));
    setGames(next);
    setMutedUsers(new Set((controls||[]).filter((x:any)=>x.is_muted).map((x:any)=>x.target_user_id)));
    setBlockedUsers(new Set((controls||[]).filter((x:any)=>x.is_blocked).map((x:any)=>x.target_user_id)));
    const ids=Array.from(new Set(next.flatMap(g=>[g.team_id,g.opponent_team_id].filter((x):x is string=>Boolean(x)))));
    const {data:teamRows}=ids.length?await supabase.from("teams").select("id,name,logo_url,logo_bg").in("id",ids):{data:[] as Team[]};
    setTeams(Object.fromEntries((teamRows||[]).map((t:Team)=>[t.id,t])));
    const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("gameId"):null;
    setSelected(current=>(current&&next.find(g=>g.id===current.id))||next.find(g=>g.id===requested)||next.find(g=>g.status==="live")||next[0]||null);
    setClock(new Date()); setLoading(false);
  },[basketballSide]);

  const loadMessages=useCallback(async(gameId:string)=>{
    const {data,error}=await supabase.from("fan_live_chat_messages").select("id,body,created_at,user_id").eq("game_id",gameId).order("created_at",{ascending:true}).limit(200);
    if(error){setMessage("Chat history couldn't load. Reconnecting…");return;}
    const incoming=(data||[]) as ChatMessage[];
    setMessages(current=>{
      const pending=current.filter(x=>x.pending);
      const byId=new Map(incoming.map(x=>[x.id,x]));
      for(const p of pending) byId.set(p.id,p);
      return Array.from(byId.values()).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)).slice(-200);
    });
    const userIds=Array.from(new Set(incoming.map(x=>x.user_id)));
    if(userIds.length){
      const {data:profileRows}=await supabase.from("profiles").select("id,display_name,avatar_url").in("id",userIds);
      setProfiles(current=>({...current,...Object.fromEntries((profileRows||[]).map((p:any)=>[p.id,{display_name:p.display_name,avatar_url:p.avatar_url}]))}));
    }
  },[]);

  const refreshPresence=useCallback(async(gameId:string)=>{
    const freshAfter=new Date(Date.now()-75_000).toISOString();
    const {data,error}=await supabase.from("fan_live_chat_presence").select("user_id,last_seen_at").eq("game_id",gameId).gt("last_seen_at",freshAfter);
    if(!error) setPresenceCount(new Set((data||[]).map((x:any)=>x.user_id)).size);
  },[]);

  useEffect(()=>{void load(true);},[load]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{setClock(new Date());void load();},20_000);
    const onVisible=()=>{if(document.visibilityState==="visible"){setClock(new Date());void load();}};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
  },[load]);

  useEffect(()=>{
    if(!selected||!chatEnabled||!userId)return;
    let stopped=false;
    const gameId=selected.id;
    const heartbeat=async()=>{
      if(stopped)return;
      if(!roomOpen(selected,new Date())){return;}
      const now=new Date().toISOString();
      const {error}=await supabase.from("fan_live_chat_presence").upsert({game_id:gameId,user_id:userId,last_seen_at:now},{onConflict:"game_id,user_id"});
      
      await refreshPresence(gameId);
    };
    void heartbeat();
    const timer=window.setInterval(()=>{void heartbeat();},20_000);
    const presenceChannel=supabase.channel("fan-live-presence-"+gameId)
      .on("postgres_changes",{event:"*",schema:"public",table:"fan_live_chat_presence",filter:"game_id=eq."+gameId},()=>{void refreshPresence(gameId);})
      .subscribe();
    return()=>{
      stopped=true;window.clearInterval(timer);void supabase.removeChannel(presenceChannel);
      void supabase.from("fan_live_chat_presence").delete().eq("game_id",gameId).eq("user_id",userId);
    };
  },[selected?.id,selected?.status,selected?.scheduled_at,selected?.ends_at,chatEnabled,userId,refreshPresence]);

  useEffect(()=>{
    if(!selected||!chatEnabled){setMessages([]);setPresenceCount(0);return;}
    const gameId=selected.id; void loadMessages(gameId); void refreshPresence(gameId);
    const channel=supabase.channel("fan-live-chat-messages-"+gameId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"fan_live_chat_messages",filter:"game_id=eq."+gameId},payload=>{
        const item=payload.new as ChatMessage;
        setMessages(current=>{
          if(current.some(m=>m.id===item.id))return current;
          const optimistic=current.find(m=>m.pending&&m.user_id===item.user_id&&m.body===item.body);
          if(optimistic) return current.map(m=>m.id===optimistic.id?item:m);
          return [...current,item].slice(-200);
        });
        setProfiles(current=>current[item.user_id]?current:{...current,[item.user_id]:{display_name:null,avatar_url:null}});
      }).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[selected?.id,chatEnabled,loadMessages,refreshPresence]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth",block:"end"});},[messages.length,selected?.id]);

  async function send(textOverride?:string){
    const text=(textOverride??body).trim();
    if(!text||!selected||!userId||sending)return;
    if(!roomOpen(selected,new Date())){setMessage("Chat closed — final score.");return;}
    const localId="pending-"+crypto.randomUUID();
    const optimistic:ChatMessage={id:localId,body:text,created_at:new Date().toISOString(),user_id:userId,pending:true};
    setMessages(current=>[...current,optimistic].slice(-200));setBody("");setSending(true);setMessage("");
    const {data,error}=await supabase.from("fan_live_chat_messages").insert({game_id:selected.id,user_id:userId,body:text}).select("id,body,created_at,user_id").single();
    setSending(false);
    if(error){
      setMessages(current=>current.map(m=>m.id===localId?{...m,failed:true,pending:false}:m));
      setMessage(error.message.includes("SLOW_MODE")?"Slow mode: wait two seconds between messages.":error.message.includes("CHAT_CLOSED")?"Chat closed — final score.":"Message failed to send. Tap Retry to try again.");
      return;
    }
    const saved=data as ChatMessage;
    setMessages(current=>current.some(m=>m.id===saved.id)?current.filter(m=>m.id!==localId):current.map(m=>m.id===localId?saved:m));
  }

  async function retry(item:ChatMessage){
    setMessages(current=>current.filter(m=>m.id!==item.id));
    await send(item.body);
  }

  async function controlUser(targetId:string,kind:"is_blocked"|"is_muted"){
    if(!userId||targetId===userId)return;
    const next=kind==="is_blocked"?!blockedUsers.has(targetId):!mutedUsers.has(targetId);
    const existing={is_blocked:blockedUsers.has(targetId),is_muted:mutedUsers.has(targetId)};
    const {error}=await supabase.from("fan_live_chat_user_controls").upsert({user_id:userId,target_user_id:targetId,is_blocked:kind==="is_blocked"?next:existing.is_blocked,is_muted:kind==="is_muted"?next:existing.is_muted,updated_at:new Date().toISOString()},{onConflict:"user_id,target_user_id"});
    if(error){setMessage("Couldn't update chat controls. Please try again.");return;}
    if(kind==="is_blocked")setBlockedUsers(prev=>{const s=new Set(prev);next?s.add(targetId):s.delete(targetId);return s;});
    else setMutedUsers(prev=>{const s=new Set(prev);next?s.add(targetId):s.delete(targetId);return s;});
  }

  async function reportMessage(item:ChatMessage){
    if(!userId||!selected||item.pending)return;
    const {error}=await supabase.from("fan_live_chat_reports").insert({game_id:selected.id,message_id:item.id,reporter_id:userId,reported_user_id:item.user_id,reason:reportReason,details:reportDetails.trim()||null});
    setReporting(null);setReportDetails("");
    setMessage(error?(error.code==="23505"?"You've already reported this message.":"Couldn't submit report. Please try again."):"Report sent to HoopCheck moderators.");
  }

  const home=selected?teams[selected.team_id]:null;
  const away=selected?(teams[selected.opponent_team_id||""]||{id:"",name:selected.opponent_name}):null;
  const isClosed=selected?finalStatus(selected.status)||(Number.isFinite(Date.parse(selected.ends_at||""))?clock.getTime()>=Date.parse(selected.ends_at||""):(Number.isFinite(Date.parse(selected.scheduled_at||selected.started_at||""))&&clock.getTime()>=Date.parse(selected.scheduled_at||selected.started_at||"")+4*60*60_000)):false;
  const availability=selected?getGameAvailability({status:selected.status,scheduledAt:selected.scheduled_at,startedAt:selected.started_at,endsAt:selected.ends_at,now:clock}):null;
  const shownMessages=useMemo(()=>messages.filter(m=>!blockedUsers.has(m.user_id)&&!mutedUsers.has(m.user_id)),[messages,blockedUsers,mutedUsers]);

  if(loading)return <main className="page-shell hc-live-room"><div className="page-container"><HoopLoading label="Loading Fan HQ…" /></div></main>;
  if(!userId)return <main className="page-shell hc-live-room"><div className="page-container"><section className="hero-card"><p className="eyebrow">FAN HQ</p><h1>LIVE GAME CHAT</h1><p className="muted">Sign in as a Pro or Premium Fan to join live game conversations.</p><Link className="btn" href="/login">Sign in</Link></section></div></main>;
  if(!allowed)return <main className="page-shell hc-live-room"><div className="page-container"><section className="hero-card"><p className="eyebrow">PRO & PREMIUM FAN</p><h1>LIVE GAME CHAT</h1><p className="muted">An active Pro or Premium Fan membership is required to join game rooms.</p><Link className="btn" href="/membership">View Membership</Link></section></div></main>;

  return <main className="page-shell hc-live-room">
      <FanBasketballSideSwitch /><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/live-games">All Games</Link><Link href="/teams">Teams</Link></nav></header>
    <section className="hero-card hc-live-room-hero"><div><p className="eyebrow">HOOPCHECK · FAN HQ</p><h1>LIVE GAME CHAT<span>.</span></h1><p className="muted">Real-time conversation with fans watching the same game.</p></div><div className="hc-live-presence-chip"><span className="hc-live-pulse-dot"/> {presenceCount} {presenceCount===1?"fan":"fans"} in room</div></section>
    {!games.length?<section className="dashboard-card"><h2>No games available</h2><p className="muted">Check back when the game schedule is updated.</p><Link href="/live-games" className="btn">Browse Games</Link></section>:<section className="hc-live-room-grid">
      <aside className="dashboard-card hc-live-room-list"><div className="hc-live-room-list-heading"><span className="card-kicker">FAN HQ · GAME ROOMS</span><span>{games.length}</span></div>{games.map(game=>{const a=teams[game.team_id],b=teams[game.opponent_team_id||""]||{id:"",name:game.opponent_name};return <button key={game.id} type="button" className={"hc-live-room-game"+(selected?.id===game.id?" is-selected":"")} onClick={()=>setSelected(game)}><div className="hc-live-room-game-teams">{renderTeamLogo(a)}<div><strong>{a?.name||"Team"} vs {b.name}</strong><span>{game.home_score??"—"} : {game.away_score??"—"} · {game.period_label||game.status}</span></div></div><span className={"hc-live-room-game-status"+(game.status==="live"?" is-live":"")}>{game.status==="live"?"● LIVE":finalStatus(game.status)?"FINAL":roomOpen(game)?"CHAT OPEN":"UPCOMING"}</span></button>})}</aside>
      {selected&&<section className="dashboard-card hc-live-room-panel">
        <GameWinnerPrediction game={selected} homeName={home?.name||"Home"} awayName={away?.name||selected.opponent_name}  />
        <header className="hc-live-room-scoreboard"><div className="hc-live-room-team">{renderTeamLogo(home)}<strong>{home?.name||"Team"}</strong></div><div className="hc-live-room-score"><span className={"hc-live-badge"+(selected.status==="live"?" is-live":"")}>{selected.status==="live"?<><i/> LIVE</>:finalStatus(selected.status)?"FINAL":availability?.state||"UPCOMING"}</span><strong>{selected.home_score??"—"} <span>:</span> {selected.away_score??"—"}</strong><small>{selected.period_label||selected.league_name||"Score updates automatically"}</small></div><div className="hc-live-room-team">{renderTeamLogo(away)}<strong>{away?.name||selected.opponent_name}</strong></div></header>
        {isClosed?<div className="hc-live-closed-state"><span className="hc-live-closed-icon">✓</span><h2>Chat closed — final score</h2><p>{home?.name||"Home"} {selected.home_score??"—"} – {selected.away_score??"—"} {away?.name||selected.opponent_name}</p><small>This room is read-only after full-time.</small></div>:!chatEnabled?<div className="hc-live-empty-state"><div className="hc-live-empty-ball">●</div><h2>Make your game prediction</h2><p>Players can pick either team before tip-off and change their pick until the game starts. Fan chat remains available to eligible Pro and Premium Fan members.</p></div>:!roomOpen(selected,clock)?<div className="hc-live-empty-state"><h2>Chat opens 30 minutes before tip-off</h2><p>{selected.scheduled_at?new Date(selected.scheduled_at).toLocaleString():"Tip-off time is not confirmed yet."}</p></div>:<div className="hc-live-chat-shell">
          <div className="hc-live-chat-toolbar"><span><i className="hc-live-pulse-dot"/> {presenceCount} {presenceCount===1?"fan":"fans"} chatting</span><span>1 message / 2 seconds</span></div>
          <div className="hc-live-chat-messages" aria-live="polite" aria-label="Live chat messages">
            {!shownMessages.length?<div className="hc-live-empty-state"><div className="hc-live-empty-ball">●</div><h2>You're the first fan in — say something</h2><p>Kick off the conversation while you watch.</p></div>:shownMessages.map(item=><article key={item.id} className={"hc-live-chat-message"+(item.user_id===userId?" is-own":"")+(item.failed?" is-failed":"")}>
              <div className="hc-live-chat-avatar">{profiles[item.user_id]?.avatar_url?<img src={profiles[item.user_id].avatar_url!} alt=""/>:initials(profiles[item.user_id]?.display_name||"Fan")}</div><div className="hc-live-chat-message-body"><div className="hc-live-chat-message-meta"><strong>{item.user_id===userId?"You":profiles[item.user_id]?.display_name||"Fan"}</strong><time>{new Date(item.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time>{item.pending&&<span>Sending…</span>}{item.failed&&<button type="button" onClick={()=>void retry(item)}>Retry</button>}</div><p>{item.body}</p>{item.user_id!==userId&&!item.pending&&<details className="hc-live-message-menu"><summary>•••</summary><div><button type="button" onClick={()=>void controlUser(item.user_id,"is_muted")}>{mutedUsers.has(item.user_id)?"Unmute fan":"Mute fan"}</button><button type="button" onClick={()=>void controlUser(item.user_id,"is_blocked")}>{blockedUsers.has(item.user_id)?"Unblock fan":"Block fan"}</button><button type="button" onClick={()=>setReporting(item.id)}>Report message</button></div></details>}</div>
            </article>)}
            <div ref={bottomRef}/>
          </div>
          <form className="hc-live-chat-compose" onSubmit={e=>{e.preventDefault();void send();}}><input value={body} maxLength={500} onChange={e=>setBody(e.target.value)} placeholder="React to the game…" aria-label="Chat message" disabled={isClosed}/><span>{body.length}/500</span><button className="btn" type="submit" disabled={!body.trim()||sending||isClosed}>{sending?"Sending…":"Send"}</button></form>
          <p className="hc-live-chat-rules">Keep it respectful. Links are displayed as plain text. Slow mode: one message every two seconds.</p>
        </div>}
        {message&&<p className="hc-live-room-notice" role="status">{message}</p>}
        {reporting&&<div className="hc-live-report-panel"><h3>Report message</h3><label>Reason<select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="hate">Hate or abuse</option><option value="threat">Threat</option><option value="other">Other</option></select></label><label>Details (optional)<textarea maxLength={500} value={reportDetails} onChange={e=>setReportDetails(e.target.value)} placeholder="Add context for moderators"/></label><div><button className="btn" type="button" onClick={()=>{const item=messages.find(m=>m.id===reporting);if(item)void reportMessage(item);}}>Submit report</button><button className="btn dark" type="button" onClick={()=>setReporting(null)}>Cancel</button></div></div>}
      </section>}
    </section>}
    <p className="hc-live-room-footnote">Game scores and room status refresh automatically. <Link href="/live-games">Back to all games →</Link></p>
  </div></main>;
}
