"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { readGroupUnread,markGroupVisibleRead,type GroupUnread } from "../../apps/mobile/src/native/hoopGroupsRead";
import { prepareGroupSend, submitGroupSend, type GroupSend } from "../../apps/mobile/src/native/hoopGroupsSend";
import { createGroupRefreshQueue } from "../../apps/mobile/src/native/hoopGroupsRefresh";
import { withHoopChatDeadline } from "../../apps/mobile/src/native/hoopChatLoad";
import { setGroupMembership } from "../../apps/mobile/src/native/groupMembership";
import { groupChannelScope, scopedGroupValue, visibleGroupPosts } from "../../lib/hoopgroups-channel-scope";
import HoopGroupsManage, { GROUP_COLORS, GROUP_ICONS, type GroupSpace, type GroupChannel } from "../../components/HoopGroupsManage";
import HoopGroupsChatSettings, { type ChatPrefs } from "../../components/HoopGroupsChatSettings";
import HoopGroupsOwnerModeration from "../../components/HoopGroupsOwnerModeration";
import { orderGroupsForRole, recommendedGroupIds } from "../../lib/hoopgroups-discovery";
import "./hoopgroups.css";

type Space = GroupSpace;
type Channel = GroupChannel;
const GROUP_POST_FIELDS: string = "id,author_id,body,moderation_status,created_at";
const GROUP_POST_REPLY_FIELDS: string = GROUP_POST_FIELDS+",reply_to_id,was_reply";
type Post = { id: string; author_id: string; body: string; moderation_status: string; created_at: string; reply_to_id?:string|null; was_reply?:boolean };
function validateGroupPostRows(value:unknown,replies:boolean):Post[]{
 if(!Array.isArray(value)||value.length>100)throw Error("Invalid group post response.");
 return value.map(row=>{
  if(!row||typeof row!=="object"||typeof row.id!=="string"||typeof row.author_id!=="string"||typeof row.body!=="string"||typeof row.moderation_status!=="string"||typeof row.created_at!=="string"||!Number.isFinite(Date.parse(row.created_at))||(replies&&(typeof row.was_reply!=="boolean"||!(row.reply_to_id===null||typeof row.reply_to_id==="string"))))throw Error("Invalid group post response.");
  return {id:row.id,author_id:row.author_id,body:row.body,moderation_status:row.moderation_status,created_at:row.created_at,...(replies?{reply_to_id:row.reply_to_id,was_reply:row.was_reply}:{})};
 });
}

const enabled = process.env.NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true";
const repliesEnabled=process.env.NEXT_PUBLIC_HOOPGROUPS_REPLIES_ENABLED==="true";
const readStateEnabled=process.env.NEXT_PUBLIC_HOOPGROUPS_READ_STATE_ENABLED==="true";
const planned = [
  { slug:"world-basketball", name:"World Basketball", category:"global", description:"All leagues, all levels, one basketball world." },
  { slug:"players-network", name:"Players Network", category:"players", description:"Player-to-player community and career experiences." },
  { slug:"fans-courtside", name:"Fans Courtside", category:"fans", description:"Basketball fans beyond one club." },
  { slug:"coaches-corner", name:"Coaches Corner", category:"coaches", description:"Coaching ideas and player development." },
  { slug:"scouting-room", name:"Scouting Room", category:"agents", description:"Professional basketball scouting conversations." },
  { slug:"womens-hoops", name:"Women’s Hoops", category:"womens", description:"Women’s basketball worldwide." },
];

