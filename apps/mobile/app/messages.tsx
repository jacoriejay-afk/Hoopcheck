import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, GlassCard } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { requireOnline, useNetwork } from "../src/native/network";
import { hoopChatAuthAction, withHoopChatDeadline } from "../src/native/hoopChatLoad";

type ContactRequest = {
  id: string; requester_id: string; player_id: string; message: string | null;
  status: string; created_at: string;
};
type ContactMessage = { id: string; request_id: string; sender_id: string; body: string; created_at: string };
type ContactName = { id: string; display_name: string | null; username: string | null };

export default function MessagesScreen() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { offline } = useNetwork();
  const [userId, setUserId] = useState("");
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [contacts, setContacts] = useState<Record<string,ContactName>>({});
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
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
        const { data, error: requestError } = await supabase.from("player_contact_requests")
          .select("id,requester_id,player_id,message,status,created_at")
          .or(`requester_id.eq.${user.id},player_id.eq.${user.id}`)
          .order("created_at", { ascending: false }).limit(100).abortSignal(signal);
        if (requestError) throw new Error("Messages could not be loaded.");
        const rows = (data || []) as ContactRequest[];
        const accepted = rows.filter(item => item.status === "accepted").map(item => item.id);
        const peerIds = [...new Set(rows.map(item => item.requester_id === user.id ? item.player_id : item.requester_id))];
        const [history, people] = await Promise.all([
          accepted.length ? supabase.from("player_contact_messages")
            .select("id,request_id,sender_id,body,created_at").in("request_id", accepted)
            .order("created_at", { ascending: false }).limit(500).abortSignal(signal)
            : Promise.resolve({ data: [] as ContactMessage[], error: null }),
          peerIds.length ? supabase.from("profiles")
            .select("id,display_name,username").in("id", peerIds).abortSignal(signal)
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
      if (revision === generation.current) setError(failure instanceof Error ? failure.message : "Unable to load messages.");
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
      setRequests([]); setMessages([]); setContacts({}); setUserId(""); setSelectedId("");
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
      setRequests([]); setMessages([]); setContacts({}); setUserId(""); setSelectedId(""); setDraft("");
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
  const selected=requests.find(item=>item.id===selectedId);
  const history=messages.filter(item=>item.request_id===selectedId).slice().reverse();

  async function respond(status:"accepted"|"rejected") {
    if(!selected || selected.player_id!==userId || selected.status!=="pending" || sending) return;
    setSending(true);setError("");
    try {
      await requireOnline();
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw new Error("Your session changed.");
      const {error:updateError}=await supabase.from("player_contact_requests")
        .update({status,responded_at:new Date().toISOString()})
        .eq("id",selected.id).eq("player_id",userId).eq("status","pending");
      if(updateError)throw new Error("Could not update the request.");
      await load();
    }catch(failure){setError(failure instanceof Error?failure.message:"Unable to update request.");}
    finally{setSending(false);}
  }
  async function send(){
    if(!selected || selected.status!=="accepted" || !draft.trim() || sending) return;
    setSending(true);setError("");
    try{
      await requireOnline();
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw new Error("Your session changed.");
      const {error:sendError}=await supabase.from("player_contact_messages")
        .insert({request_id:selected.id,sender_id:userId,body:draft.trim().slice(0,2000)});
      if(sendError)throw new Error("The message was not sent.");
      setDraft("");await load();
    }catch(failure){setError(failure instanceof Error?failure.message:"Message failed.");}
    finally{setSending(false);}
  }
  return <SafeAreaView edges={["bottom","left","right"]} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:12,paddingBottom:35}}>
      <Text accessibilityRole="header" style={{fontSize:27,fontWeight:"900",color:theme.foreground}}>HoopChat</Text>
      <Text style={{color:theme.muted}}>Private player connections and message requests. Players must accept before messaging opens.</Text>
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
        <Button secondary onPress={()=>router.push("/notifications")}>Basketball alerts</Button>
        <Button secondary disabled={loading || offline} onPress={()=>void load()}>Refresh</Button>
      </View>
      {error?<Text accessibilityRole="alert" style={{color:theme.accent}}>{error}</Text>:null}
      {loading?<Text style={{color:theme.muted}}>Loading conversations…</Text>:null}
      {offline?<Text style={{color:theme.muted}}>Reconnect to view or send messages.</Text>:null}
      {!loading&&!sorted.length?<GlassCard><Text style={{color:theme.foreground,fontWeight:"800"}}>No message threads yet</Text><Text style={{color:theme.muted}}>Approved player connections and incoming requests will appear here.</Text><Button secondary onPress={()=>router.push("/players")}>Find players</Button></GlassCard>:null}
      {sorted.length>0?<View style={{gap:8}}>
        <Text style={{color:theme.foreground,fontWeight:"800",fontSize:17}}>Conversations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
          {sorted.map(row=>{
            const latest=messages.find(message=>message.request_id===row.id);
            return <Pressable key={row.id} accessibilityRole="button" accessibilityState={{selected:row.id===selectedId}}
              accessibilityLabel={`Open ${name(row)} conversation`} onPress={()=>{setSelectedId(row.id);setDraft("");}}
              style={{padding:12,width:170,minHeight:96,backgroundColor:row.id===selectedId?theme.accentSurface:theme.surface,borderColor:row.id===selectedId?theme.accent:theme.border,borderWidth:1,borderRadius:theme.radius.card,gap:4}}>
              <Text numberOfLines={1} style={{color:theme.foreground,fontWeight:"800"}}>{name(row)}</Text>
              <Text style={{color:theme.muted,fontSize:12}}>{row.status==="accepted"?"Connected":row.player_id===userId&&row.status==="pending"?"Incoming request":row.status==="pending"?"Awaiting acceptance":row.status}</Text>
              <Text numberOfLines={2} style={{color:theme.muted,fontSize:12}}>{latest?.body||row.message||"No messages yet"}</Text>
            </Pressable>;
          })}
        </ScrollView>
      </View>:null}
      {selected?<GlassCard>
        <Text style={{color:theme.foreground,fontWeight:"900",fontSize:19}}>{name(selected)}</Text>
        <Text style={{color:theme.muted,fontSize:12}}>{selected.status==="accepted"?"Private HoopChat":"Player contact request"}</Text>
        {selected.message?<View style={{padding:12,borderRadius:12,backgroundColor:theme.chip}}><Text style={{color:theme.foreground}}>Introduction: {selected.message}</Text></View>:null}
        <View accessibilityLabel="Conversation history" style={{gap:10,marginVertical:10}}>
          {history.map(item=><View key={item.id} style={{padding:12,borderRadius:14,backgroundColor:item.sender_id===userId?theme.accentSurface:theme.surface,borderColor:theme.border,borderWidth:1,alignSelf:item.sender_id===userId?"flex-end":"flex-start",maxWidth:"95%",gap:4}}>
            <Text style={{fontSize:12,fontWeight:"800",color:theme.foreground}}>{item.sender_id===userId?"You":name(selected)}</Text>
            <Text style={{color:theme.foreground}}>{item.body}</Text>
            <Text style={{color:theme.muted,fontSize:11}}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>)}
        </View>
        {selected.status==="pending"&&selected.player_id===userId?<View style={{gap:8}}><Text style={{color:theme.muted}}>Approve this request to unlock messaging.</Text><Button disabled={sending||offline} onPress={()=>void respond("accepted")}>Accept request</Button><Button secondary disabled={sending||offline} onPress={()=>void respond("rejected")}>Decline</Button></View>:null}
        {selected.status==="accepted"?<View style={{gap:8}}>
          <TextInput accessibilityLabel="Write private HoopChat message" multiline maxLength={2000} value={draft} onChangeText={setDraft} placeholder="Write a message…" placeholderTextColor={theme.muted}
            style={{minHeight:80,textAlignVertical:"top",padding:12,backgroundColor:theme.input,color:theme.foreground,borderWidth:1,borderColor:theme.border,borderRadius:theme.radius.control}} />
          <Button disabled={sending||offline||!draft.trim()} onPress={()=>void send()}>{sending?"Sending…":"Send"}</Button>
        </View>:selected.status==="pending"?<Text style={{color:theme.muted}}>Messaging opens once the player accepts.</Text>:<Text style={{color:theme.muted}}>This request is no longer active.</Text>}
      </GlassCard>:null}
    </ScrollView>
  </SafeAreaView>;
}
