"use client";
import PlayerReferencePanel from "./PlayerReferencePanel";
import HoopChatSafety from "./HoopChatSafety";

import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent,type UIEvent} from "react";
import Link from "next/link";
import {supabase} from "../lib/supabase";
import {withHoopChatDeadline} from "../apps/mobile/src/native/hoopChatLoad";
import {
  appendConversationPage,CHAT_HISTORY_PAGE_SIZE,readConversationPage,refreshConversationPage
} from "../apps/mobile/src/native/hoopChatHistory";
import {webChatOutbox} from "../lib/hoopchat-outbox";
import {chatDeliveryMessage} from "../apps/mobile/src/native/hoopChatOutboxCore";
import {prepareConversationMessage,sendConversationMessage} from "../apps/mobile/src/native/hoopChatSend";
import {quoteConversationMessage} from "../apps/mobile/src/native/hoopChatQuote";
import {forwardDestinations,forwardDraft,readForwardDraft,type ForwardSelection} from "../apps/mobile/src/native/hoopChatForward";
import {makeReplyTarget,scopedReplyTarget,type ReplyTarget} from "../apps/mobile/src/native/hoopChatReply";
import {markServerChatRead,readPagedChatCounts} from "../apps/mobile/src/native/hoopChatReadSync";
const durableDelivery=process.env.NEXT_PUBLIC_HOOPCHECK_CHAT_DURABLE_DELIVERY_ENABLED==="true";
const structuredReplies=process.env.NEXT_PUBLIC_HOOPCHECK_STRUCTURED_REPLIES_ENABLED==="true";
const serverInboxEnabled=process.env.NEXT_PUBLIC_HOOPCHECK_SERVER_INBOX_ENABLED==="true";
const syncReadMarkers=serverInboxEnabled||process.env.NEXT_PUBLIC_HOOPCHECK_CHAT_READ_SYNC_ENABLED==="true";
import {
  DEFAULT_APPEARANCE,STARTERS,lastByThread,parseAppearance,parseThreadPreferences,
  sortThreads,unreadCount,advanceSeenMarker,
  type ChatAppearance,type ChatContact,type ChatMessage,type ChatRequest,type ThreadPreferences
} from "../lib/hoopchat-courtside";
import "./HoopChatCourtside.css";

type InboxFilter="all"|"unread"|"requests"|"pinned";
type HistoryPage={scope:string;rows:ChatMessage[];hasMore:boolean};
const emptyPrefs=():ThreadPreferences=>({pinned:[],muted:[],seen:{}});
const appearanceKey=(id:string)=>"hc-courtside-appearance-v1:"+id;
const threadsKey=(id:string)=>"hc-courtside-threads-v1:"+id;
const safeStorageGet=(key:string)=>{try{return window.localStorage.getItem(key);}catch{return null;}};
const safeStorageSet=(key:string,value:string)=>{try{window.localStorage.setItem(key,value);}catch{/* private browsing */}};
const formatTime=(date:string)=>new Date(date).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"HC";

import {parseChatThread,readLinkedChatThread} from "../apps/mobile/src/native/hoopChatLink";
import {readChatInbox,chatInboxBatches,CHAT_INBOX_MAX_PAGES} from "../apps/mobile/src/native/hoopChatInbox";

import {readServerInbox,readAllUnread,type InboxCursor} from "../apps/mobile/src/native/hoopChatServerInbox";

