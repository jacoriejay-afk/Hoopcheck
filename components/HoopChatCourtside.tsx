"use client";

import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {supabase} from "../lib/supabase";
import {
  DEFAULT_APPEARANCE,STARTERS,lastByThread,parseAppearance,parseThreadPreferences,
  sortThreads,unreadCount,
  type ChatAppearance,type ChatContact,type ChatMessage,type ChatRequest,type ThreadPreferences
} from "../lib/hoopchat-courtside";
import "./HoopChatCourtside.css";

type InboxFilter="all"|"unread"|"requests"|"pinned";
const emptyPrefs=():ThreadPreferences=>({pinned:[],muted:[],seen:{}});
const appearanceKey=(id:string)=>"hc-courtside-appearance-v1:"+id;
const threadsKey=(id:string)=>"hc-courtside-threads-v1:"+id;
const safeStorageGet=(key:string)=>{try{return window.localStorage.getItem(key);}catch{return null;}};
const safeStorageSet=(key:string,value:string)=>{try{window.localStorage.setItem(key,value);}catch{/* private browsing */}};
const formatTime=(date:string)=>new Date(date).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"HC";

export default function HoopChatCourtside(){
  const [userId,setUserId]=useState("");
  const [sessionRevision,setSessionRevision]=useState(0);
  const [requests,setRequests]=useState<ChatRequest[]>([]);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [contacts,setContacts]=useState<Record<string,ChatContact>>({});
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");
  const [feedback,setFeedback]=useState("");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState<InboxFilter>("all");
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [appearance,setAppearance]=useState<ChatAppearance>(DEFAULT_APPEARANCE);
  const [prefs,setPrefs]=useState<ThreadPreferences>(emptyPrefs);
  const accountGeneration=useRef(0);
  const loadSequence=useRef(0);

  const load=useCallback(async(silent=false)=>{
    const revision=accountGeneration.current;
    const sequence=++loadSequence.current;
    if(!silent)setSyncing(true);
    const valid=()=>revision===accountGeneration.current&&sequence===loadSequence.current;
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(!valid())return;
      if(authError){
        // Fail closed: an invalid session cannot keep the last account's messages visible.
        setUserId("");setRequests([]);setMessages([]);setContacts({});setSelectedId(null);
        throw new Error("We couldn't verify your HoopChat session.");
      }
      if(!user){
        setUserId("");setRequests([]);setMessages([]);setContacts({});setSelectedId(null);
        return;
      }
      setUserId(user.id);
      const {data:requestRows,error:requestError}=await supabase.from("player_contact_requests")
        .select("id,requester_id,player_id,message,status,created_at")
        .or(`requester_id.eq.${user.id},player_id.eq.${user.id}`)
        .order("created_at",{ascending:false}).limit(100);
      if(!valid())return;
      if(requestError)throw new Error("Could not load private conversations.");
      const rows=(requestRows||[]) as ChatRequest[];
      const peers=[...new Set(rows.map(r=>r.requester_id===user.id?r.player_id:r.requester_id))];
      const accepted=rows.filter(r=>r.status==="accepted").map(r=>r.id);
      const [history,profileResult]=await Promise.all([
        accepted.length?supabase.from("player_contact_messages")
          .select("id,request_id,sender_id,body,created_at").in("request_id",accepted)
          .order("created_at",{ascending:false}).limit(600)
          :Promise.resolve({data:[] as ChatMessage[],error:null}),
        peers.length?supabase.from("profiles").select("id,display_name,username").in("id",peers)
          :Promise.resolve({data:[] as ChatContact[],error:null})
      ]);
      if(!valid())return;
      if(history.error)throw new Error("Message history could not be loaded.");
      setRequests(rows);setMessages((history.data||[]) as ChatMessage[]);
      setContacts(Object.fromEntries(((profileResult.data||[]) as ChatContact[]).map(c=>[c.id,c])));
      setSelectedId(current=>{
        const fromUrl=new URLSearchParams(window.location.search).get("thread");
        if(fromUrl&&rows.some(r=>r.id===fromUrl))return fromUrl;
        if(current&&rows.some(r=>r.id===current))return current;
        return rows[0]?.id||null;
      });
      setError("");
    }catch(e){
      if(valid())setError(e instanceof Error?e.message:"HoopChat could not load. Please retry.");
    }finally{
      if(valid()){setLoading(false);setSyncing(false);}
    }
  },[]);

  useEffect(()=>{
    accountGeneration.current+=1;loadSequence.current+=1;
    setUserId("");setRequests([]);setMessages([]);setContacts({});
    setSelectedId(null);setDrafts({});setError("");setFeedback("");setLoading(true);setSending(false);
    void load();
    return ()=>{accountGeneration.current+=1;loadSequence.current+=1;};
  },[load,sessionRevision]);

  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
      if(event!=="SIGNED_IN"&&event!=="SIGNED_OUT"&&event!=="USER_UPDATED")return;
      // React state change, never await another Supabase request in the auth callback.
      accountGeneration.current+=1;loadSequence.current+=1;
      setSessionRevision(n=>n+1);
    });
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!userId)return;
    setAppearance(parseAppearance(safeStorageGet(appearanceKey(userId))));
    setPrefs(parseThreadPreferences(safeStorageGet(threadsKey(userId))));
    setSettingsOpen(false);
  },[userId]);
  useEffect(()=>{
    if(!userId)return;
    const onFocus=()=>{if(document.visibilityState==="visible")void load(true);};
    const timer=window.setInterval(onFocus,25000);
    window.addEventListener("focus",onFocus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus);};
  },[load,userId]);
  useEffect(()=>{
    const selected=requests.find(r=>r.id===selectedId);
    if(!userId||!selected||selected.status!=="accepted")return;
    const rev=accountGeneration.current;
    const channel=supabase.channel("courtside-thread-"+userId+"-"+selected.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"player_contact_messages",filter:"request_id=eq."+selected.id},()=>{
        if(rev===accountGeneration.current)void load(true);
      }).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[load,requests,selectedId,userId]);

  const latest=useMemo(()=>lastByThread(messages),[messages]);
  const ordered=useMemo(()=>sortThreads(requests,latest,prefs.pinned),[requests,latest,prefs.pinned]);
  const peerId=(r:ChatRequest)=>r.requester_id===userId?r.player_id:r.requester_id;
  const peerName=(r:ChatRequest)=>{
    const profile=contacts[peerId(r)];
    return profile?.display_name?.trim()||(profile?.username?"@"+profile.username:"HoopCheck member");
  };
  const numberUnread=(r:ChatRequest)=>unreadCount(r,messages,userId,prefs.seen[r.id]);
  const filtered=ordered.filter(r=>{
    const unread=numberUnread(r);
    if(filter==="requests"&&r.status!=="pending")return false;
    if(filter==="pinned"&&!prefs.pinned.includes(r.id))return false;
    if(filter==="unread"&&(!unread||prefs.muted.includes(r.id)))return false;
    const q=search.trim().toLocaleLowerCase();
    return !q||[peerName(r),contacts[peerId(r)]?.username||"",r.message||""].some(v=>v.toLocaleLowerCase().includes(q));
  });
  const selected=requests.find(r=>r.id===selectedId)||null;
  const activeMessages=messages.filter(m=>m.request_id===selectedId).slice().reverse();
  const totalUnread=requests.reduce((n,r)=>n+(prefs.muted.includes(r.id)?0:numberUnread(r)),0);
  const currentDraft=selectedId?drafts[selectedId]||"":"";

  function updateAppearance<K extends keyof ChatAppearance>(key:K,value:ChatAppearance[K]){
    const next={...appearance,[key]:value};
    setAppearance(next);
    if(userId)safeStorageSet(appearanceKey(userId),JSON.stringify(next));
  }
  function savePrefs(next:ThreadPreferences){
    setPrefs(next);
    if(userId)safeStorageSet(threadsKey(userId),JSON.stringify(next));
  }
  function togglePinned(id:string){
    savePrefs({...prefs,pinned:prefs.pinned.includes(id)?prefs.pinned.filter(x=>x!==id):[...prefs.pinned,id]});
  }
  function toggleMuted(id:string){
    savePrefs({...prefs,muted:prefs.muted.includes(id)?prefs.muted.filter(x=>x!==id):[...prefs.muted,id]});
  }
  function markRead(id:string){
    const peerMessages=messages.filter(m=>m.request_id===id&&m.sender_id!==userId);
    const latestPeer=peerMessages.reduce((last,m)=>m.created_at>last?m.created_at:last,"");
    if(!latestPeer||prefs.seen[id]&&prefs.seen[id]>=latestPeer)return;
    savePrefs({...prefs,seen:{...prefs.seen,[id]:latestPeer}});
  }
  useEffect(()=>{
    if(!selectedId||document.visibilityState!=="visible")return;
    const peerMessages=messages.filter(m=>m.request_id===selectedId&&m.sender_id!==userId);
    const latestPeer=peerMessages.reduce((last,m)=>m.created_at>last?m.created_at:last,"");
    if(!latestPeer||prefs.seen[selectedId]&&prefs.seen[selectedId]>=latestPeer)return;
    const next={...prefs,seen:{...prefs.seen,[selectedId]:latestPeer}};
    setPrefs(next);
    if(userId)safeStorageSet(threadsKey(userId),JSON.stringify(next));
  },[messages,selectedId,userId,prefs]);

  function choose(id:string){
    setSelectedId(id);setFeedback("");setSettingsOpen(false);
    if(typeof window!=="undefined"){
      const url=new URL(window.location.href);
      url.searchParams.set("thread",id);
      if(url.pathname==="/notifications")url.searchParams.set("tab","messages");
      window.history.replaceState(null,"",url.pathname+url.search+url.hash);
    }
  }
  function setDraft(value:string){
    if(!selectedId)return;
    setDrafts(prev=>({...prev,[selectedId]:value.slice(0,2000)}));
  }
  async function respond(status:"accepted"|"rejected"){
    if(!selected||selected.player_id!==userId||selected.status!=="pending"||sending)return;
    const rev=accountGeneration.current;
    setSending(true);setFeedback("");
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw new Error("Your session changed. Sign in again.");
      const {data,error}=await supabase.from("player_contact_requests")
        .update({status,responded_at:new Date().toISOString()})
        .eq("id",selected.id).eq("player_id",userId).eq("status","pending").select("id");
      if(rev!==accountGeneration.current)return;
      if(error||!data?.length)throw new Error("Could not update this request.");
      setFeedback(status==="accepted"?"Connection accepted. The conversation is now open.":"Request declined.");
      await load(true);
    }catch(e){if(rev===accountGeneration.current)setError(e instanceof Error?e.message:"Could not respond.");}
    finally{if(rev===accountGeneration.current)setSending(false);}
  }
  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const body=currentDraft.trim();
    if(!selected||selected.status!=="accepted"||!userId||!body||sending)return;
    const rev=accountGeneration.current,thread=selected.id;
    setSending(true);setError("");setFeedback("");
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw new Error("Session changed. Please sign in again.");
      const {error:sendError}=await supabase.from("player_contact_messages")
        .insert({request_id:thread,sender_id:userId,body:body.slice(0,2000)});
      if(rev!==accountGeneration.current)return;
      if(sendError)throw new Error("Message not sent. Your text is still here.");
      setDrafts(prev=>({...prev,[thread]:""}));
      setFeedback("Message sent.");
      await load(true);
    }catch(e){if(rev===accountGeneration.current)setError(e instanceof Error?e.message:"Message could not be sent.");}
    finally{if(rev===accountGeneration.current)setSending(false);}
  }
  function applyStarter(value:string){
    if(!selectedId)return;
    setDrafts(previous=>{
      const current=previous[selectedId]||"";
      return {...previous,[selectedId]:current?current+"\n"+value:value};
    });
  }

  if(loading)return <section className="hc-courtside-loading" role="status">Opening your Courtside inbox…</section>;
  if(!userId)return <section className="hc-courtside-empty"><h2>Courtside is for members</h2><p>Sign in to see accepted contacts and requests.</p><Link className="btn" href="/login?returnTo=%2Fmessages">Sign in to messages</Link></section>;

  return <section className={["hc-courtside","hc-courtside--"+appearance.layout,
    "hc-courtside--"+appearance.density,"hc-courtside--"+appearance.scale,
    "hc-courtside--"+appearance.accent].join(" ")} aria-label="HoopChat Courtside messaging">
    <div className="hc-courtside-top">
      <div><p className="eyebrow">HOOPCHAT · COURTSIDE</p><h2>Your basketball conversations<span>.</span></h2>
        <p>Private messaging opens only after a contact accepts your request. Group channels live in HoopGroups.</p></div>
      <div className="hc-courtside-top-actions">
        {totalUnread>0&&<span className="hc-courtside-unread" aria-label={totalUnread+" unread on this device"}>{totalUnread} new</span>}
        <button type="button" onClick={()=>void load()} disabled={syncing||sending}>{syncing?"Syncing…":"Refresh"}</button>
        <button type="button" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(value=>!value)}>Customize <span aria-hidden="true">⚙</span></button>
      </div>
    </div>
    {settingsOpen&&<div className="hc-courtside-settings" aria-label="Personalize Courtside">
      <div><strong>Bubble style</strong><div>{(["courtside","classic"] as const).map(v=><button type="button" key={v} aria-pressed={appearance.layout===v} onClick={()=>updateAppearance("layout",v)}>{v==="courtside"?"Courtside cards":"Clean lines"}</button>)}</div></div>
      <div><strong>Message spacing</strong><div>{(["comfortable","compact"] as const).map(v=><button type="button" key={v} aria-pressed={appearance.density===v} onClick={()=>updateAppearance("density",v)}>{v==="comfortable"?"Comfort":"Compact"}</button>)}</div></div>
      <div><strong>Text size</strong><div>{(["normal","large"] as const).map(v=><button type="button" key={v} aria-pressed={appearance.scale===v} onClick={()=>updateAppearance("scale",v)}>{v==="normal"?"Standard":"Large"}</button>)}</div></div>
      <div><strong>Accent</strong><div>{(["orange","blue","purple"] as const).map(v=><button className={"hc-courtside-color is-"+v} type="button" key={v} aria-label={v} aria-pressed={appearance.accent===v} onClick={()=>updateAppearance("accent",v)}/>)}</div></div>
      <p>Preferences, pinned threads, and unread markers stay on this device. Your message content is never saved in appearance settings.</p>
    </div>}
    {error&&<p className="hc-courtside-alert" role="alert">{error}</p>}
    <div className="hc-courtside-shell">
      <aside className="hc-courtside-rail" aria-label="Conversation directory">
        <div className="hc-courtside-rail-search">
          <label htmlFor="hc-courtside-search">Find a conversation</label>
          <input id="hc-courtside-search" type="search" value={search} onChange={event=>setSearch(event.target.value)}
            placeholder="Search names or requests"/>
        </div>
        <div className="hc-courtside-filters" role="group" aria-label="Filter conversations">
          {(["all","unread","requests","pinned"] as const).map(v=><button key={v} type="button"
            aria-pressed={filter===v} onClick={()=>setFilter(v)}>{v==="all"?"All":v==="unread"?"Unread":v==="requests"?"Requests":"Pinned"}</button>)}
        </div>
        <nav className="hc-courtside-thread-list" aria-label="Conversations">
          {filtered.length?filtered.map(row=>{
            const peer=peerName(row),last=latest.get(row.id);
            const unread=prefs.muted.includes(row.id)?0:numberUnread(row);
            return <button type="button" key={row.id} className={"hc-courtside-thread"+(row.id===selectedId?" is-active":"")}
              aria-current={row.id===selectedId?"true":undefined} onClick={()=>choose(row.id)}>
              <span className="hc-courtside-avatar" aria-hidden="true">{initials(peer)}</span>
              <span className="hc-courtside-thread-copy"><strong>{peer}</strong>
                <small>{row.status==="accepted"?"Connected":row.status==="pending"?(row.player_id===userId?"Incoming request":"Awaiting reply"):"Request "+row.status}</small>
                <span>{last?.body||row.message||"Start your conversation"}</span>
              </span>
              <span className="hc-courtside-thread-indicators">{prefs.pinned.includes(row.id)&&<span title="Pinned">★</span>}
                {prefs.muted.includes(row.id)&&<span title="Muted on this device">◌</span>}
                {unread>0&&<strong aria-label={unread+" new messages on this device"}>{unread>99?"99+":unread}</strong>}</span>
            </button>;
          }):<div className="hc-courtside-list-empty"><strong>{requests.length?"No matching conversations":"Your courtside is open"}</strong>
            <p>{requests.length?"Change your search or filters.":"Connect with another player to start a private thread."}</p>
            <Link href="/players">Discover players</Link></div>}
        </nav>
      </aside>
      <div className="hc-courtside-stage">
        {selected?<><header className="hc-courtside-stage-header">
          <div className="hc-courtside-identity"><span className="hc-courtside-avatar" aria-hidden="true">{initials(peerName(selected))}</span>
            <span><strong>{peerName(selected)}</strong><small>{selected.status==="accepted"?"Accepted contact · private HoopChat":"Contact request"}</small></span></div>
          <div className="hc-courtside-thread-actions">
            {selected.status==="accepted"&&<button type="button" onClick={()=>markRead(selected.id)}>Mark read</button>}
            <button type="button" aria-pressed={prefs.pinned.includes(selected.id)} onClick={()=>togglePinned(selected.id)}>
              {prefs.pinned.includes(selected.id)?"Unpin":"Pin"} <span aria-hidden="true">★</span></button>
            <button type="button" aria-pressed={prefs.muted.includes(selected.id)} onClick={()=>toggleMuted(selected.id)}>
              {prefs.muted.includes(selected.id)?"Unmute":"Mute"}</button>
            <Link href={"/players/"+encodeURIComponent(peerId(selected))}>Profile</Link>
          </div>
        </header>
        <div className="hc-courtside-history" role="log" aria-label={"Messages with "+peerName(selected)}>
          <div className="hc-courtside-center-note">🏀 THE COURTSIDE THREAD <span>·</span> Only accepted contacts can read this conversation.</div>
          {selected.message&&<div className="hc-courtside-introduction"><small>CONNECTION INTRODUCTION</small><p>{selected.message}</p></div>}
          {activeMessages.map(m=><article className={"hc-courtside-message"+(m.sender_id===userId?" is-mine":"")} key={m.id}>
            <span className="hc-courtside-message-sender">{m.sender_id===userId?"You":peerName(selected)}</span>
            <p>{m.body}</p><time dateTime={m.created_at}>{formatTime(m.created_at)}</time></article>)}
          {selected.status==="accepted"&&!activeMessages.length&&<div className="hc-courtside-no-messages">
            <strong>Your court is ready.</strong><p>Start with a basketball conversation, not a cold DM.</p></div>}
        </div>
        {feedback&&<p className="hc-courtside-feedback" role="status">{feedback}</p>}
        {selected.status==="accepted"?<div className="hc-courtside-bottom">
          <div className="hc-courtside-starters"><span>PLAYBOOK</span>
            {STARTERS.map(starter=><button type="button" key={starter.key} onClick={()=>applyStarter(starter.message)}
              title="Insert a suggestion into your draft; nothing sends automatically">{starter.emoji} {starter.label}</button>)}</div>
          <form className="hc-courtside-compose" onSubmit={event=>void send(event)}>
            <label htmlFor="hc-courtside-compose">Message {peerName(selected)}</label>
            <textarea id="hc-courtside-compose" value={currentDraft} maxLength={2000} rows={3}
              placeholder="Talk hoops, share an opportunity, reconnect…" onChange={event=>setDraft(event.target.value)}/>
            <div><span>{currentDraft.length}/2000 · Only you and this contact can read your messages</span>
              <button type="submit" className="btn" disabled={sending||!currentDraft.trim()}>{sending?"Sending…":"Send message"}</button></div>
          </form>
        </div>:selected.status==="pending"&&selected.player_id===userId?<div className="hc-courtside-request-actions">
          <p>This member wants to connect. Only accept if you want to open private messaging.</p>
          <div><button type="button" className="btn" disabled={sending} onClick={()=>void respond("accepted")}>Accept connection</button>
            <button type="button" disabled={sending} onClick={()=>void respond("rejected")}>Decline</button></div>
        </div>:<div className="hc-courtside-request-actions"><p>{selected.status==="pending"?
          "Awaiting the player's approval. Messaging is locked until they accept.":"This request was declined; messaging is unavailable."}</p></div>}
        </>:<div className="hc-courtside-no-selection"><span>🏀</span><strong>Pick your next conversation.</strong><p>Every great connection starts somewhere on the court.</p></div>}
      </div>
    </div>
  </section>;
}
