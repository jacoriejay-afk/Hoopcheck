"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { GAME_CHAT_OPEN_EARLY_MINUTES, getGameAvailability } from "../../lib/game-availability";
import { getLiveGameStatusPresentation } from "../../lib/live-game-status";
import "./fan-live.css";
import "../game-predictions.css";
import GameWinnerPrediction from "../../components/GameWinnerPrediction";
import TeamLogo from "../../components/TeamLogo";
import { getHoopCheckEntitlements } from "../../lib/membership-tier";

type Game = { id:string; team_id:string; opponent_team_id:string|null; opponent_name:string; status:string; home_score:number|null; away_score:number|null; started_at:string|null; ends_at:string|null; scheduled_at:string|null; league_name:string|null; country:string|null; period_label:string|null };
type Team = { id:string; name:string; logo_url?:string|null; logo_bg?:"transparent"|"light"|"dark"|null };
type ChatMessage = { id:string; body:string; created_at:string; user_id:string; pending?:boolean; failed?:boolean };
type Profile = { display_name:string|null; avatar_url:string|null };

const initials = (name:string) => name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "HC";
const renderTeamLogo = (team:Team|null|undefined) => <TeamLogo name={team?.name||"Team"} logoUrl={team?.logo_url} logoBg={team?.logo_bg} size={44} className="hc-live-team-logo" />;

// Use the same 60-minute pregame / 2-hour verified postgame lifecycle as
// the main directory. Database RLS remains authoritative for message writes.
const roomOpen = (game:Game, now=new Date()) => getGameAvailability({
  status:game.status, scheduledAt:game.scheduled_at, startedAt:game.started_at, endsAt:game.ends_at, now
}).chatOpen;