export default function HoopChatCourtside(){
  const [userId,setUserId]=useState("");
  const [sessionRevision,setSessionRevision]=useState(0);
  const [requests,setRequests]=useState<ChatRequest[]>([]);
  const inboxPages=useRef(1);
  const [appliedServerQuery,setAppliedServerQuery]=useState("");
  const serverQuery=useRef(""),cursorStack=useRef<(InboxCursor|null)[]>([null]);
  const [nextCursor,setNextCursor]=useState<InboxCursor|null>(null),[serverPage,setServerPage]=useState(1),[allUnread,setAllUnread]=useState<number|null>(null);
  const [inboxMore,setInboxMore]=useState(false),[inboxLimit,setInboxLimit]=useState(false);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [serverUnread,setServerUnread]=useState<{owner:string;counts:Map<string,number>}|null>(null);
  const [historyPage,setHistoryPage]=useState<HistoryPage|null>(null);
  const [historyError,setHistoryError]=useState<{scope:string;message:string}|null>(null);
  const [historyBusy,setHistoryBusy]=useState<string|null>(null);
  const [contacts,setContacts]=useState<Record<string,ChatContact>>({});
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [replyTarget,setReplyTarget]=useState<ReplyTarget|null>(null);
  const [forwardSelection,setForwardSelection]=useState<ForwardSelection|null>(null);
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
  const [prefsOwner,setPrefsOwner]=useState("");
  const [atLatest,setAtLatest]=useState(true);
  const accountGeneration=useRef(0);
  // Lock synchronously within the current account generation, even before React rerenders.
  const mutationGeneration=useRef<number|null>(null);
  const pendingMessages=useRef(new Map<string,Omit<ChatMessage,"created_at">>());
  const loadSequence=useRef(0);
  const inboxRequest=useRef<AbortController|null>(null);
  const userIdRef=useRef("");
  const historyRef=useRef<HTMLDivElement|null>(null);
  const historyRequest=useRef<AbortController|null>(null);
  const activeHistoryScope=useRef("");
  const historyThread=useRef<string|null>(null);
  const followingLatest=useRef(true);

  const load=useCallback(async(silent=false)=>{
    if(silent&&inboxRequest.current)return;
    inboxRequest.current?.abort();
    const request=new AbortController();
    inboxRequest.current=request;
    const revision=accountGeneration.current;
    const sequence=++loadSequence.current;
    if(!silent)setSyncing(true);
    const valid=()=>revision===accountGeneration.current&&sequence===loadSequence.current;
    try{
      await withHoopChatDeadline(async signal=>{
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(!valid()||signal.aborted)return;
        if(authError){
          // Fail closed: an invalid session cannot keep the last account's messages visible.
          userIdRef.current="";
          setUserId("");setRequests([]);setMessages([]);setContacts({});setSelectedId(null);
          throw new Error("We couldn't verify your HoopChat session.");
        }
        if(!user){
          userIdRef.current="";
          setUserId("");setRequests([]);setMessages([]);setContacts({});setSelectedId(null);
          return;
        }
        // If an auth transition occurred before the event handler cleared state,
        // never render the previous account's private thread under the new identity.
        if(userIdRef.current&&userIdRef.current!==user.id){
          pendingMessages.current.clear();
          setRequests([]);setMessages([]);setContacts({});setSelectedId(null);
        }
        userIdRef.current=user.id;
        setUserId(user.id);
        const {data:{session},error:sessionError}=await supabase.auth.getSession();
        if(!valid()||signal.aborted)return;
        if(sessionError||session?.user.id!==user.id){
          setRequests([]);setMessages([]);setContacts({});setSelectedId(null);
          throw new Error("We couldn't verify your HoopChat session.");
        }
        const header="Bearer "+session.access_token;
        const blocked=await supabase.from("user_blocks").select("blocked_id")
          .eq("blocker_id",user.id).limit(501).setHeader("Authorization",header).abortSignal(signal);
        if(!valid()||signal.aborted)return;
        if(blocked.error||!blocked.data||blocked.data.length>500){
          setRequests([]);setMessages([]);setContacts({});setSelectedId(null);
          throw new Error("Blocked accounts could not be verified.");
        }
        const blockedIds=new Set(blocked.data.map(row=>row.blocked_id));
        const inbox=serverInboxEnabled?await readServerInbox(supabase,user.id,header,signal,serverQuery.current,"all",cursorStack.current.at(-1)??null,blockedIds):{...(await readChatInbox(supabase,user.id,header,signal,inboxPages.current,blockedIds)),next:null};
        if(!valid()||signal.aborted)return;
        const rows=inbox.rows;
        const fromUrl=parseChatThread(new URLSearchParams(window.location.search).get("thread"));
        if(fromUrl&&!rows.some(r=>r.id===fromUrl)){
          const linked=await readLinkedChatThread(supabase,user.id,fromUrl,blockedIds,header,signal);
          if(!valid()||signal.aborted)return;
          if(linked)rows.unshift(linked);
        }
        const peers=[...new Set(rows.map(r=>r.requester_id===user.id?r.player_id:r.requester_id))];
        const accepted=rows.filter(r=>r.status==="accepted").map(r=>r.id);
        const [historyPages,profilePages,unread,accountUnread]=await Promise.all([
          Promise.all(chatInboxBatches(accepted).map(ids=>supabase.from("player_contact_messages")
            .select("id,request_id,sender_id,body,created_at").in("request_id",ids).order("created_at",{ascending:false}).limit(600).setHeader("Authorization",header).abortSignal(signal))),
          Promise.all(chatInboxBatches(peers).map(ids=>supabase.from("profiles").select("id,display_name,username,account_type").in("id",ids).setHeader("Authorization",header).abortSignal(signal))),
          syncReadMarkers?readPagedChatCounts(supabase,rows.map(row=>row.id),{bearer:header,signal}).catch(()=>null):null,
          serverInboxEnabled?readAllUnread(supabase,header,signal).catch(()=>null):null,
        ]);
        const latestSession=await supabase.auth.getSession();
        if(latestSession.error||latestSession.data.session?.user.id!==user.id||latestSession.data.session.access_token!==session.access_token)throw Error("Account changed.");
        if(!valid()||signal.aborted)return;
        if(historyPages.some(result=>result.error)||profilePages.some(result=>result.error))throw new Error("Conversation previews could not be loaded.");
        setInboxMore(inbox.hasMore);setInboxLimit(inbox.atLimit);setNextCursor(inbox.next);setServerPage(cursorStack.current.length);setAllUnread(accountUnread);
        setServerUnread(unread?{owner:user.id,counts:unread}:null);
        setRequests(rows);setMessages(historyPages.flatMap(result=>(result.data||[]) as ChatMessage[]));
        setContacts(Object.fromEntries(profilePages.flatMap(result=>(result.data||[]) as ChatContact[]).map(c=>[c.id,c])));
        setSelectedId(current=>{
          if(fromUrl)return rows.some(r=>r.id===fromUrl)?fromUrl:null;
          if(current&&rows.some(r=>r.id===current))return current;
          return rows[0]?.id||null;
        });
        setError("");
      },undefined,request);
    }catch(e){
      if(valid()){
        setRequests([]);setMessages([]);setContacts({});setSelectedId(null);setAllUnread(null);setNextCursor(null);
        setError(e instanceof Error?e.message:"HoopChat could not load. Please retry.");
      }
    }finally{
      if(inboxRequest.current===request)inboxRequest.current=null;
      if(valid()){setLoading(false);setSyncing(false);}
    }
  },[]);

  useEffect(()=>{
    accountGeneration.current+=1;loadSequence.current+=1;
    userIdRef.current="";inboxPages.current=1;setInboxMore(false);setInboxLimit(false);serverQuery.current="";setAppliedServerQuery("");cursorStack.current=[null];setNextCursor(null);setServerPage(1);setAllUnread(null);setSearch("");
    pendingMessages.current.clear();
    setUserId("");setRequests([]);setMessages([]);setContacts({});
    setServerUnread(null);
    setSelectedId(null);setDrafts({});setReplyTarget(null);setForwardSelection(null);setError("");setFeedback("");setLoading(true);setSending(false);
    setPrefs(emptyPrefs());setPrefsOwner("");setAtLatest(true);
    void load();
    return ()=>{
      accountGeneration.current+=1;loadSequence.current+=1;
      inboxRequest.current?.abort();
      inboxRequest.current=null;
    };
  },[load,sessionRevision]);

  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event!=="SIGNED_IN"&&event!=="SIGNED_OUT"&&event!=="USER_UPDATED")return;
      if(event==="SIGNED_IN"&&session?.user.id===userIdRef.current)return;
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
    setPrefsOwner(userId);
    setSettingsOpen(false);
  },[userId]);
  // Do not reconnect the socket whenever the 25-second inbox refresh recreates requests[].
  // Only the selected conversation, account, or its accepted status should change this subscription.
  const selectedStatus=requests.find(r=>r.id===selectedId)?.status;
  const historyScope=userId&&selectedId&&selectedStatus==="accepted"?userId+":"+selectedId:"";
  const loadHistory=useCallback(async(viewer:string,thread:string,older?:ChatMessage,refresh=false)=>{
    const scope=viewer+":"+thread;
    if(historyRequest.current||activeHistoryScope.current!==scope)return;
    const request=new AbortController();
    historyRequest.current=request;
    const revision=accountGeneration.current;
    const valid=()=>historyRequest.current===request&&revision===accountGeneration.current;
    if(!refresh)setHistoryBusy(scope);
    setHistoryError(null);
    try{
      const rows=await withHoopChatDeadline(async signal=>{
        const {data:{session},error:sessionError}=await supabase.auth.getSession();
        if(signal.aborted||sessionError||session?.user.id!==viewer)throw new Error("Your session changed.");
        const header="Bearer "+session.access_token;
        const target=await supabase.from("player_contact_requests").select("requester_id,player_id,status")
          .eq("id",thread).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
        if(target.error||target.data?.status!=="accepted"||![target.data.requester_id,target.data.player_id].includes(viewer)){
          throw new Error("Conversation unavailable.");
        }
        const peer=target.data.requester_id===viewer?target.data.player_id:target.data.requester_id;
        const blocked=await supabase.from("user_blocks").select("blocked_id")
          .eq("blocker_id",viewer).eq("blocked_id",peer).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
        if(blocked.error||blocked.data)throw new Error("Conversation unavailable. Check your blocked accounts.");
        return readConversationPage(supabase,thread,signal,older,header,structuredReplies);
      },undefined,request);
      if(!valid())return;
      setHistoryPage(previous=>{
        const hasMore=rows.length===CHAT_HISTORY_PAGE_SIZE;
        if(previous?.scope!==scope)return {scope,rows,hasMore};
        if(older)return {scope,rows:appendConversationPage(previous.rows,rows),hasMore};
        const latest=refreshConversationPage(previous.rows,rows);
        return {scope,rows:latest,hasMore:latest.length>rows.length?previous.hasMore:hasMore};
      });
    }catch(e){
      if(valid()){
        setHistoryPage(null);
        setHistoryError({scope,message:e instanceof Error?e.message:"Conversation history could not be loaded."});
      }
    }finally{
      if(historyRequest.current===request){
        historyRequest.current=null;
        setHistoryBusy(null);
      }
    }
  },[]);
  useEffect(()=>{
    if(!userId)return;
    const onFocus=()=>{
      if(document.visibilityState!=="visible")return;
      void load(true);
      if(selectedId&&historyScope)void loadHistory(userId,selectedId,undefined,true);
    };
    const timer=window.setInterval(onFocus,25000);
    window.addEventListener("focus",onFocus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus);};
  },[historyScope,load,loadHistory,selectedId,userId]);
  useEffect(()=>{
    activeHistoryScope.current=historyScope;
    setHistoryPage(null);setHistoryError(null);setHistoryBusy(null);
    if(userId&&selectedId&&historyScope)void loadHistory(userId,selectedId);
    return ()=>{
      activeHistoryScope.current="";
      historyRequest.current?.abort();
      historyRequest.current=null;
    };
  },[historyScope,loadHistory,selectedId,userId]);
  useEffect(()=>{
    if(!userId||!selectedId||selectedStatus!=="accepted")return;
    const rev=accountGeneration.current;
    const channel=supabase.channel("courtside-thread-"+userId+"-"+selectedId)

      .on("postgres_changes",{event:"INSERT",schema:"public",table:"player_contact_messages",filter:"request_id=eq."+selectedId},()=>{
        if(rev===accountGeneration.current){
          void loadHistory(userId,selectedId,undefined,true);
          void load(true);
        }
      }).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[load,loadHistory,selectedId,selectedStatus,userId]);

  const latest=useMemo(()=>lastByThread(messages),[messages]);
  const ordered=useMemo(()=>sortThreads(requests,latest,prefs.pinned),[requests,latest,prefs.pinned]);
  const peerId=(r:ChatRequest)=>r.requester_id===userId?r.player_id:r.requester_id;
  const peerName=(r:ChatRequest)=>{
    const profile=contacts[peerId(r)];
    return profile?.display_name?.trim()||(profile?.username?"@"+profile.username:"HoopCheck member");
  };
  const peerHref=(r:ChatRequest)=>{
    const id=encodeURIComponent(peerId(r));
    const type=contacts[peerId(r)]?.account_type;
    return type==="player"?"/players/"+id:type==="coach"?"/coaches/"+id:
      type==="agent"||type==="scout"?"/agents":"/search";
  };
  const syncedCounts=serverUnread?.owner===userId?serverUnread.counts:null;
  const numberUnread=(r:ChatRequest)=>syncedCounts?(syncedCounts.get(r.id)??0):unreadCount(r,messages,userId,prefs.seen[r.id]);
  const filtered=ordered.filter(r=>{
    const unread=numberUnread(r);
    if(filter==="requests"&&r.status!=="pending")return false;
    if(filter==="pinned"&&!prefs.pinned.includes(r.id))return false;
    if(filter==="unread"&&(!unread||prefs.muted.includes(r.id)))return false;
    const q=search.trim().toLocaleLowerCase();
    return serverInboxEnabled||!q||[peerName(r),contacts[peerId(r)]?.username||"",r.message||""].some(v=>v.toLocaleLowerCase().includes(q));
  });
  const selected=requests.find(r=>r.id===selectedId)||null;
  const renderGeneration=accountGeneration.current;
  const selectedHistory=historyScope&&historyPage?.scope===historyScope?historyPage:null;
  const activeMessages=selectedHistory?.rows.slice().reverse()||[];
  const replyId=structuredReplies?scopedReplyTarget(historyScope,replyTarget,selectedHistory?.rows||[]):undefined;
  const selectedHistoryError=historyScope&&historyError?.scope===historyScope?historyError.message:"";
  const latestMessageId=activeMessages[activeMessages.length-1]?.id||"";
  useEffect(()=>{
    const pane=historyRef.current;
    if(!pane||!selectedId)return;
    const changedThread=historyThread.current!==selectedId;
    if(changedThread){
      historyThread.current=selectedId;
      followingLatest.current=true;setAtLatest(true);
    }
    if(!changedThread&&!followingLatest.current)return;
    const frame=window.requestAnimationFrame(()=>{
      const current=historyRef.current;
      if(current&&historyThread.current===selectedId){
        current.scrollTop=current.scrollHeight;
        followingLatest.current=true;setAtLatest(true);
      }
    });
    return ()=>window.cancelAnimationFrame(frame);
  },[selectedId,latestMessageId]);
  // Auto-scroll only while the reader follows recent messages; do not yank history upward
  // when they're reading older messages.
  function onHistoryScroll(event:UIEvent<HTMLDivElement>){
    const element=event.currentTarget;
    followingLatest.current=element.scrollHeight-element.scrollTop-element.clientHeight<100;
    setAtLatest(followingLatest.current);
  }
  const totalUnread=requests.reduce((n,r)=>n+(prefs.muted.includes(r.id)?0:numberUnread(r)),0);
  const currentDraft=selectedId?drafts[selectedId]||"":"";

  function updateAppearance<K extends keyof ChatAppearance>(key:K,value:ChatAppearance[K]){
    const next={...appearance,[key]:value};
    setAppearance(next);
    if(userId)safeStorageSet(appearanceKey(userId),JSON.stringify(next));
  }
  function savePrefs(next:ThreadPreferences){
    if(!userId||prefsOwner!==userId||userIdRef.current!==userId)return;
    setPrefs(next);
    if(userId)safeStorageSet(threadsKey(userId),JSON.stringify(next));
  }
  function togglePinned(id:string){
    savePrefs({...prefs,pinned:prefs.pinned.includes(id)?prefs.pinned.filter(x=>x!==id):[...prefs.pinned,id]});
  }
  function toggleMuted(id:string){
    savePrefs({...prefs,muted:prefs.muted.includes(id)?prefs.muted.filter(x=>x!==id):[...prefs.muted,id]});
  }
  async function markRead(id:string){
    if(!selectedHistory||selectedId!==id||prefsOwner!==userId||!userId||userIdRef.current!==userId||document.visibilityState!=="visible")return;
    if(syncReadMarkers){
      const message=selectedHistory.rows.find(row=>row.request_id===id&&row.sender_id!==userId);
      if(!message||mutationGeneration.current===renderGeneration)return;
      mutationGeneration.current=renderGeneration;setSending(true);setFeedback("");
      const current=()=>accountGeneration.current===renderGeneration&&userIdRef.current===userId&&activeHistoryScope.current===historyScope;
      try{
        await withHoopChatDeadline(async signal=>{
          const {data:{session},error}=await supabase.auth.getSession();
          if(error||session?.user.id!==userId||!current()||document.visibilityState!=="visible")throw Error("Your session changed.");
          await markServerChatRead(supabase,id,message.id,{bearer:"Bearer "+session.access_token,signal});
        });
        if(current())await load();
      }catch(error){if(current())setFeedback(error instanceof Error?error.message:"Read marker could not be synchronized.");}
      finally{
        if(mutationGeneration.current===renderGeneration)mutationGeneration.current=null;
        if(accountGeneration.current===renderGeneration)setSending(false);
      }
      return;
    }
    const next=advanceSeenMarker(selectedHistory.rows,id,userId,prefs.seen[id]);
    if(!next||next===prefs.seen[id])return;
    savePrefs({...prefs,seen:{...prefs.seen,[id]:next}});
  }
  useEffect(()=>{
    if(!selectedId||!selectedHistory||!atLatest||prefsOwner!==userId||!userId||userIdRef.current!==userId)return;
    const markVisible=()=>{
      if(document.visibilityState!=="visible"||!followingLatest.current||userIdRef.current!==userId||activeHistoryScope.current!==historyScope)return;
      const next=advanceSeenMarker(selectedHistory.rows,selectedId,userId,prefs.seen[selectedId]);
      if(!next||next===prefs.seen[selectedId])return;
      const updated={...prefs,seen:{...prefs.seen,[selectedId]:next}};
      setPrefs(updated);safeStorageSet(threadsKey(userId),JSON.stringify(updated));
    };
    markVisible();
    document.addEventListener("visibilitychange",markVisible);
    return()=>document.removeEventListener("visibilitychange",markVisible);
  },[selectedHistory,selectedId,historyScope,userId,prefs,prefsOwner,atLatest]);

  function navigateInbox(direction:"search"|"next"|"previous"|"first"){
    if(!serverInboxEnabled||sending||syncing||loading||inboxRequest.current)return;
    if(direction==="next"){if(!nextCursor)return;cursorStack.current.push(nextCursor);}
    else if(direction==="previous"){if(cursorStack.current.length<=1)return;cursorStack.current.pop();}
    else {cursorStack.current=[null];serverQuery.current=direction==="search"?search.trim().slice(0,80):"";setAppliedServerQuery(serverQuery.current);if(direction==="first")setSearch("");}
    const url=new URL(window.location.href);url.searchParams.delete("thread");window.history.replaceState(null,"",url.pathname+url.search+url.hash);
    activeHistoryScope.current="";historyRequest.current?.abort();setSelectedId(null);setReplyTarget(null);setForwardSelection(null);setNextCursor(null);void load();
  }
  function choose(id:string){
    if(id!==selectedId){
      activeHistoryScope.current="";
      historyRequest.current?.abort();
      historyRequest.current=null;
    }
    setForwardSelection(null);setSelectedId(id);setFeedback("");setSettingsOpen(false);setAtLatest(true);
    if(typeof window!=="undefined"){
      const url=new URL(window.location.href);
      url.searchParams.set("thread",id);
      if(url.pathname==="/notifications")url.searchParams.set("tab","messages");
      window.history.replaceState(null,"",url.pathname+url.search+url.hash);
    }
  }
  function hideBlockedPeer(peer:string){
    const ids=new Set(requests.filter(row=>peerId(row)===peer).map(row=>row.id));
    loadSequence.current++;
    inboxRequest.current?.abort();inboxRequest.current=null;
    activeHistoryScope.current="";
    historyRequest.current?.abort();historyRequest.current=null;
    for(const id of ids)pendingMessages.current.delete(id);
    setRequests(rows=>rows.filter(row=>!ids.has(row.id)));
    setMessages(rows=>rows.filter(row=>!ids.has(row.request_id)));
    setDrafts(previous=>Object.fromEntries(Object.entries(previous).filter(([id])=>!ids.has(id))));
    setHistoryPage(null);setHistoryError(null);setHistoryBusy(null);setSelectedId(null);setReplyTarget(null);setForwardSelection(null);
    setFeedback("Account blocked. Manage blocked accounts in Settings.");
    void load();
  }
  function setDraft(value:string){
    if(!selectedId)return;
    setDrafts(prev=>({...prev,[selectedId]:value.slice(0,2000)}));
  }
  async function forwardTo(destination:string){
    if(!selected||!selectedHistory||!forwardSelection||forwardSelection.scope!==historyScope||forwardSelection.sourceId!==selected.id||sending||!userId)return;
    if(!forwardDestinations(requests,userId,selected.id).some(row=>row.id===destination))return;
    if(drafts[destination]?.trim()){setFeedback("Finish or clear the recipient’s existing draft first.");return;}
    const rev=accountGeneration.current,source=selected.id,scope=historyScope;
    if(mutationGeneration.current===rev)return;
    mutationGeneration.current=rev;setSending(true);
    try{
      const body=await withHoopChatDeadline(signal=>readForwardDraft(supabase,userId,source,forwardSelection.messageId,destination,signal));
      if(rev!==accountGeneration.current||userIdRef.current!==userId||activeHistoryScope.current!==scope)return;
      if(forwardDraft(body,drafts[destination]||"")===null)throw Error("Finish or clear the recipient’s existing draft first.");
      setDrafts(prev=>prev[destination]?.trim()?prev:{...prev,[destination]:body});
      setReplyTarget(null);choose(destination);setFeedback("Forwarded text added to a new draft. Review and send when ready.");
    }catch(e){if(rev===accountGeneration.current)setFeedback(e instanceof Error?e.message:"Forward unavailable.");}
    finally{if(mutationGeneration.current===rev)mutationGeneration.current=null;if(rev===accountGeneration.current)setSending(false);}
  }
  async function respond(status:"accepted"|"rejected"){
    if(!selected||selected.player_id!==userId||selected.status!=="pending"||sending)return;
    const rev=accountGeneration.current;
    if(mutationGeneration.current===rev)return;
    mutationGeneration.current=rev;
    setSending(true);setFeedback("");
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId||rev!==accountGeneration.current)throw new Error("Your session changed. Sign in again.");
      const {data,error}=await supabase.from("player_contact_requests")
        .update({status,responded_at:new Date().toISOString()})
        .eq("id",selected.id).eq("player_id",userId).eq("status","pending").select("id");
      if(rev!==accountGeneration.current)return;
      if(error||!data?.length)throw new Error("Could not update this request.");
      setFeedback(status==="accepted"?"Connection accepted. The conversation is now open.":"Request declined.");
      await load(true);
    }catch(e){if(rev===accountGeneration.current)setError(e instanceof Error?e.message:"Could not respond.");}
    finally{if(mutationGeneration.current===rev)mutationGeneration.current=null;if(rev===accountGeneration.current)setSending(false);}
  }
  async function checkDelivery(){
    if(!selected||selected.status!=="accepted"||!userId||sending)return;
    const rev=accountGeneration.current,thread=selected.id;
    if(mutationGeneration.current===rev)return;
    mutationGeneration.current=rev;setSending(true);setError("");setFeedback("");
    try{
      const status=await withHoopChatDeadline(async signal=>{
        const {data:{user}}=await supabase.auth.getUser();
        const {data:{session},error}=await supabase.auth.getSession();
        if(error||user?.id!==userId||session?.user.id!==userId||signal.aborted||rev!==accountGeneration.current)throw Error("Session changed.");
        const header="Bearer "+session.access_token;
        const blocked=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",userId).eq("blocked_id",peerId(selected)).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
        if(blocked.error||blocked.data||signal.aborted||rev!==accountGeneration.current)throw Error("Conversation unavailable.");
        return webChatOutbox.status(supabase,userId,thread,header,signal,structuredReplies);
      });
      if(rev===accountGeneration.current){setFeedback(chatDeliveryMessage(status));if(status==="delivered"){void loadHistory(userId,thread,undefined,true);await load(true);}}
    }catch(e){if(rev===accountGeneration.current)setError(e instanceof Error?e.message:"Delivery unavailable.");}
    finally{if(mutationGeneration.current===rev)mutationGeneration.current=null;if(rev===accountGeneration.current)setSending(false);}
  }
  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const body=currentDraft.trim();
    if(!selected||selected.status!=="accepted"||!userId||!body||sending)return;
    const rev=accountGeneration.current,thread=selected.id,submittedDraft=currentDraft;
    if(structuredReplies&&replyTarget?.scope===historyScope&&!replyId){setError("Reply target unavailable. Cancel the reply or reload history.");return;}
    if(mutationGeneration.current===rev)return;
    mutationGeneration.current=rev;
    setSending(true);setError("");setFeedback("");
    try{
      await withHoopChatDeadline(async signal=>{
        const {data:{user}}=await supabase.auth.getUser();
        if(user?.id!==userId||rev!==accountGeneration.current)throw new Error("Session changed. Please sign in again.");
        const {data:{session},error:sessionError}=await supabase.auth.getSession();
        if(signal.aborted||sessionError||session?.user.id!==userId||rev!==accountGeneration.current)throw new Error("Session changed. Please sign in again.");
        const header="Bearer "+session.access_token;
        const blocked=await supabase.from("user_blocks").select("blocked_id")
          .eq("blocker_id",userId).eq("blocked_id",peerId(selected)).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
        if(blocked.error||blocked.data||signal.aborted||rev!==accountGeneration.current)throw new Error("Conversation unavailable.");
        if(durableDelivery){const result=await webChatOutbox.send(supabase,userId,thread,submittedDraft,replyId,header,signal,structuredReplies);if(result==="previous_delivered")throw Error("Previous message delivered. Your current draft is kept; review the conversation before sending.");}
        else {const message=prepareConversationMessage(pendingMessages.current,thread,userId,submittedDraft,()=>crypto.randomUUID(),replyId);
        await sendConversationMessage(supabase,message,signal,header);}
      });
      if(rev!==accountGeneration.current)return;
      pendingMessages.current.delete(thread);
      setDrafts(prev=>prev[thread]===submittedDraft?{...prev,[thread]:""}:prev);
      setReplyTarget(current=>current?.scope===historyScope&&current.id===replyId?null:current);
      setFeedback("Message sent.");
      void loadHistory(userId,thread,undefined,true);
      await load(true);
    }catch(e){if(rev===accountGeneration.current)setError(e instanceof Error?e.message:"Message could not be sent.");}
    finally{if(mutationGeneration.current===rev)mutationGeneration.current=null;if(rev===accountGeneration.current)setSending(false);}
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
      <div><p className="eyebrow">HOOPCHAT · COURTSIDE</p><h2>HoopChat<span>.</span></h2>
        <p>Private messages and requests. Contacts must accept before chatting.</p></div>
      <div className="hc-courtside-top-actions">
        {totalUnread>0&&<span className="hc-courtside-unread" aria-label={(syncedCounts&&totalUnread>99?"99+":totalUnread)+" unread items in loaded inbox"+(syncedCounts?" across devices":" on this device")}>{syncedCounts&&totalUnread>99?"99+":totalUnread} new in loaded inbox</span>}
        <button type="button" onClick={()=>void load()} disabled={syncing||sending}>{syncing?"Syncing…":"Refresh"}</button>
        <button type="button" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(value=>!value)}>Customize <span aria-hidden="true">⚙</span></button>
      </div>
    </div>
    {settingsOpen&&<div className="hc-courtside-settings" aria-label="Personalize Courtside">
      <div><strong>Bubble style</strong><div>{(["courtside","classic"] as const).map(v=><button type="button" key={v} aria-pressed={appearance.layout===v} onClick={()=>updateAppearance("layout",v)}>{v==="courtside"?"Courtside cards":"Clean lines"}</button>)}</div></div>
      <div><strong>Message spacing</strong><div>{(["comfortable","compact"] as const).map(v=><button type="button" key={v} aria-pressed={appearance.density===v} onClick={()=>updateAppearance("density",v)}>{v==="comfortable"?"Comfort":"Compact"}</button>)}</div></div>
      <div><strong>Text size</strong><div>{(["normal","large"] as const).map(v=><button type="button" key={v} aria-pressed={appearance.scale===v} onClick={()=>updateAppearance("scale",v)}>{v==="normal"?"Standard":"Large"}</button>)}</div></div>
      <div><strong>Accent</strong><div>{(["orange","blue","purple"] as const).map(v=><button className={"hc-courtside-color is-"+v} type="button" key={v} aria-label={v} aria-pressed={appearance.accent===v} onClick={()=>updateAppearance("accent",v)}/>)}</div></div>
      <p>{syncedCounts?"Mark read to sync your read marker across devices. Preferences and pinned threads stay on this device. Counts include conversations loaded in this inbox.":"Preferences, pinned threads, and unread markers stay on this device. Counts include only loaded inbox items, not all account messages. Your message content is never saved in appearance settings."}</p>
    </div>}
    {error&&<p className="hc-courtside-alert" role="alert">{error}</p>}
    <div className="hc-courtside-shell">
      <aside className="hc-courtside-rail" aria-label="Conversation directory">
        <div className="hc-courtside-rail-search">
          <label htmlFor="hc-courtside-search">Find a conversation</label>
          <input id="hc-courtside-search" type="search" value={search} onChange={event=>setSearch(event.target.value)}
            maxLength={80} placeholder={serverInboxEnabled?"Search all conversations":"Search names or requests"}/>
          {serverInboxEnabled&&<div><button type="button" disabled={syncing||sending} onClick={()=>navigateInbox("search")}>Search all</button><button type="button" disabled={syncing||sending} onClick={()=>navigateInbox("first")}>Clear search</button></div>}
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
                {unread>0&&<strong aria-label={(unread>99?"99+":unread)+" unread items in loaded inbox"+(syncedCounts?" across devices":" on this device")}>{unread>99?"99+":unread}</strong>}</span>
            </button>;
          }):<div className="hc-courtside-list-empty"><strong>{requests.length?"No matching conversations":"Your courtside is open"}</strong>
            <p>{requests.length?"Change your search or filters.":"Connect with another player to start a private thread."}</p>
            <Link href="/players">Discover players</Link></div>}
        </nav>
        {serverInboxEnabled?<><small role="status">Page {serverPage} · {requests.length} conversations · {allUnread===null?"Account unread unavailable":`${allUnread} unread across account`}{appliedServerQuery?` · Search: ${appliedServerQuery}`:""}</small><button type="button" disabled={syncing||sending||loading||serverPage<=1} onClick={()=>navigateInbox("previous")}>Previous page</button><button type="button" disabled={syncing||sending||loading||!nextCursor} onClick={()=>navigateInbox("next")}>Next page</button></>:<><small role="status">{requests.length} conversations loaded{inboxLimit?" · loading limit reached":inboxMore?" · older conversations available":""}. Search covers loaded conversations.</small>
        {inboxMore&&!inboxLimit&&<button type="button" disabled={syncing||sending||loading} onClick={()=>{if(inboxRequest.current||inboxPages.current>=CHAT_INBOX_MAX_PAGES)return;inboxPages.current++;void load();}}>Load older conversations</button>}</>}
      </aside>
      <div className="hc-courtside-stage">
        {selected?<><header className="hc-courtside-stage-header">
          <div className="hc-courtside-identity"><span className="hc-courtside-avatar" aria-hidden="true">{initials(peerName(selected))}</span>
            <span><strong>{peerName(selected)}</strong><small>{selected.status==="accepted"?"Accepted contact · private HoopChat":"Contact request"}</small></span></div>
          <div className="hc-courtside-thread-actions">
            {selected.status==="accepted"&&<button type="button" disabled={!selectedHistory||prefsOwner!==userId||(syncReadMarkers&&sending)} onClick={()=>void markRead(selected.id)}>Mark read</button>}
            <button type="button" aria-pressed={prefs.pinned.includes(selected.id)} onClick={()=>togglePinned(selected.id)}>
              {prefs.pinned.includes(selected.id)?"Unpin":"Pin"} <span aria-hidden="true">★</span></button>
            <button type="button" aria-pressed={prefs.muted.includes(selected.id)} onClick={()=>toggleMuted(selected.id)}>
              {prefs.muted.includes(selected.id)?"Unmute":"Mute"}</button>
            <Link href={peerHref(selected)}>Profile</Link>
          </div>
        </header>
        <HoopChatSafety key={userId+":"+selected.id+":"+sessionRevision} uid={userId} requestId={selected.id} peerId={peerId(selected)} disabled={sending} isCurrent={()=>userIdRef.current===userId&&accountGeneration.current===renderGeneration} onBlocked={()=>hideBlockedPeer(peerId(selected))}/>
        <div ref={historyRef} onScroll={onHistoryScroll} className="hc-courtside-history" role="log" aria-label={"Messages with "+peerName(selected)}>
          <div className="hc-courtside-center-note">🏀 THE COURTSIDE THREAD <span>·</span> Only accepted contacts can read this conversation.</div>
          {selected.message&&<div className="hc-courtside-introduction"><small>CONNECTION INTRODUCTION</small><p>{selected.message}</p></div>}
          {selectedHistoryError?<div role="alert">
            <p>{selectedHistoryError}</p>
            <button type="button" onClick={()=>void loadHistory(userId,selected.id)}>Retry history</button>
          </div>:selectedHistory?.hasMore?<button type="button" disabled={historyBusy===historyScope}
            onClick={()=>void loadHistory(userId,selected.id,selectedHistory.rows.at(-1))}>
            {historyBusy===historyScope?"Loading older messages…":"Load older messages"}
          </button>:historyScope&&historyBusy===historyScope?<p role="status">Loading messages…</p>:null}
          {activeMessages.map(m=><article className={"hc-courtside-message"+(m.sender_id===userId?" is-mine":"")} key={m.id}>
            <span className="hc-courtside-message-sender">{m.sender_id===userId?"You":peerName(selected)}</span>
            {structuredReplies&&m.reply_to_id?<small>{activeMessages.some(row=>row.id===m.reply_to_id)?"Reply to a message in this conversation":"Reply to an earlier message"}</small>:null}
            <p>{m.body}</p><time dateTime={m.created_at}>{formatTime(m.created_at)}</time>
            <button type="button" className="hc-courtside-quote" disabled={sending} aria-label={"Quote message from "+(m.sender_id===userId?"you":peerName(selected))} onClick={()=>{
              if(!selectedHistory||selected.status!=="accepted"||m.request_id!==selected.id||!selectedHistory.rows.some(row=>row.id===m.id))return;
              const next=quoteConversationMessage(selected.id,m,currentDraft);
              if(next===null){setFeedback("Not enough room to quote this message. Shorten your draft first.");return;}
              setDraft(next);setFeedback("Quote added to your draft. Edit it before sending.");
              if(structuredReplies)setReplyTarget(makeReplyTarget(historyScope,selected.id,m,selectedHistory.rows));
              document.getElementById("hc-courtside-compose")?.focus();
            }}>Quote reply</button>
            {m.sender_id===userId&&!m.reply_to_id&&!m.body.trimStart().startsWith(">")&&<button type="button" disabled={sending} className="hc-courtside-quote" onClick={()=>{if(selectedHistory&&selected.status==="accepted"&&selectedHistory.rows.some(row=>row.id===m.id))setForwardSelection({scope:historyScope,sourceId:selected.id,messageId:m.id});}}>Forward my text</button>}</article>)}
          {selectedHistory&&!activeMessages.length&&<div className="hc-courtside-no-messages">
            <strong>Your court is ready.</strong><p>Start with a basketball conversation, not a cold DM.</p></div>}
        </div>
        {forwardSelection?.scope===historyScope&&selected&&selectedHistory?<section aria-label="Choose forward recipient" className="hc-courtside-bottom"><p>Choose an accepted contact. Only your own plain text is copied into an editable draft; no message is sent automatically. Review the text before sharing.</p><button type="button" disabled={sending} onClick={()=>setForwardSelection(null)}>Cancel</button>{forwardDestinations(requests,userId,selected.id).map(row=><button type="button" key={row.id} disabled={sending} onClick={()=>void forwardTo(row.id)}>{peerName(row)}</button>)}</section>:null}
        {feedback&&<p className="hc-courtside-feedback" role="status">{feedback}</p>}
        {selected.status==="accepted"?<div className="hc-courtside-bottom">
          {process.env.NEXT_PUBLIC_HOOPCHECK_PLAYER_REFERENCES_ENABLED==="true"&&userId?<PlayerReferencePanel key={userId+":"+selected.id} userId={userId} connectionId={selected.id}/>:null}
          <div className="hc-courtside-starters"><span>PLAYBOOK</span>
            {STARTERS.map(starter=><button type="button" key={starter.key} onClick={()=>applyStarter(starter.message)}
              title="Insert a suggestion into your draft; nothing sends automatically">{starter.emoji} {starter.label}</button>)}</div>
          {durableDelivery?<button type="button" disabled={sending} onClick={()=>void checkDelivery()}>Check previous delivery</button>:null}
          <form className="hc-courtside-compose" onSubmit={event=>void send(event)}>
            {structuredReplies&&replyTarget?.scope===historyScope?<div><span>{replyId?"Reply linked to a message":"Reply target unavailable"}</span><button type="button" disabled={sending} onClick={()=>setReplyTarget(null)}>Remove reply link</button></div>:null}
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
