import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "../src/primitives";
import {PlayerReferencePanel} from "../components/PlayerReferencePanel";
import { ConversationSafety } from "../components/ConversationSafety";
import { readWithDeadline } from "../src/native/readDeadline";
import { ChatMessageEnter, ChatTypingBasketball, useConfirmedMessageMotion } from "../components/chat/ChatMotion";
import { HoopCheckLoading } from "../components/HoopCheckLoading";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { requireOnline, useNetwork } from "../src/native/network";
import { hoopChatAuthAction, withHoopChatDeadline } from "../src/native/hoopChatLoad";
import { appendConversationPage, CHAT_HISTORY_PAGE_SIZE, matchesConversationSearch, readConversationPage, refreshConversationPage, type ContactMessage } from "../src/native/hoopChatHistory";
import { prepareConversationMessage, sendConversationMessage } from "../src/native/hoopChatSend";
import { quoteConversationMessage } from "../src/native/hoopChatQuote";

type ContactRequest = {
  id: string; requester_id: string; player_id: string; message: string | null;
  status: string; created_at: string;
};
type ContactName = { id: string; display_name: string | null; username: string | null };
const EMPTY_THREAD_MESSAGES: ContactMessage[] = [];
async function verifiedChatBearer(uid:string){
  const session=await readWithDeadline(()=>supabase.auth.getSession());
  if(session.error||!session.data.session||session.data.session.user.id!==uid)throw Error("Verify your account again.");
  return "Bearer "+session.data.session.access_token;
}
async function verifyChatPeer(uid:string,peer:string,signal:AbortSignal){
  const header=await verifiedChatBearer(uid);
  if(signal.aborted)throw Error("Conversation check expired.");
  const result=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",uid).eq("blocked_id",peer).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
  if(result.error||result.data||signal.aborted)throw Error("Conversation unavailable. Check blocked accounts in Settings.");
  return header;
}