export default function HoopGroupsPage() {
  const [userId, setUserId] = useState("");
  const [accountRole, setAccountRole] = useState("");
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [memberships, setMemberships] = useState<string[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [postSnapshot, setPostSnapshot] = useState<{scope:string;value:Post[]}|null>(null);
  const [replySnapshot,setReplySnapshot]=useState<{scope:string;value:string}|null>(null);
  const [draftSnapshot, setDraftSnapshot] = useState<{scope:string;value:string}|null>(null);
  const [postRevision,setPostRevision]=useState(0);
  const [postLoading,setPostLoading]=useState(false);
  const [unreadSnapshot,setUnreadSnapshot]=useState<{scope:string;value:GroupUnread}|null>(null);
  const [postError,setPostError]=useState("");
  const sendingPost=useRef(false);
  const pendingSend=useRef<GroupSend|null>(null);
  const membershipMutation=useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ready, setReady] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [returnTo,setReturnTo] = useState("/hoopgroups");
  const [discoverQuery,setDiscoverQuery] = useState("");
  const [discoverFilter,setDiscoverFilter] = useState<"all"|"joined"|"mine"|"recommended">("all");
  const [chatPrefs,setChatPrefs] = useState<ChatPrefs>({density:"cozy",style:"cards",scale:"normal"});
  const loadGeneration = useRef(0);
  const channelRef = useRef("");

  const load = useCallback(async () => {
    // A session transition invalidates every outstanding account-specific read.
    const generation = ++loadGeneration.current;
    pendingSend.current=null;sendingPost.current=false;setUnreadSnapshot(null);setReplySnapshot(null);
    setReady(false); setBackendReady(false); setBusy(false);
    setUserId(""); setAccountRole(""); setSpaces([]); setChannels([]);
    setMemberships([]); setSpaceId(""); setChannelId(""); setPostSnapshot(null);
    setDraftSnapshot(null); setFeedback("");
    const { data: { user } } = await supabase.auth.getUser();
    if (generation !== loadGeneration.current) return;
    if (!user) { setReady(true); return; }
    setUserId(user.id);
    const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
    if (generation !== loadGeneration.current) return;
    setAccountRole(profile?.account_type || "");
    if (!enabled) { setReady(true); return; }
    const [spaceResult, channelResult, memberResult] = await Promise.all([
      supabase.from("hoop_group_spaces").select("id,slug,name,category,description,owner_id,accent_color,icon_key").order("name"),
      supabase.from("hoop_group_channels").select("id,space_id,slug,name,sort_index").order("sort_index"),
      supabase.from("hoop_group_members").select("space_id").eq("user_id", user.id),
    ]);
    if (generation !== loadGeneration.current) return;
    if (spaceResult.error || channelResult.error || memberResult.error) {
      setFeedback("HoopGroups could not load. Please check your connection and try again.");
      setReady(true); return;
    }
    setBackendReady(true);
    const discovered=(spaceResult.data || []) as Space[];
    setSpaces(discovered);
    // Shared links select a server while retaining the sign-in requirement.
    const shared=new URLSearchParams(window.location.search).get("group");
    if(shared) setSpaceId(discovered.find(space=>space.slug===shared)?.id||"");
    setChannels((channelResult.data || []) as Channel[]);
    setMemberships((memberResult.data || []).map(item => item.space_id));
    setReady(true);
  }, [sessionRevision]);

  useEffect(() => {
    const query=new URLSearchParams(window.location.search).get("group");
    if(query && /^[a-z0-9-]{3,60}$/.test(query))
      setReturnTo("/hoopgroups?group="+encodeURIComponent(query));
  },[]);
  useEffect(() => {
    const generation = loadGeneration.current + 1;
    void load().catch(() => {
      if (generation === loadGeneration.current) { setReady(true); setBackendReady(false); }
    });
    return () => { loadGeneration.current += 1; };
  }, [load]);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // Never await a Supabase request inside the auth callback.
      loadGeneration.current += 1;
      pendingSend.current=null;sendingPost.current=false;setUnreadSnapshot(null);setReplySnapshot(null);(false); setBackendReady(false); setUserId(""); setPostSnapshot(null);
      setMemberships([]); setDraftSnapshot(null); setAccountRole(""); setSpaces([]); setChannels([]);
      setSpaceId(""); setChannelId(""); setFeedback(""); setBusy(false);
      setDiscoverQuery(""); setDiscoverFilter("all");
      setSessionRevision(value => value + 1);
    });
    return () => subscription.unsubscribe();
  }, []);

  const ordered = useMemo(() => orderGroupsForRole(spaces, accountRole), [spaces,accountRole]);
  const recommendations = useMemo(() => recommendedGroupIds(spaces, accountRole, userId, memberships), [spaces,accountRole,userId,memberships]);
  const visibleSpaces=ordered.filter(space=>{
    if(discoverFilter==="recommended" && !recommendations.has(space.id)) return false;
    if(discoverFilter==="joined" && !memberships.includes(space.id)) return false;
    if(discoverFilter==="mine" && space.owner_id!==userId) return false;
    const q=discoverQuery.trim().toLocaleLowerCase();
    return !q || [space.name,space.description,space.category].some(value=>value.toLocaleLowerCase().includes(q));
  });
  const selected = visibleSpaces.find(item => item.id === spaceId) || visibleSpaces[0] || null;
  const availableChannels = channels.filter(item => item.space_id === selected?.id);
  const channel = availableChannels.find(item => item.id === channelId) || availableChannels[0] || null;
  const joined = Boolean(selected && memberships.includes(selected.id));
  const scope = groupChannelScope(userId,channel?.id,joined&&backendReady&&ready);
  const posts = scopedGroupValue(postSnapshot,scope,[]);
  const unread=scopedGroupValue<GroupUnread|null>(unreadSnapshot,scope,null);
  const draft = scopedGroupValue(draftSnapshot,scope,"");
  const replyId=scopedGroupValue(replySnapshot,scope,"");
  const replyParent=posts.find(p=>p.id===replyId&&p.moderation_status==="approved");
  function setDraft(value:string){if(scope)setDraftSnapshot({scope,value});}
  useEffect(() => { channelRef.current = channel?.id || ""; }, [channel?.id]);
  async function verifiedHeader(uid:string,signal:AbortSignal){
    const {data:{session},error}=await supabase.auth.getSession();
    if(error||session?.user.id!==uid||signal.aborted)throw Error("Verify your account.");
    const {data:{user},error:authError}=await supabase.auth.getUser(session.access_token);
    if(authError||user?.id!==uid||signal.aborted)throw Error("Verify your account.");
    return "Bearer "+session.access_token;
  }
  async function shareInvite() {
    if(!selected) return;
    const url=window.location.origin+"/hoopgroups?group="+encodeURIComponent(selected.slug);
    try {await navigator.clipboard.writeText(url);setFeedback("Invite link copied. Members must sign in to join.");}
    catch {setFeedback("Copy this invite link: "+url);}
  }

  useEffect(() => {
    if (!enabled || !scope || !channel?.id) {setPostSnapshot(null);setPostLoading(false);setPostError("");return;}
    let active = true;
    let running:AbortController|null=null;
    let realtime:ReturnType<typeof supabase.channel>|null=null;
    let pending=false;
    const currentChannel=channel.id,currentSpace=channel.space_id;
    const generation=loadGeneration.current;
    const current=()=>active&&generation===loadGeneration.current&&channelRef.current===currentChannel;
    setPostSnapshot(null);setUnreadSnapshot(null);setPostLoading(true);setPostError("");
    // Visibility can change during awaited Auth or PostgREST calls.
    const isHidden=()=>document.visibilityState==="hidden";
    const queue=createGroupRefreshQueue(()=>current()&&!isHidden(),()=>{
      if(running)pending=true;else void readMessages();
    });
    function stopRealtime(){
      const previous=realtime;realtime=null;queue.cancel();pending=false;
      if(previous)void supabase.removeChannel(previous);
    }
    function startRealtime(){
      if(realtime||!current()||isHidden()||process.env.NEXT_PUBLIC_HOOPGROUPS_REALTIME_ENABLED!=="true")return;
      // Only after a caller-bound membership and RLS read succeeded. Do not
      // consume payloads, publish tables, or subscribe across channels.
      const filter="channel_id=eq."+currentChannel;
      const subscription=supabase.channel("hoopgroups-web:"+userId+":"+currentChannel)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"hoop_group_posts",filter},()=>{if(realtime===subscription)queue.request();})
        .on("postgres_changes",{event:"UPDATE",schema:"public",table:"hoop_group_posts",filter},()=>{if(realtime===subscription)queue.request();});
      realtime=subscription;
      subscription.subscribe(status=>{if(realtime===subscription&&status==="SUBSCRIBED")queue.request();});
    }
    async function readMessages() {
      if(isHidden()||running||!current())return;
      const request=new AbortController();running=request;
      try{
        const rows=await withHoopChatDeadline(async signal=>{
          const header=await verifiedHeader(userId,signal);
          if(!current()||signal.aborted)throw Error("Channel changed.");
          const membership=await supabase.from("hoop_group_members").select("space_id")
            .eq("space_id",currentSpace).eq("user_id",userId).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
          if(membership.error)throw Error("Group membership could not be verified.");
          if(membership.data?.space_id!==currentSpace){if(current()&&!signal.aborted){stopRealtime();setMemberships(previous=>previous.filter(id=>id!==currentSpace));setUnreadSnapshot(null);setReplySnapshot(null);setPostSnapshot(null);}throw Error("Group membership could not be verified.");}
          const blocks=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",userId).limit(501).setHeader("Authorization",header).abortSignal(signal);
          if(blocks.error||!Array.isArray(blocks.data)||blocks.data.length>500)throw Error("Blocked accounts could not be verified.");
          if(!current()||signal.aborted)throw Error("Channel changed.");
          const {data,error}=await supabase.from("hoop_group_posts")
            .select(repliesEnabled?GROUP_POST_REPLY_FIELDS:GROUP_POST_FIELDS).eq("channel_id",currentChannel)
            .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(100).setHeader("Authorization",header).abortSignal(signal);
          if(error||signal.aborted)throw Error("Could not load group discussion posts.");
          let counts:GroupUnread|null=null;
          if(readStateEnabled){try{counts=await readGroupUnread(supabase,currentSpace,header,signal);}catch{/* Do not fabricate unread counts. */}}
          const after=await verifiedHeader(userId,signal);
          if(after!==header||!current()||signal.aborted)throw Error("Session changed. Refresh messages.");
          if(current()&&!isHidden()&&!signal.aborted)setUnreadSnapshot(counts?{scope,value:counts}:null);
          return visibleGroupPosts(validateGroupPostRows(data??[],repliesEnabled),userId,new Set(blocks.data.map(row=>row.blocked_id))).reverse();
        },undefined,request);
        if(current()&&running===request&&!isHidden()){setPostSnapshot({scope,value:rows});setPostError("");startRealtime();}
      }catch{if(current()&&running===request){stopRealtime();setUnreadSnapshot(null);setPostSnapshot(null);setPostError("Messages or membership could not be verified. Refresh to retry.");}}
      finally{if(running===request){running=null;if(current()){setPostLoading(false);if(pending){pending=false;queue.request();}}}}
    }
    const visibility=()=>{if(document.visibilityState==="hidden"){stopRealtime();running?.abort();running=null;setUnreadSnapshot(null);setPostSnapshot(null);}else{setPostLoading(true);void readMessages();}};
    void readMessages();
    const interval=window.setInterval(()=>{void readMessages();},15000);
    document.addEventListener("visibilitychange",visibility);
    return () => {active=false;stopRealtime();queue.dispose();running?.abort();window.clearInterval(interval);document.removeEventListener("visibilitychange",visibility);};
  }, [scope,channel?.id,channel?.space_id,userId,postRevision]);

  async function changeMembership(joining:boolean) {
    if (!selected || !userId || busy || !backendReady || membershipMutation.current || (!joining&&!joined)) return;
    const generation=loadGeneration.current,groupId=selected.id,owner=userId;
    membershipMutation.current=true;setBusy(true);setFeedback("");
    try{
      const result=await withHoopChatDeadline(signal=>setGroupMembership(supabase,owner,groupId,joining,signal));
      if (generation !== loadGeneration.current) return;
      setMemberships(items=>result.joined?[...new Set([...items,result.spaceId])]:items.filter(id=>id!==result.spaceId));
      if(!result.joined){setPostSnapshot(null);setDraftSnapshot(null);setUnreadSnapshot(null);setReplySnapshot(null);pendingSend.current=null;}
      setFeedback(result.joined?"You joined this community.":"You left this community.");
    }catch(error){
      if(generation===loadGeneration.current)setFeedback(error instanceof Error?error.message:"Group membership change could not be confirmed.");
    }finally{
      membershipMutation.current=false;
      if (generation === loadGeneration.current) setBusy(false);
    }
  }
  async function join() { await changeMembership(true); }
  async function leave() { await changeMembership(false); }
  async function refresh() {
    if (!channel || !joined || busy || !backendReady) return;
    setPostRevision(value=>value+1);
  }
  async function markVisibleRead(){
    if(!readStateEnabled||!scope||!channel||!joined||busy||postLoading||postError||sendingPost.current)return;
    const rev=loadGeneration.current,channelId=channel.id;
    const ids=posts.filter(p=>p.author_id!==userId&&p.moderation_status==="approved").map(p=>p.id);
    if(!ids.length)return;
    sendingPost.current=true;setBusy(true);
    try{await withHoopChatDeadline(async signal=>{
      const header=await verifiedHeader(userId,signal);
      if(rev!==loadGeneration.current||channelRef.current!==channelId||signal.aborted)throw Error("Channel changed.");
      await markGroupVisibleRead(supabase,channelId,ids,header,signal);
    });if(rev===loadGeneration.current&&channelRef.current===channelId)setPostRevision(value=>value+1);}
    catch{if(rev===loadGeneration.current&&channelRef.current===channelId)setFeedback("Read state could not be confirmed.");}
    finally{if(rev===loadGeneration.current){sendingPost.current=false;setBusy(false);}}
  }
  async function send() {
    if (!channel || !userId || !scope || !joined || !draft.trim() || busy || !backendReady || sendingPost.current) return;
    const generation = loadGeneration.current;
    const activeChannel = channel.id,activeSpace=channel.space_id,submitted=draft;
    if(repliesEnabled&&replyId&&!replyParent){setFeedback("Reply unavailable. Clear the reply or refresh.");return;}
    const submittedReply=repliesEnabled&&replyParent?replyParent.id:undefined;
    const current=()=>generation===loadGeneration.current&&channelRef.current===activeChannel;
    sendingPost.current=true;setBusy(true);setFeedback("");
    try{
      await withHoopChatDeadline(async signal=>{
        const header=await verifiedHeader(userId,signal);
        if(!current()||signal.aborted)throw Error("Channel changed.");
        const membership=await supabase.from("hoop_group_members").select("space_id").eq("space_id",activeSpace).eq("user_id",userId).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
        if(membership.error||membership.data?.space_id!==activeSpace||!current()||signal.aborted)throw Error("Group membership could not be verified.");
        const message=prepareGroupSend(pendingSend.current,userId,activeChannel,submitted,()=>crypto.randomUUID(),submittedReply);
        pendingSend.current=message;
        await submitGroupSend(supabase,message,header,signal);
        if(current()&&pendingSend.current===message)pendingSend.current=null;
      });
      if(current()){
        setDraftSnapshot(previous=>previous?.scope===scope&&previous.value===submitted?null:previous);
        setReplySnapshot(previous=>previous?.scope===scope&&previous.value===submittedReply?null:previous);
        setFeedback("Post submitted for approval. It is visible only to you until approved.");
        setPostRevision(value=>value+1);
      }
    }catch{if(current())setFeedback("Post could not be confirmed. Retry the unchanged draft to reconcile the same message.");}
    finally{if(generation===loadGeneration.current){sendingPost.current=false;setBusy(false);}}
  }
  async function report(post: Post) {
    const reason = window.prompt("Why are you reporting this message? (3–350 characters)")?.trim();
    if (!reason || reason.length < 3 || reason.length > 350 || !userId) return;
    const generation = loadGeneration.current;
    const {error}=await supabase.from("hoop_group_reports").insert({post_id:post.id,reporter_id:userId,reason});
    if (generation !== loadGeneration.current) return;
    setFeedback(error ? "Report could not be submitted or was already filed." : "Report submitted for review.");
  }
  async function block(post: Post) {
    if (!userId || post.author_id === userId || !window.confirm("Hide this member's messages from your HoopGroups?")) return;
    const generation = loadGeneration.current;
    const {error}=await supabase.from("hoop_group_blocks").insert({blocker_id:userId,blocked_id:post.author_id});
    if (generation !== loadGeneration.current) return;
    if (error) setFeedback("Could not block this member.");
    else {setPostSnapshot(previous=>previous?.scope===scope?{scope,value:previous.value.filter(item=>item.author_id!==post.author_id)}:previous);setPostRevision(value=>value+1);}
  }

  return <main className="page-shell hc-hoopgroups-page"><div className="page-container">
    <header className="hc-hoopgroups-header"><div><p className="eyebrow">HOOPCHECK · COMMUNITY</p><h1>HoopGroups</h1><p className="muted">Find your basketball people. Discover independent communities, start your own group, and keep conversations moving.</p></div><Link className="btn" href="/messages">Private HoopChat</Link></header>
    {!ready && <p role="status">Loading communities…</p>}
    {ready && enabled && !userId && <section className="dashboard-card"><h2>Join the conversation</h2><p>Sign in to browse community channels.</p><Link href={"/login?returnTo="+encodeURIComponent(returnTo)} className="btn">Sign in</Link></section>}
    {ready && (!enabled || (userId && !backendReady)) ? <section className="dashboard-card hc-hoopgroups-coming-soon" role="status"><p className="eyebrow">COMMUNITY STATUS</p><h2>HoopGroups are not open yet</h2><p className="muted">The independent community database and moderation system have not been activated on HoopCheck. You can explore the planned group categories below, but joining, creating and posting are not available yet.</p>
      <div className="hc-hoopgroups-preview">{planned.map(space=><article key={space.slug}><strong>{space.name}</strong><p>{space.description}</p><small>Coming soon · group discussion and moderated posts</small></article>)}</div></section> : null}
    {ready && userId && backendReady && <>
      <div className="hc-hoopgroups-discovery">
        <div><strong>Discover your people</strong><span>Find basketball communities and create your own group.</span></div>
        <label>Search groups<input value={discoverQuery} onChange={event=>setDiscoverQuery(event.target.value)} type="search" placeholder="Search groups or topics"/></label>
        <div className="hc-hoopgroups-discovery-tabs" role="group" aria-label="Show communities">
          {(["all","recommended","joined","mine"] as const).map(filter=><button key={filter} type="button" aria-pressed={discoverFilter===filter} onClick={()=>{if(discoverFilter===filter)return;setDraftSnapshot(null);setDiscoverFilter(filter);setSpaceId("");setChannelId("");}}>{filter==="all"?"Discover groups":filter==="recommended"?"For your role":filter==="joined"?"Joined groups":"My groups"}</button>)}
        </div>
      </div>
      {discoverFilter==="recommended" && <p className="muted">Suggestions are based only on your account role and groups available in this directory that you have not joined or created. They are not popularity rankings.</p>}
      <HoopGroupsManage userId={userId} selected={selected} channels={availableChannels}
        onCreated={async created=>{await load();setDiscoverFilter("all");setDiscoverQuery("");setSpaceId(created.id);setChannelId("");}}
        onUpdated={updated=>setSpaces(items=>items.map(item=>item.id===updated.id?updated:item))}
        onChannelCreated={created=>{setChannels(items=>[...items,created]);setChannelId(created.id);}}
        onChannelUpdated={(id,name)=>setChannels(items=>items.map(item=>item.id===id?{...item,name}:item))}/>
      <HoopGroupsOwnerModeration userId={userId} spaceId={selected?.id||""} isOwner={Boolean(selected?.owner_id===userId)}/>
      {!visibleSpaces.length&&<p role="status" className="hc-hoopgroups-empty">{discoverFilter==="recommended" ? "No role-matched groups found in this directory. Try Discover groups to explore other communities." : "No groups match. Try another search or create a group."}</p>}
      {visibleSpaces.length>0&&<div className="hc-hoopgroups-shell" style={{"--hc-group-accent":GROUP_COLORS[selected?.accent_color||"orange"]||GROUP_COLORS.orange} as CSSProperties}>
      <nav className="hc-hoopgroups-servers" aria-label="Discover and select HoopGroups">{visibleSpaces.map(space =>
        <button key={space.id} type="button" aria-pressed={selected?.id===space.id} onClick={()=>{setSpaceId(space.id);setChannelId("");setFeedback("");}}><strong aria-hidden="true">{GROUP_ICONS[space.icon_key]||"🏀"}</strong><span>{space.name}<small>{space.owner_id===userId?"Your group":memberships.includes(space.id)?"Joined":"Explore group"}</small></span></button>)}</nav>
      <aside className="hc-hoopgroups-channels"><h2>{selected?.name || "Choose a group"}</h2><p>{selected?.description}</p>
        {selected&&<div className="hc-hoopgroups-community-meta"><span>{selected.owner_id===userId?"Your group":joined?"Joined":"Discover"}</span><button type="button" onClick={()=>void shareInvite()}>Copy invite</button></div>}
        <strong>DISCUSSION TOPICS</strong>
        <nav aria-label="Group discussion topics">{availableChannels.map(item=><button key={item.id} type="button" aria-pressed={channel?.id===item.id} onClick={()=>setChannelId(item.id)}>{item.name}{unread&&unread[item.id]>0?` · ${unread[item.id]} unread`:""}</button>)}</nav>
        {selected && !joined && <button type="button" className="btn" disabled={busy} onClick={()=>void join()}>Join group</button>}
        {selected && joined && <button type="button" className="hc-hoopgroups-leave" disabled={busy} onClick={()=>void leave()}>Leave group</button>}
        
      </aside>
      <section className={"hc-hoopgroups-chat "+(chatPrefs.density==="compact"?"is-compact ":"")+(chatPrefs.style==="plain"?"is-plain ":"")+(chatPrefs.scale==="large"?"is-large":"")} aria-label="Community channel"><header><div className="hc-hoopgroups-channel-title"><strong>{channel?.name || "Discussion"}</strong><small>{joined ? "You're a member" : "Join to read and post"} · moderated group discussion</small></div><div className="hc-hoopgroups-chat-tools"><HoopGroupsChatSettings userId={userId} spaceId={selected?.id||""} onChange={setChatPrefs}/><button type="button" className="hc-hoopgroups-refresh" onClick={()=>void refresh()} disabled={!joined || !channel || busy}>Refresh messages</button>{readStateEnabled&&joined&&channel&&<button type="button" disabled={busy||postLoading||Boolean(postError)||!posts.length} onClick={()=>void markVisibleRead()}>Mark loaded messages read</button>}</div></header>
        <div className="hc-hoopgroups-messages" role="log" aria-label="Community discussion" aria-live="polite" aria-relevant="additions text">{joined ? posts.length ? posts.map(post => <article key={post.id} id={"group-post-"+post.id}><div className="hc-hoopgroups-post-head"><span className="hc-hoopgroups-post-avatar" aria-hidden="true">{post.author_id===userId?"YOU":post.author_id.slice(0,2).toUpperCase()}</span><div><strong>{post.author_id===userId?"You":"Community member"}</strong><small>{new Date(post.created_at).toLocaleString()}</small></div></div>{repliesEnabled&&post.was_reply&&(()=>{const parent=posts.find(p=>p.id===post.reply_to_id&&p.moderation_status==="approved");return parent?<button type="button" onClick={()=>document.getElementById("group-post-"+parent.id)?.scrollIntoView({block:"nearest"})}>Reply to: {parent.body.slice(0,100)}</button>:<small>Original message unavailable</small>;})()}<p>{post.body}</p>{repliesEnabled&&post.moderation_status==="approved"&&<button type="button" disabled={busy} onClick={()=>setReplySnapshot({scope,value:post.id})}>Reply</button>}{post.moderation_status!=="approved" ? <small>Pending moderation · visible to you</small> : post.author_id!==userId && <div className="actions"><button type="button" onClick={()=>void report(post)}>Report</button><button type="button" onClick={()=>void block(post)}>Block member</button></div>}</article>) : <p>{postError|| (postLoading?"Loading discussion…":"No approved discussion posts yet.")}</p> : <p>Join this group to see community posts.</p>}</div>
        {feedback && <p role="status">{feedback}</p>}
        {joined && channel && <form className="hc-hoopgroups-compose" onSubmit={event=>{event.preventDefault();void send();}}><label htmlFor="hc-group-post">Post in {selected?.name || "HoopGroups"} · {channel.name}</label>{repliesEnabled&&replyId&&<div><small>{replyParent?"Replying to: "+replyParent.body.slice(0,120):"Original message unavailable"}</small><button type="button" disabled={busy} onClick={()=>setReplySnapshot(null)}>Clear reply</button></div>}<textarea id="hc-group-post" value={draft} maxLength={1200} rows={3} onChange={event=>setDraft(event.target.value)} placeholder="Share a basketball discussion… (review required)" /><button type="submit" className="btn" disabled={busy || !draft.trim()}>Post for approval</button></form>}
      </section>
    </div>}</>}
  </div></main>;
}