export default function FanLivePage() {
  const [games,setGames]=useState<Game[]>([]);
  const [roomSearch,setRoomSearch]=useState("");
  const [teams,setTeams]=useState<Record<string,Team>>({});
  const [selected,setSelected]=useState<Game|null>(null);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [profiles,setProfiles]=useState<Record<string,Profile>>({});
  const [body,setBody]=useState("");
  const [loading,setLoading]=useState(true);
  const [allowed,setAllowed]=useState(false);
  const [chatEnabled,setChatEnabled]=useState(false);
  const [userId,setUserId]=useState<string|null>(null);
  const [accountType,setAccountType]=useState("");
  const [sending,setSending]=useState(false);
  const [message,setMessage]=useState("");
  const [gamesLoadError,setGamesLoadError]=useState(false);
  const [presenceCount,setPresenceCount]=useState(0);
  const [roomPresenceCounts,setRoomPresenceCounts]=useState<Record<string,number>>({});
  const [gameStream,setGameStream]=useState<"connecting"|"live"|"fallback">("connecting");
  const [chatStream,setChatStream]=useState<"connecting"|"live"|"fallback">("connecting");
  const [serverRoomOpen,setServerRoomOpen]=useState<{gameId:string;open:boolean}|null>(null);
  const [mutedUsers,setMutedUsers]=useState<Set<string>>(new Set());
  const [blockedUsers,setBlockedUsers]=useState<Set<string>>(new Set());
  const [reporting,setReporting]=useState<string|null>(null);
  const [reportReason,setReportReason]=useState("harassment");
  const [reportDetails,setReportDetails]=useState("");
  const [clock,setClock]=useState(()=>new Date());
  const basketballSide = useFanBasketballSide();
  const pathname = usePathname();
  const roomId = pathname?.match(/^\/fan-live\/room\/([0-9a-f-]{36})\/?$/i)?.[1] || null;
  const inRoom = Boolean(pathname?.startsWith("/fan-live/room/"));
  const scrollRef = useRef<HTMLDivElement|null>(null);
  const activeRoomRef = useRef<string|null>(null);
  const composerRef = useRef<HTMLInputElement|null>(null);
  const followLatestRef = useRef(true);

  const load = useCallback(async (showLoader=false) => {
    if(showLoader) setLoading(true);
    const {data:{session}}=await supabase.auth.getSession();
    const user=session?.user;
    if(!user){setUserId(null);setAccountType("");setAllowed(false);setGames([]);setSelected(null);setLoading(false);return;}
    setUserId(user.id);
    const [{data:profile},{data:subscription},{data:isAdmin}] = await Promise.all([
      supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,current_period_end,access_status").eq("user_id",user.id).maybeSingle(),
      supabase.rpc("is_current_user_admin_or_moderator")
    ]);
    setAccountType(profile?.account_type || "");
    const entitlements = getHoopCheckEntitlements({ accountType: profile?.account_type, subscription, isAdmin: isAdmin === true });
    const fanCanChat = profile?.account_type === "fan" && entitlements.canUseLiveGameChat;
    const playerCanChat = profile?.account_type === "player" && entitlements.canUseLiveGameChat;
    const moderatorCanChat = entitlements.canUseLiveGameChat && isAdmin === true;
    const playerCanPredict = profile?.account_type === "player";
    setChatEnabled(Boolean(fanCanChat || playerCanChat || moderatorCanChat));
    setAllowed(Boolean(fanCanChat || playerCanChat || moderatorCanChat || playerCanPredict));
    if (!fanCanChat && !playerCanChat && !moderatorCanChat && !playerCanPredict) {
      setGames([]); setSelected(null); setLoading(false); return;
    }
    // Keep the room list focused on current fixtures; historical provider rows are retained in the database for reconciliation.
    const recentWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const gameResult = profile?.account_type === "player" && !playerCanChat
      ? await fetch("/api/game-predictions?mode=games", { headers: { Authorization: "Bearer " + (session?.access_token || "") }, cache: "no-store" })
          .then(async response => { const json = await response.json(); return { data: json.games || [], error: response.ok ? null : new Error("player-game-list-unavailable") }; })
      : await supabase.from("fan_live_games").select("id,team_id,opponent_team_id,opponent_name,status,home_score,away_score,started_at,ends_at,scheduled_at,league_name,country,period_label").in("status",["scheduled","live","final","cancelled","postponed","abandoned"]).gte("scheduled_at",recentWindowStart).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(500);
    // Resolve direct links by their exact game ID. A current game can sit
    // outside a seven-day list or beyond the 500-row discovery limit.
    // RLS still applies: only eligible viewers can fetch protected game rows.
    const directRoomResult = roomId && (fanCanChat || playerCanChat || moderatorCanChat)
      ? await supabase.from("fan_live_games")
          .select("id,team_id,opponent_team_id,opponent_name,status,home_score,away_score,started_at,ends_at,scheduled_at,league_name,country,period_label")
          .eq("id",roomId).maybeSingle()
      : null;
    const {data:controls}=await supabase.from("fan_live_chat_user_controls").select("target_user_id,is_blocked,is_muted").eq("user_id",user.id);
    setGamesLoadError(Boolean(gameResult.error && !directRoomResult?.data));
    if(gameResult.error) setMessage("Game updates are temporarily unavailable. Reconnecting…");
    const rawList=(gameResult.data||[]) as Game[];
    const rawGames=directRoomResult?.data
      ? Array.from(new Map([...rawList,directRoomResult.data as Game].map(game=>[game.id,game])).values())
      : rawList;
    const candidateIds=Array.from(new Set(rawGames.flatMap(g=>[g.team_id,g.opponent_team_id].filter((x):x is string=>Boolean(x)))));
    const [{data:sideRows},{data:womensSideRows}]=await Promise.all([
      candidateIds.length
        ? supabase.from("teams").select("id").in("id",candidateIds).eq("basketball_type",basketballSide==="womens"?"womens":"mens")
        : Promise.resolve({data:[] as {id:string}[]}),
      (basketballSide==="womens" || Boolean(roomId)) && candidateIds.length
        ? supabase.from("womens_teams").select("id").in("id",candidateIds)
        : Promise.resolve({data:[] as {id:string}[]}),
    ]);
    const sideIds=new Set([...(sideRows||[]),...(womensSideRows||[])].map((row:any)=>row.id));
    // A fixture belongs to the selected basketball side whether that side is stored
    // as the home team or the opponent; do not silently drop away-team women's games.
    const staleScheduledCutoff=Date.now()-4*60*60_000;
    const next=rawGames.filter(g=>{
      // Deep links must open their original game even when the viewer last browsed the opposite basketball side.
      if(!sideIds.has(g.team_id)&&!sideIds.has(g.opponent_team_id||"")&&g.id!==roomId)return false;
      // A scheduled fixture several hours past tip-off is not evidence of a live game.
      // Hide it until the provider confirms the result; never fabricate a final score.
      if(g.id!==roomId && g.status==="scheduled"&&g.scheduled_at){
        const tipoff=Date.parse(g.scheduled_at);
        if(Number.isFinite(tipoff)&&tipoff<staleScheduledCutoff)return false;
      }
      return true;
    });
    setGames(next);
    if (fanCanChat || playerCanChat || moderatorCanChat) {
      const freshAfter=new Date(Date.now()-75_000).toISOString();
      const {data:present}=await supabase.from("fan_live_chat_presence")
        .select("game_id,user_id").gte("last_seen_at",freshAfter).limit(2000);
      const counts:Record<string,number>={};
      const seen=new Set<string>();
      for(const row of present||[]){
        const key=row.game_id+":"+row.user_id;
        if(seen.has(key))continue;
        seen.add(key);counts[row.game_id]=(counts[row.game_id]||0)+1;
      }
      setRoomPresenceCounts(counts);
    } else setRoomPresenceCounts({});
    setMutedUsers(new Set((controls||[]).filter((x:any)=>x.is_muted).map((x:any)=>x.target_user_id)));
    setBlockedUsers(new Set((controls||[]).filter((x:any)=>x.is_blocked).map((x:any)=>x.target_user_id)));
    const ids=Array.from(new Set(next.flatMap(g=>[g.team_id,g.opponent_team_id].filter((x):x is string=>Boolean(x)))));
    const [{data:teamRows},{data:womensTeamRows}]=await Promise.all([
      ids.length?supabase.from("teams").select("id,name,logo_url,logo_bg").in("id",ids):Promise.resolve({data:[] as Team[]}),
      (basketballSide==="womens" || Boolean(roomId)) && ids.length?supabase.from("womens_teams").select("id,name,logo_url,logo_bg").in("id",ids):Promise.resolve({data:[] as Team[]}),
    ]);
    setTeams(Object.fromEntries([...(teamRows||[]),...(womensTeamRows||[])].map((t:Team)=>[t.id,t])));
    // A room URL must resolve to that exact game; never fall back to a different match.
    setSelected(roomId ? next.find(g=>g.id===roomId) || null : null);
    setClock(new Date()); setLoading(false);
  },[basketballSide,roomId]);

  const loadMessages=useCallback(async(gameId:string)=>{
    const {data,error}=await supabase.from("fan_live_chat_messages").select("id,body,created_at,user_id").eq("game_id",gameId).order("created_at",{ascending:false}).limit(200);
    if(activeRoomRef.current!==gameId)return;
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
      if(activeRoomRef.current===gameId)setProfiles(current=>({...current,...Object.fromEntries((profileRows||[]).map((p:any)=>[p.id,{display_name:p.display_name,avatar_url:p.avatar_url}]))}));
    }
  },[]);

  const refreshPresence=useCallback(async(gameId:string)=>{
    const freshAfter=new Date(Date.now()-75_000).toISOString();
    const {data,error}=await supabase.from("fan_live_chat_presence").select("user_id,last_seen_at").eq("game_id",gameId).gt("last_seen_at",freshAfter);
    if(!error && activeRoomRef.current===gameId) setPresenceCount(new Set((data||[]).map((x:any)=>x.user_id)).size);
  },[]);

  useEffect(()=>{void load(true);},[load]);
  useEffect(()=>{
    // Preserve older links sent by notifications and installed native clients.
    if(inRoom || typeof window==="undefined")return;
    const oldId=new URLSearchParams(window.location.search).get("gameId");
    if(oldId && /^[0-9a-f-]{36}$/i.test(oldId))window.location.replace("/fan-live/room/"+encodeURIComponent(oldId));
  },[inRoom]);
  useEffect(()=>{
    activeRoomRef.current=selected?.id||null;
    followLatestRef.current=true;
    setMessages([]);setProfiles({});setPresenceCount(0);setReporting(null);setMessage("");setBody("");
  },[selected?.id]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{setClock(new Date());void load();},20_000);
    const onVisible=()=>{if(document.visibilityState==="visible"){setClock(new Date());void load();}};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
  },[load]);

  // Score/status records come from the provider-backed database. Supabase
  // Realtime updates the directory as soon as an ingest commits; the 20s
  // refresh above remains the fallback if a websocket is interrupted.
  useEffect(()=>{
    const channel=supabase.channel("fan-live-directory-game-updates")
      .on("postgres_changes",{event:"*",schema:"public",table:"fan_live_games"},()=>{void load();})
      .subscribe(status=>{
        if(status==="SUBSCRIBED")setGameStream("live");
        else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")setGameStream("fallback");
      });
    return()=>{void supabase.removeChannel(channel);};
  },[load]);

  // Postgres owns room opening/closing; UI eligibility alone must never
  // suggest a message can be sent if the server-side room guard denies it.
  useEffect(()=>{
    if(!selected?.id||!chatEnabled){setServerRoomOpen(null);return;}
    const gameId=selected.id;
    let current=true;
    void supabase.rpc("fan_live_chat_room_open",{p_game_id:gameId}).then(({data,error})=>{
      if(current)setServerRoomOpen({gameId,open:!error&&data===true});
    });
    return()=>{current=false;};
  },[selected?.id,selected?.status,selected?.ends_at,chatEnabled,clock]);

  useEffect(()=>{
    if(!selected||!chatEnabled||!userId||serverRoomOpen?.gameId!==selected.id||serverRoomOpen.open!==true)return;
    let stopped=false;
    const gameId=selected.id;
    const heartbeat=async()=>{
      if(stopped)return;
      if(!roomOpen(selected,new Date())){return;}
      const now=new Date().toISOString();
      const {error}=await supabase.from("fan_live_chat_presence").upsert({game_id:gameId,user_id:userId,last_seen_at:now},{onConflict:"game_id,user_id"});
      if(error)return; // Do not count an unaccepted heartbeat as a joined member.
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
  },[selected?.id,selected?.status,selected?.scheduled_at,selected?.ends_at,chatEnabled,userId,serverRoomOpen?.gameId,serverRoomOpen?.open,refreshPresence]);

  useEffect(()=>{
    if(!selected||!chatEnabled){setMessages([]);setPresenceCount(0);return;}
    const gameId=selected.id; void loadMessages(gameId); void refreshPresence(gameId);
    const channel=supabase.channel("fan-live-chat-messages-"+gameId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"fan_live_chat_messages",filter:"game_id=eq."+gameId},payload=>{
        if(activeRoomRef.current!==gameId)return;
        const item=payload.new as ChatMessage;
        setMessages(current=>{
          if(current.some(m=>m.id===item.id))return current;
          const optimistic=current.find(m=>m.pending&&m.user_id===item.user_id&&m.body===item.body);
          if(optimistic) return current.map(m=>m.id===optimistic.id?item:m);
          return [...current,item].slice(-200);
        });
        // Resolve sender labels for new realtime arrivals without stale-room updates.
        void supabase.from("profiles")
          .select("id,display_name,avatar_url").eq("id",item.user_id).maybeSingle()
          .then(({data})=>{
            if(data && activeRoomRef.current===gameId)
              setProfiles(current=>({...current,[item.user_id]:{display_name:data.display_name,avatar_url:data.avatar_url}}));
          });
      }).subscribe(status=>{
        if(status==="SUBSCRIBED"){setChatStream("live");void loadMessages(gameId);}
        else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")setChatStream("fallback");
      });
    // A missed websocket event must not permanently hide delivered messages.
    // History is persisted in Postgres, so recover from the same room cursor.
    const recovery=window.setInterval(()=>{
      if(document.visibilityState==="visible")void loadMessages(gameId);
    },15_000);
    return()=>{window.clearInterval(recovery);void supabase.removeChannel(channel);};
  },[selected?.id,chatEnabled,loadMessages,refreshPresence]);

  useEffect(()=>{
    const list=scrollRef.current;
    if(list && followLatestRef.current)list.scrollTop=list.scrollHeight; // Never jump the viewport or interrupt readers of older messages.
  },[messages.length,selected?.id]);

  async function send(textOverride?:string){
    const text=(textOverride??body).trim();
    if(!text||!selected||!userId||sending)return;
    if(serverRoomOpen?.gameId!==selected.id||serverRoomOpen.open!==true||!roomOpen(selected,new Date())){setMessage("This game chat is read-only or still connecting.");return;}
    const gameId=selected.id;
    const localId="pending-"+crypto.randomUUID();
    const optimistic:ChatMessage={id:localId,body:text,created_at:new Date().toISOString(),user_id:userId,pending:true};
    setMessages(current=>[...current,optimistic].slice(-200));setBody("");setSending(true);setMessage("");
    const {data,error}=await supabase.from("fan_live_chat_messages").insert({game_id:selected.id,user_id:userId,body:text}).select("id,body,created_at,user_id").single();
    setSending(false);
    if(activeRoomRef.current!==gameId)return;
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

  const selectedStatus=selected?getLiveGameStatusPresentation(selected,clock):null;
  const home=selected?teams[selected.team_id]:null;
  const away=selected?(teams[selected.opponent_team_id||""]||{id:"",name:selected.opponent_name}):null;
  const availability=selected?getGameAvailability({status:selected.status,scheduledAt:selected.scheduled_at,startedAt:selected.started_at,endsAt:selected.ends_at,now:clock}):null;
  const isClosed=availability?.state==="CLOSED";
  const canSend=Boolean(chatEnabled&&serverRoomOpen?.gameId===selected?.id&&serverRoomOpen?.open&&selected&&roomOpen(selected,clock));
  const shownMessages=useMemo(()=>messages.filter(m=>!blockedUsers.has(m.user_id)&&!mutedUsers.has(m.user_id)),[messages,blockedUsers,mutedUsers]);
  const listedGames=useMemo(()=>{
    const q=roomSearch.trim().toLocaleLowerCase();
    const matches=!q?games:games.filter(game=>[
      teams[game.team_id]?.name||"",teams[game.opponent_team_id||""]?.name||"",
      game.opponent_name,game.league_name||"",game.country||""
    ].some(value=>value.toLocaleLowerCase().includes(q)));
    return [...matches].sort((a,b)=>Number(b.status==="live")-Number(a.status==="live")||
      (roomPresenceCounts[b.id]||0)-(roomPresenceCounts[a.id]||0)||
      (Date.parse(a.scheduled_at||"")||0)-(Date.parse(b.scheduled_at||"")||0));
  },[games,roomSearch,teams,roomPresenceCounts]);

  if(loading)return <main className="page-shell hc-live-room"><div className="page-container"><HoopLoading label="Loading Live Game Hub…" /></div></main>;
  if(!userId)return <main className="page-shell hc-live-room"><div className="page-container"><section className="hero-card"><p className="eyebrow">LIVE GAME HUB</p><h1>LIVE GAME CHAT</h1><p className="muted">Sign in to access Live Game Hub features available to your account.</p><Link className="btn" href="/login">Sign in</Link></section></div></main>;

  return <main className={"page-shell hc-live-room "+(inRoom?"hc-live-room--chat":"hc-live-room--directory")}>
      {!inRoom&&<FanBasketballSideSwitch />}<div className="page-container">
    <nav className="hc-live-room-nav" aria-label="Live game navigation"><Link href="/live-games">← Live Games</Link>{inRoom&&<Link href="/fan-live">All chat rooms</Link>}</nav>
    <header className="hc-live-room-heading"><div><p className="eyebrow">HOOPCHECK · COURTSIDE</p><h1>{inRoom?"Game chat":"Game chat rooms"}</h1><p>{inRoom?"One game. One conversation.":"Pick a matchup and join its dedicated live conversation."}</p></div>{inRoom&&selected&&roomOpen(selected,clock)&&<span className="hc-live-presence-chip"><i className="hc-live-pulse-dot"/> {presenceCount} here</span>}</header>
    {allowed&&<p className="hc-live-room-sync" role="status">{gameStream==="live"?"Game database connected · scores follow provider updates":"Game updates reconnecting · checking every 20 seconds"}{inRoom&&chatEnabled?" · "+(chatStream==="live"?"Chat connected live":"Chat recovering from stored messages"):""}</p>}
    {allowed && gamesLoadError && <section className="dashboard-card" role="alert"><h2>Game list temporarily unavailable</h2><p className="muted">Your membership is recognized, but the game service could not load. Please retry rather than upgrading again.</p><button type="button" className="btn" onClick={()=>void load(true)}>Retry games</button></section>}
    {!allowed ? <section className="dashboard-card hc-live-empty-state">
      {accountType === "fan" ? <><h2>Fan Pro or Premium required for Live Games</h2><p className="muted">Upgrade your fan membership to browse fixtures and join men's and women's game chats.</p><Link href="/membership" className="btn">View Fan Membership</Link></>
        : !userId ? <><h2>Sign in to view Live Games</h2><Link href="/login" className="btn">Sign In</Link></>
        : <><h2>Live Games are available to players and fans</h2><p className="muted">An active Pro or Premium membership is required for the full Live Game Hub.</p><Link href="/membership" className="btn">View Membership</Link></>}
    </section> : !games.length&&!inRoom?<section className="dashboard-card"><h2>No games available</h2><p className="muted">Check back when the game schedule is updated.</p><Link href="/live-games" className="btn">Browse Games</Link></section>:<section className={"hc-live-room-grid "+(inRoom?"hc-live-room-grid--solo":"hc-live-room-grid--directory")}>
      {!inRoom&&<aside className="hc-live-room-list" aria-label="Choose a game chat room"><div className="hc-live-room-list-heading"><span className="card-kicker">COURTSIDE · CHAT DIRECTORY</span><span>{listedGames.length} rooms</span><input className="hc-live-room-search" type="search" value={roomSearch} onChange={event=>setRoomSearch(event.target.value)} placeholder="Find a team or league…" aria-label="Search game chat rooms" /></div>{listedGames.length===0&&<p role="status">No game rooms match this search.</p>}{listedGames.map(game=>{const a=teams[game.team_id],b=teams[game.opponent_team_id||""]||{id:"",name:game.opponent_name},status=getLiveGameStatusPresentation(game,clock),postgame=["final","finished"].includes(game.status.toLowerCase()),joining=chatEnabled&&roomOpen(game,clock)&&(!postgame||process.env.NEXT_PUBLIC_LIVE_POSTGAME_CHAT_ENABLED==="true");return <Link key={game.id} href={"/fan-live/room/"+encodeURIComponent(game.id)} className="hc-live-room-game" aria-label={"Open chat for "+(a?.name||"Home")+" versus "+b.name}><div className="hc-live-room-game-teams">{renderTeamLogo(a)}<div><strong>{a?.name||"Team"} vs {b.name}</strong><span>{game.home_score??"—"} : {game.away_score??"—"} · {status.showPeriod?game.period_label:status.label}</span></div></div><span className={"hc-live-room-game-status"+(game.status==="live"?" is-live":"")}>{!chatEnabled?"MEMBERS ONLY":status.isUnverified?status.label:status.isVerifiedLive?"● LIVE":status.isVerifiedFinal?"FINAL":joining?"CHAT OPEN":"UPCOMING"}</span><span className="hc-live-room-game-join"><small>{roomPresenceCounts[game.id]||0} here</small><strong>{joining?"JOIN CHAT":"VIEW ROOM"} <span aria-hidden="true">→</span></strong></span></Link>})}</aside>}
      {inRoom&&!selected&&<section className="hc-live-room-state" role="status"><h2>Room unavailable</h2><p>This matchup could not be found for this basketball category, or it is no longer on the current schedule.</p><Link href="/fan-live">Browse chat rooms</Link></section>}
      {inRoom&&selected&&<section id="live-chat-room" className="hc-live-room-panel" aria-label="Selected game chat room">
        <header className="hc-live-room-scoreboard"><div className="hc-live-room-team">{renderTeamLogo(home)}<strong>{home?.name||"Team"}</strong></div><div className="hc-live-room-score"><span className={"hc-live-badge"+(selectedStatus?.isVerifiedLive?" is-live":"")}>{selectedStatus?.isUnverified?selectedStatus.label:selectedStatus?.isVerifiedLive?<><i/> LIVE</>:selectedStatus?.isVerifiedFinal?"FINAL":availability?.state||"UPCOMING"}</span><strong>{selected.home_score??"—"} <span>:</span> {selected.away_score??"—"}</strong><small>{selectedStatus?.showPeriod?selected.period_label:selectedStatus?.isUnverified?"Provider update pending":selected.league_name||"Score updates automatically"}</small></div><div className="hc-live-room-team">{renderTeamLogo(away)}<strong>{away?.name||selected.opponent_name}</strong></div></header>
        {selected.opponent_team_id&&<details className="hc-live-room-predictions"><summary>Game predictions</summary><GameWinnerPrediction game={selected} homeName={home?.name||"Home"} awayName={away?.name||selected.opponent_name}/></details>}

        {isClosed&&<div className="hc-live-closed-state"><span className="hc-live-closed-icon">✓</span><h2>{selectedStatus?.isUnverified?"Game result not confirmed":selectedStatus?.isVerifiedFinal?"Game finished · chat closed":"Chat unavailable"}</h2><small>Previous messages remain read-only. The provider has not confirmed this result if the status is pending.</small></div>}
        {!chatEnabled?<div className="hc-live-empty-state"><div className="hc-live-empty-ball">●</div>{accountType==="fan"?<><h2>Fan Pro or Premium required for Live Game Chat</h2><p>Upgrade your fan membership to join the live conversation for men's and women's fixtures.</p><Link href="/membership" className="btn">View Fan Membership</Link></>:accountType==="player"?<><h2>Player Pro or Premium required for Live Game Chat</h2><p>An active Pro or Premium player membership unlocks live game chat for men's and women's fixtures.</p><Link href="/membership" className="btn">View Membership</Link></>:!userId?<><h2>Sign in to join Live Game Chat</h2><Link href="/login" className="btn">Sign In</Link></>:<><h2>Live Game Chat is for eligible players and fans</h2><p>Active Pro and Premium player and fan memberships can join the live conversation.</p></>}</div>:!isClosed&&!roomOpen(selected,clock)?<div className="hc-live-empty-state"><h2>Chat opens {GAME_CHAT_OPEN_EARLY_MINUTES} minutes before tip-off</h2><p>{selected.scheduled_at?new Date(selected.scheduled_at).toLocaleString():"Tip-off time is not confirmed yet."}</p></div>:<div className="hc-live-chat-shell">
          <div className="hc-live-chat-toolbar"><span><i className="hc-live-pulse-dot"/> {presenceCount} {presenceCount===1?"member":"members"} here · {chatStream==="live"?"Live messages":"Recovering messages"}</span><span>1 message / 2 seconds</span></div>
          <div ref={scrollRef} className="hc-live-chat-messages" onScroll={event=>{const el=event.currentTarget;followLatestRef.current=el.scrollHeight-el.scrollTop-el.clientHeight<140;}} role="log" aria-live="polite" aria-relevant="additions text" aria-label="Live chat messages">
            {!shownMessages.length?<div className="hc-live-empty-state"><div className="hc-live-empty-ball">●</div><h2>{isClosed?"No messages recorded":"You're first in — start the conversation"}</h2><p>{isClosed?"This room has ended.":"Kick off the conversation while you watch."}</p></div>:shownMessages.map(item=><article key={item.id} className={"hc-live-chat-message"+(item.user_id===userId?" is-own":"")+(item.failed?" is-failed":"")}>
              <div className="hc-live-chat-avatar">{profiles[item.user_id]?.avatar_url?<img src={profiles[item.user_id].avatar_url!} alt=""/>:initials(profiles[item.user_id]?.display_name||"HoopCheck member")}</div><div className="hc-live-chat-message-body"><div className="hc-live-chat-message-meta"><strong>{item.user_id===userId?"You":profiles[item.user_id]?.display_name||"Fan"}</strong><time>{new Date(item.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time>{item.pending&&<span>Sending…</span>}{item.failed&&<button type="button" onClick={()=>void retry(item)}>Retry</button>}</div><p>{item.body}</p>{item.user_id!==userId&&!item.pending&&<details className="hc-live-message-menu"><summary aria-label="Message moderation options">•••</summary><div><button type="button" onClick={()=>void controlUser(item.user_id,"is_muted")}>{mutedUsers.has(item.user_id)?"Unmute member":"Mute member"}</button><button type="button" onClick={()=>void controlUser(item.user_id,"is_blocked")}>{blockedUsers.has(item.user_id)?"Unblock member":"Block member"}</button><button type="button" onClick={()=>setReporting(item.id)}>Report message</button></div></details>}</div>
            </article>)}

          </div>
          {!canSend&&!isClosed&&<p className="hc-live-chat-readonly" role="status">{serverRoomOpen?.gameId!==selected?.id?"Checking game-room access…":"The room is read-only until the game database opens chat."}</p>}
          {canSend&&<div className="hc-live-reaction-rail" aria-label="Quick game reactions"><span>React</span>{["🔥","🏀","👏","😮"].map(reaction=><button key={reaction} type="button" aria-label={"Add "+reaction+" reaction"} onClick={()=>{setBody(current=>((current?current+" ":"")+reaction).slice(0,500));composerRef.current?.focus();}}>{reaction}</button>)}</div>}
          {canSend&&<form className="hc-live-chat-compose" onSubmit={e=>{e.preventDefault();void send();}}><input ref={composerRef} value={body} maxLength={500} onChange={e=>setBody(e.target.value)} placeholder="React to the game…" aria-label="Chat message" disabled={isClosed}/><span>{body.length}/500</span><button className="btn" type="submit" disabled={!body.trim()||sending||isClosed}>{sending?"Sending…":"Send"}</button></form>}
          {canSend&&<p className="hc-live-chat-rules">Keep it respectful. Links are displayed as plain text. Slow mode: one message every two seconds.</p>}
        </div>}
        {message&&<p className="hc-live-room-notice" role="status">{message}</p>}
        {reporting&&<div className="hc-live-report-panel"><h3>Report message</h3><label>Reason<select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="hate">Hate or abuse</option><option value="threat">Threat</option><option value="other">Other</option></select></label><label>Details (optional)<textarea maxLength={500} value={reportDetails} onChange={e=>setReportDetails(e.target.value)} placeholder="Add context for moderators"/></label><div><button className="btn" type="button" onClick={()=>{const item=messages.find(m=>m.id===reporting);if(item)void reportMessage(item);}}>Submit report</button><button className="btn dark" type="button" onClick={()=>setReporting(null)}>Cancel</button></div></div>}
      </section>}
    </section>}
    <p className="hc-live-room-footnote">Game scores reflect the most recent verified provider sync, not every chat message. Messages are saved in the game database and stay subject to moderation and membership access.</p>
  </div></main>;
}