export default function MessagesScreen({ embedded = false, mode = "all" }: { embedded?: boolean; mode?: "all" | "conversations" | "requests" } = {}) {
  const theme = useEntryTheme();
  const router = useRouter();
  const { offline } = useNetwork();
  const [userId, setUserId] = useState("");
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [contacts, setContacts] = useState<Record<string,ContactName>>({});
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [openedId, setOpenedId] = useState("");
  const [openedMode, setOpenedMode] = useState(mode);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // React state updates are not synchronous; prevent duplicate mutations before the next render.
  const mutationLocked = useRef(false);
  const pendingMessages = useRef(new Map<string, Omit<ContactMessage, "created_at">>());
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [threadPage, setThreadPage] = useState<{scope:string;rows:ContactMessage[];hasMore:boolean}|null>(null);
  const [threadError,setThreadError] = useState<{scope:string;message:string}|null>(null);
  const [historyBusy,setHistoryBusy] = useState(false);
  const historyRequest = useRef(0);
  const historyPaging = useRef(false);
  const generation = useRef(0);
  const authIdentity = useRef<string | null>(null);
  const focused = useRef(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const revision = ++generation.current;
    setLoading(true); setError("");
    try {
      // Auth and request fetches can stall independently. Only the winning,
      // still-current generation is allowed to update the message screen.
      const result = await withHoopChatDeadline(async signal => {
        await requireOnline();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Sign in to view your messages.");
        const header=await verifiedChatBearer(user.id);
        const blocked=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",user.id).limit(501).setHeader("Authorization",header).abortSignal(signal);
        if(blocked.error||!Array.isArray(blocked.data)||blocked.data.length>500)throw Error("Blocked accounts could not be verified.");
        const blockedIds=new Set(blocked.data.map(row=>row.blocked_id));
        const { data, error: requestError } = await supabase.from("player_contact_requests")
          .select("id,requester_id,player_id,message,status,created_at")
          .or(`requester_id.eq.${user.id},player_id.eq.${user.id}`)
          .order("created_at", { ascending: false }).limit(100).setHeader("Authorization",header).abortSignal(signal);
        if (requestError) throw new Error("Messages could not be loaded.");
        const rows = ((data || []) as ContactRequest[]).filter(row=>!blockedIds.has(row.requester_id===user.id?row.player_id:row.requester_id));
        const accepted = rows.filter(item => item.status === "accepted").map(item => item.id);
        const peerIds = [...new Set(rows.map(item => item.requester_id === user.id ? item.player_id : item.requester_id))];
        const [history, people] = await Promise.all([
          accepted.length ? supabase.from("player_contact_messages")
            .select("id,request_id,sender_id,body,created_at").in("request_id", accepted)
            .order("created_at", { ascending: false }).limit(500).setHeader("Authorization",header).abortSignal(signal)
            : Promise.resolve({ data: [] as ContactMessage[], error: null }),
          peerIds.length ? supabase.from("profiles")
            .select("id,display_name,username").in("id", peerIds).setHeader("Authorization",header).abortSignal(signal)
            : Promise.resolve({ data: [] as ContactName[], error: null }),
        ]);
        if (history.error) throw new Error("Conversation history could not be loaded.");
        return { userId: user.id, rows, messages: (history.data || []) as ContactMessage[],
          contacts: (people.data || []) as ContactName[] };
      });
      if (revision !== generation.current) return;
      authIdentity.current = result.userId;
      setUserId(result.userId); setRequests(result.rows); setMessages(result.messages);
      setContacts(Object.fromEntries(result.contacts.map(person => [person.id, person])));
      setSelectedId(current => result.rows.some(item => item.id === current) ? current : (result.rows[0]?.id || ""));
    } catch (failure) {
      if (revision === generation.current) { setRequests([]);setMessages([]);setContacts({});setOpenedId("");setThreadPage(null);setError(failure instanceof Error ? failure.message : "Unable to load messages."); }
    } finally {
      if (revision === generation.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void load();
    return () => {
      focused.current = false;
      if (reloadTimer.current !== null) clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
      generation.current++;
      setRequests([]); setMessages([]); setContacts({}); setUserId(""); setSelectedId(""); setOpenedId(""); setDraft(""); setSearch(""); setThreadPage(null); setThreadError(null); historyRequest.current++; historyPaging.current=false; setHistoryBusy(false);
    };
  }, [load]));

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      const action = hoopChatAuthAction(event, authIdentity.current, nextUserId);
      if (action === "ignore") return;
      if (reloadTimer.current !== null) clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
      generation.current++;
      authIdentity.current = nextUserId;
      pendingMessages.current.clear();
      setRequests([]); setMessages([]); setContacts({}); setUserId(""); setSelectedId(""); setOpenedId(""); setDraft(""); setSearch(""); setThreadPage(null); setThreadError(null); historyRequest.current++; historyPaging.current=false; setHistoryBusy(false);
      if (action === "clear") {
        setLoading(false);
        setError("Sign in to view your messages.");
      } else {
        setError("");
        if (focused.current) {
          setLoading(true);
          // Never start a Supabase request synchronously from its Auth callback.
          reloadTimer.current = setTimeout(() => {
            reloadTimer.current = null;
            if (focused.current && authIdentity.current === nextUserId) void load();
          }, 0);
        } else {
          setLoading(false);
        }
      }
    });
    return () => {
      data.subscription.unsubscribe();
      if (reloadTimer.current !== null) clearTimeout(reloadTimer.current);
    };
  }, [load]);

  const peerId=(request:ContactRequest)=>request.requester_id===userId?request.player_id:request.requester_id;
  const name=(request:ContactRequest)=>{
    const peer=contacts[peerId(request)];
    return peer?.display_name?.trim() || (peer?.username ? "@"+peer.username : "HoopCheck member");
  };
  const sorted=useMemo(()=>requests.slice().sort((a,b)=>
    (messages.find(item=>item.request_id===b.id)?.created_at||b.created_at)
      .localeCompare(messages.find(item=>item.request_id===a.id)?.created_at||a.created_at)),[requests,messages]);
  // The full /messages route still shows all threads. Alerts only narrows
  // existing owner-scoped records; it does not alter authorization.
  const visibleThreads = sorted.filter(row => mode === "all"
    || (mode === "conversations" && row.status === "accepted")
    || (mode === "requests" && row.status === "pending"));
  const selected = visibleThreads.find(item => item.id === selectedId) || visibleThreads[0];
  const opened = Boolean(selected && selected.id === openedId && openedMode === mode);
  useEffect(() => { setOpenedId(""); setDraft(""); setSearch(""); }, [mode]);
  const selectedRequestId = selected?.id;
  const threadScope = userId && opened && selected?.status==="accepted" && !offline ? JSON.stringify([userId,selected.id,mode]) : "";
  const currentPage=!loading && threadScope && threadPage?.scope===threadScope ? threadPage : null;
  const currentThreadError=threadScope && threadError?.scope===threadScope ? threadError.message : "";
  const verifiedThreadRows = currentPage?.rows ?? EMPTY_THREAD_MESSAGES;
  const history=verifiedThreadRows.slice().reverse();
  const motionActive=Boolean(threadScope && currentPage);
  const freshIds=useConfirmedMessageMotion(`${userId}:${openedId}:${mode}`,verifiedThreadRows,motionActive,selectedRequestId);
  const matchingThreads=visibleThreads.filter(row=>matchesConversationSearch(search,name(row),contacts[peerId(row)]?.username));
  const loadThread=useCallback(async (scope:string,requestId:string,viewerId:string,older?:ContactMessage,refresh=false) => {
    if (historyPaging.current || !scope || !focused.current) return;
    const revision=++historyRequest.current;
    const accountRevision=generation.current;
    historyPaging.current=true;
    if (!refresh) setHistoryBusy(true);
    setThreadError(null);
    const active=()=>revision===historyRequest.current && accountRevision===generation.current && focused.current && authIdentity.current===viewerId;
    try {
      const rows=await withHoopChatDeadline(async signal=>{
        await requireOnline();
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if (authError || user?.id!==viewerId || !active()) throw Error("Your session changed.");
        const header=await verifiedChatBearer(viewerId);
        const target=await supabase.from("player_contact_requests").select("requester_id,player_id,status").eq("id",requestId).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
        if(target.error||target.data?.status!=="accepted"||![target.data.requester_id,target.data.player_id].includes(viewerId))throw Error("Conversation unavailable.");
        const verifiedHeader=await verifyChatPeer(viewerId,target.data.requester_id===viewerId?target.data.player_id:target.data.requester_id,signal);
        if(!active())throw Error("Your session changed.");
        return readConversationPage(supabase,requestId,signal,older,verifiedHeader);
      });
      if (!active()) return;
      setThreadPage(previous => {
        const hasMore = rows.length === CHAT_HISTORY_PAGE_SIZE;
        if (previous?.scope !== scope) return { scope, rows, hasMore };
        if (older) return { scope, rows: appendConversationPage(previous.rows, rows), hasMore };
        if (!refresh) return { scope, rows, hasMore };
        const latest = refreshConversationPage(previous.rows, rows);
        return { scope, rows: latest, hasMore: latest.length > rows.length ? previous.hasMore : hasMore };
      });
    } catch (failure) {
      if(active()){setThreadPage(null);setThreadError({scope,message:failure instanceof Error?failure.message:"Conversation history could not load."});}
    } finally {
      if (revision===historyRequest.current){historyPaging.current=false;setHistoryBusy(false);}
    }
  },[]);
  useEffect(()=>{
    historyRequest.current++;historyPaging.current=false;setHistoryBusy(false);setThreadError(null);
    if (!threadScope || !selectedRequestId){setThreadPage(null);return;}
    if (!loading) void loadThread(threadScope,selectedRequestId,userId);
    return ()=>{historyRequest.current++;historyPaging.current=false;};
  },[threadScope,selectedRequestId,userId,loading,loadThread]);

  useEffect(() => {
    if (!threadScope || !selectedRequestId) return;
    const refresh = () => {
      if (focused.current && authIdentity.current === userId && (AppState.currentState === "active" || AppState.currentState === null)) {
        void loadThread(threadScope, selectedRequestId, userId, undefined, true);
      }
    };
    const channel = supabase.channel(`native-hoopchat:${selectedRequestId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "player_contact_messages", filter: `request_id=eq.${selectedRequestId}` }, refresh)
      .subscribe();
    const timer = setInterval(refresh, 25_000);
    const appState = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => {
      clearInterval(timer);
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [threadScope, selectedRequestId, userId, loadThread]);

  async function respond(status:"accepted"|"rejected") {
    if(!selected || selected.player_id!==userId || selected.status!=="pending" || !opened || sending || offline || mutationLocked.current) return;
    mutationLocked.current=true;
    const actionGeneration = generation.current;
    setSending(true);setError("");
    try {
      await requireOnline();
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId || actionGeneration!==generation.current || !focused.current)throw new Error("Your session changed.");
      const header=await withHoopChatDeadline(signal=>verifyChatPeer(userId,peerId(selected),signal));
      if(actionGeneration!==generation.current||!focused.current)throw Error("Your session changed.");
      const {data:updated,error:updateError}=await supabase.from("player_contact_requests")
        .update({status,responded_at:new Date().toISOString()})
        .eq("id",selected.id).eq("player_id",userId).eq("status","pending").setHeader("Authorization",header).select("id");
      if(updateError||!updated?.length)throw new Error("Could not update the request.");
      if(actionGeneration===generation.current && focused.current) await load();
    }catch(failure){if(actionGeneration===generation.current && focused.current)setError(failure instanceof Error?failure.message:"Unable to update request.");}
    finally{mutationLocked.current=false;setSending(false);}
  }
  async function send(){
    if(!selected || selected.status!=="accepted" || !opened || !draft.trim() || sending || offline || mutationLocked.current) return;
    mutationLocked.current=true;
    const submittedDraft=draft;
    const actionGeneration = generation.current;
    setSending(true);setError("");
    try{
      await withHoopChatDeadline(async signal=>{
        await requireOnline();
        const {data:{user}}=await supabase.auth.getUser();
        if(signal.aborted||user?.id!==userId||actionGeneration!==generation.current||!focused.current)throw new Error("Your session changed.");
        const header=await verifyChatPeer(userId,peerId(selected),signal);
        if(signal.aborted||actionGeneration!==generation.current||!focused.current)throw new Error("Your session changed.");
        const message=prepareConversationMessage(pendingMessages.current,selected.id,userId,submittedDraft,randomUUID);
        await sendConversationMessage(supabase,message,signal,header);
      });
      if(actionGeneration===generation.current && focused.current){
        pendingMessages.current.delete(selected.id);
        setDraft(current=>current===submittedDraft?"":current);
        await load();
      }
    }catch(failure){if(actionGeneration===generation.current && focused.current)setError(failure instanceof Error?failure.message:"Message failed.");}
    finally{mutationLocked.current=false;setSending(false);}
  }
  return <SafeAreaView edges={embedded ? ["left","right"] : ["bottom","left","right"]} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:embedded?12:16,gap:embedded?8:12,paddingBottom:embedded?120:35}}>
      {!embedded ? <Text accessibilityRole="header" style={{fontSize:27,fontWeight:"900",color:theme.foreground}}>HoopChat</Text> : null}
      {!embedded ? <Text style={{color:theme.muted}}>Private player connections and message requests. Players must accept before messaging opens.</Text> : null}
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
        {!embedded ? <Button secondary onPress={()=>router.push("/notifications")}>Basketball alerts</Button> : null}
        <Button secondary disabled={loading || offline || sending} onPress={()=>{if(!mutationLocked.current)void load();}}>Refresh</Button>
      </View>
      {error?<Text accessibilityRole="alert" style={{color:theme.accent}}>{error}</Text>:null}
      {loading&&!visibleThreads.length?<HoopCheckLoading compact label="Loading conversations…" />:null}
      {offline?<Text style={{color:theme.muted}}>Reconnect to view or send messages.</Text>:null}
      {!loading&&!visibleThreads.length?<View style={{gap:7,paddingVertical:12}}>
        <Text style={{color:theme.foreground,fontWeight:"800"}}>
          {mode==="requests"?"No pending requests":mode==="conversations"?"No conversations yet":"No message threads yet"}
        </Text>
        <Text style={{color:theme.muted}}>Approved player connections and incoming requests will appear here.</Text>
        <Button secondary onPress={()=>router.push("/players")}>Find players</Button>
      </View>:null}
      {!opened&&visibleThreads.length>0?<View style={{gap:4}}>
        <Text style={{color:theme.foreground,fontWeight:"800",fontSize:17}}>{mode==="requests"?"Contact requests":"Conversations"}</Text>
        <TextInput accessibilityLabel="Search conversations by name or username" value={search} onChangeText={setSearch} maxLength={80} placeholder="Search by name or @username" placeholderTextColor={theme.muted} style={{minHeight:44,paddingHorizontal:12,backgroundColor:theme.input,color:theme.foreground,borderColor:theme.border,borderWidth:1,borderRadius:theme.radius.control}} />
        {!matchingThreads.length?<Text style={{color:theme.muted,paddingVertical:10}}>No matching conversations in your loaded inbox.</Text>:null}
        <View style={{gap:0}}>
          {matchingThreads.map(row=>{
            const latest=messages.find(message=>message.request_id===row.id);
            return <Pressable key={row.id} accessibilityRole="button" accessibilityState={{selected:row.id===selectedId}}
              accessibilityLabel={`Open ${name(row)} conversation`} disabled={sending} onPress={()=>{setSelectedId(row.id);setOpenedMode(mode);setOpenedId(row.id);setDraft("");}}
              style={{paddingVertical:10,paddingHorizontal:4,minHeight:64,flexDirection:"row",alignItems:"center",borderColor:theme.border,borderBottomWidth:1,gap:10}}>
              <View style={{width:42,height:42,borderRadius:21,backgroundColor:theme.chip,alignItems:"center",justifyContent:"center"}}><Text style={{color:theme.foreground,fontSize:17,fontWeight:"700"}}>{name(row).slice(0,1).toUpperCase()}</Text></View>
              <View style={{flex:1,minWidth:0,gap:3}}>
              <Text numberOfLines={1} style={{color:theme.foreground,fontWeight:"800"}}>{name(row)}</Text>
              <Text style={{color:theme.muted,fontSize:12}}>{row.status==="accepted"?"Connected":row.player_id===userId&&row.status==="pending"?"Incoming request":row.status==="pending"?"Awaiting acceptance":row.status}</Text>
              <Text numberOfLines={1} style={{color:theme.muted,fontSize:12}}>{latest?.body||row.message||"No messages yet"}</Text>
              </View><Ionicons name="chevron-forward" size={17} color={theme.muted}/>
            </Pressable>;
          })}
        </View>
      </View>:null}
      {opened&&selected?<View style={{gap:8}}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to conversations" disabled={sending} onPress={()=>{setOpenedId("");setDraft("");}} style={{minHeight:44,flexDirection:"row",alignItems:"center",gap:6}}><Ionicons name="chevron-back" size={20} color={theme.accent}/><Text style={{color:theme.accent,fontWeight:"700"}}>Conversations</Text></Pressable>
        <Text style={{color:theme.foreground,fontWeight:"900",fontSize:19}}>{name(selected)}</Text>
        <Text style={{color:theme.muted,fontSize:12}}>{selected.status==="accepted"?"Private HoopChat":"Player contact request"}</Text>
        <ConversationSafety key={`${userId}:${selected.id}`} uid={userId} requestId={selected.id} peerId={peerId(selected)} onBlocked={()=>{historyRequest.current++;setOpenedId("");setDraft("");setThreadPage(null);setRequests(rows=>rows.filter(row=>peerId(row)!==peerId(selected)));void load();}}/>
        {selected.message?<View style={{padding:12,borderRadius:12,backgroundColor:theme.chip}}><Text style={{color:theme.foreground}}>Introduction: {selected.message}</Text></View>:null}
        <View accessibilityLabel="Conversation history" style={{gap:10,marginVertical:10}}>
          {threadScope && !currentPage && !currentThreadError ? <HoopCheckLoading compact label="Loading conversation history…" /> : null}
          {currentThreadError ? <Text accessibilityRole="alert" style={{color:theme.accent}}>{currentThreadError}</Text> : null}
          {threadScope && selectedRequestId && (currentPage?.hasMore || currentThreadError) ? <Button secondary disabled={historyBusy || loading || offline || sending} onPress={()=>void loadThread(threadScope,selectedRequestId,userId,currentPage?.hasMore?currentPage.rows[currentPage.rows.length-1]:undefined)}>{historyBusy?"Loading history…":currentThreadError?"Retry history":"Load older messages"}</Button> : null}
          {currentPage && !history.length && !historyBusy && !currentThreadError ? <Text style={{color:theme.muted}}>No messages yet.</Text> : null}
          {history.map(item=><ChatMessageEnter key={item.id} fresh={freshIds.has(item.id)} incoming={item.sender_id!==userId} active={motionActive}><View style={{padding:10,borderRadius:18,backgroundColor:item.sender_id===userId?theme.accentSurface:theme.surface,alignSelf:item.sender_id===userId?"flex-end":"flex-start",maxWidth:"95%",gap:4}}>
            <Text style={{fontSize:12,fontWeight:"800",color:theme.foreground}}>{item.sender_id===userId?"You":name(selected)}</Text>
            <Text style={{color:theme.foreground}}>{item.body}</Text>
            <Text style={{color:theme.muted,fontSize:11}}>{new Date(item.created_at).toLocaleString()}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Quote message from ${item.sender_id===userId?"you":name(selected)}`} disabled={sending||offline} onPress={()=>{
              if(!currentPage||selected.status!=="accepted"||item.request_id!==selected.id||!currentPage.rows.some(row=>row.id===item.id))return;
              const next=quoteConversationMessage(selected.id,item,draft);
              if(next===null){setError("Not enough room to quote this message. Shorten your draft first.");return;}
              setDraft(next);setError("");
            }} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:theme.foreground,fontSize:12,fontWeight:"700"}}>Quote reply</Text></Pressable>
          </View></ChatMessageEnter>)}
        </View>
        {selected.status==="pending"&&selected.player_id===userId?<View style={{gap:8}}><Text style={{color:theme.muted}}>Approve this request to unlock messaging.</Text><Button disabled={sending||offline} onPress={()=>void respond("accepted")}>Accept request</Button><Button secondary disabled={sending||offline} onPress={()=>void respond("rejected")}>Decline</Button></View>:null}
        {selected.status==="accepted"?<View style={{gap:8}}>
          {process.env.EXPO_PUBLIC_HOOPCHECK_PLAYER_REFERENCES_ENABLED==="true"&&userId?<PlayerReferencePanel key={userId+":"+selected.id} userId={userId} connectionId={selected.id} offline={offline}/>:null}
          <ChatTypingBasketball active={motionActive && Boolean(draft.trim()) && !sending} />
          <TextInput accessibilityLabel="Write private HoopChat message" editable={!sending && !offline} multiline maxLength={2000} value={draft} onChangeText={setDraft} placeholder="Write a message…" placeholderTextColor={theme.muted}
            style={{minHeight:48,maxHeight:120,textAlignVertical:"top",padding:12,backgroundColor:theme.input,color:theme.foreground,borderWidth:1,borderColor:theme.border,borderRadius:theme.radius.control}} />
          <Button disabled={sending||offline||!draft.trim()} onPress={()=>void send()}>{sending?"Sending…":"Send"}</Button>
        </View>:selected.status==="pending"?<Text style={{color:theme.muted}}>Messaging opens once the player accepts.</Text>:<Text style={{color:theme.muted}}>This request is no longer active.</Text>}
      </View>:null}
    </ScrollView>
  </SafeAreaView>;
}
