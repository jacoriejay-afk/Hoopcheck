import { useHaptics } from "../src/native/haptics";
import { HoopCheckLoading } from "../components/HoopCheckLoading";
import MessagesScreen from "./messages";
import { hoopChatAuthAction } from "../src/native/hoopChatLoad";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { requireOnline, useNetwork } from "../src/native/network";
import { nativeDestination } from "../src/native/deepLinks";
import { markNotificationsRead, noticeMatches, noticeSearchMatches, notificationPath, readNotifications, NOTIFICATION_PAGE_SIZE, type Notice } from "../src/native/notifications";

export default function Notifications() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const haptic = useHaptics();
  const { offline } = useNetwork();
  const generation = useRef(0);
  const focused = useRef(false);
  const owner = useRef<string | null>(null);
  const marking = useRef(false);
  const paging = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<"activity" | "chat" | "requests">(
    tab === "chat" ? "chat" : tab === "requests" ? "requests" : "activity",
  );
  useEffect(() => {
    if (tab === "chat" || tab === "requests" || tab === "activity") setSection(tab);
  }, [tab]);
  const load = useCallback(async () => {
    const current = ++generation.current;
    owner.current = null; paging.current = false; setLoadingOlder(false); setHasMore(false); setRows([]); setLoading(true); setError(""); setFailed(false);
    try {
      if (offline) throw new Error("Reconnect to view alerts.");
      await requireOnline();
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session) throw new Error("Sign in again to view your alerts.");
      const items = await readNotifications(supabase, data.session.user.id);
      if (current !== generation.current) return;
      owner.current = data.session.user.id; setRows(items); setHasMore(items.length === NOTIFICATION_PAGE_SIZE);
    } catch (failure) {
      if (current === generation.current) { setFailed(true); setError(failure instanceof Error ? failure.message : "Alerts could not load. Try again."); }
    } finally { if (current === generation.current) setLoading(false); }
  }, [offline]);
  useFocusEffect(useCallback(() => {
    focused.current = true; void load();
    return () => { focused.current = false; generation.current++; owner.current = null; setRows([]); setQuery(""); setFilter("all"); };
  }, [load]));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const action = hoopChatAuthAction(event, owner.current, session?.user.id ?? null);
      if (action === "ignore") return;
      generation.current++; owner.current = null; setRows([]); setQuery(""); setFilter("all");
      clearTimeout(timer);
      if (action === "clear") {
        setLoading(false); setFailed(true); setError("Sign in to view your alerts.");
        return;
      }
      // Leave the auth callback before querying Supabase again (its session lock is held).
      timer = setTimeout(() => { if (focused.current) void load(); }, 0);
    });
    return () => { clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [load]);
  async function loadOlder() {
    const cursor = rows[rows.length - 1];
    const userId = owner.current;
    if (!cursor || !userId || !hasMore || loading || paging.current || marking.current || failed || offline) return;
    const current = generation.current;
    paging.current = true; setLoadingOlder(true); setError("");
    try {
      await requireOnline();
      const session = await supabase.auth.getSession();
      if (session.error || session.data.session?.user.id !== userId || current !== generation.current) throw Error("Verify your session again.");
      const older = await readNotifications(supabase, userId, cursor);
      if (current !== generation.current || owner.current !== userId) return;
      setRows(previous => {
        const seen = new Set(previous.map(row => row.id));
        return [...previous, ...older.filter(row => !seen.has(row.id))];
      });
      setHasMore(older.length === NOTIFICATION_PAGE_SIZE);
    } catch (failure) {
      if (current === generation.current) setError(failure instanceof Error ? failure.message : "Older alerts could not load. Try again.");
    } finally {
      if (current === generation.current) { paging.current = false; setLoadingOlder(false); }
    }
  }
  async function markAll() {
    if (marking.current || paging.current || failed || offline || !owner.current) return;
    marking.current = true; setBusy(true); setError("");
    const current = generation.current;
    const userId = owner.current;
    try {
      await requireOnline();
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || data.session?.user.id !== userId || current !== generation.current) throw new Error("Verify your session to reload alerts.");
      const result = await markNotificationsRead(supabase, userId);
      if (current === generation.current && owner.current === userId) setRows(previous => previous.map(item => result.ids.includes(item.id) ? { ...item, read_at: item.read_at || result.readAt } : item));
    } catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : "Alerts could not be marked as read."); }
    finally { marking.current = false; setBusy(false); }
  }
  async function openNotice(item: Notice, navigate = true) {
    const path = notificationPath(item);
    if ((navigate && !path) || (!navigate && item.read_at) || marking.current || paging.current || !owner.current || offline) return;
    const current = generation.current; const userId = owner.current;
    marking.current = true; setBusy(true); setError("");
    try {
      await requireOnline();
      const session = await supabase.auth.getSession();
      if (session.error || session.data.session?.user.id !== userId || current !== generation.current) throw Error("Verify your session again.");
      if (!item.read_at) {
        const result = await markNotificationsRead(supabase, userId, new Date(), item.id);
        if (current !== generation.current || owner.current !== userId) return;
        setRows(previous => previous.map(row => result.ids.includes(row.id) ? { ...row, read_at: result.readAt } : row));
      }
      if (navigate && path && current === generation.current && owner.current === userId) { haptic("tab"); router.push(nativeDestination(path) as "/dashboard"); }
    } catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : "Activity could not be opened."); }
    finally { marking.current = false; setBusy(false); }
  }
  const items = offline ? [] : rows;
  const visibleItems = items.filter(item => noticeMatches(item, filter) && noticeSearchMatches(item, query));
  const canMarkAll = !loading && !loadingOlder && !busy && !failed && !offline && (hasMore || items.some(item => !item.read_at));
  return <SafeAreaView edges={["top","left","right"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 7, gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 25 }}>Alerts</Text>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 7 }}>
        {([
          { id: "activity", label: "Activity" },
          { id: "chat", label: "HoopChat" },
          { id: "requests", label: "Requests" },
        ] as const).map(tab => <Pressable key={tab.id}
          accessibilityRole="tab" accessibilityLabel={tab.label}
          accessibilityState={{ selected: section === tab.id }}
          onPress={() => { haptic("tab"); setSection(tab.id); }}
          style={({pressed}) => ({
            minHeight: 44, flex: 1, alignItems: "center", justifyContent: "center",
            borderRadius: 12, borderWidth: section === tab.id ? 1 : 0,
            borderColor: theme.accent,
            backgroundColor: section === tab.id ? theme.accentSurface : "transparent",
            opacity: pressed ? .8 : 1,
          })}>
          <Text style={{ color: section === tab.id ? theme.accent : theme.foreground,
            fontSize: 13, fontWeight: "800" }}>{tab.label}</Text>
        </Pressable>)}
      </View>
    </View>
    {section !== "activity"
      ? <MessagesScreen embedded mode={section === "chat" ? "conversations" : "requests"} />
      : <FlatList ListHeaderComponent={<View style={{ gap: 8, paddingBottom: 9 }}>
      <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8}}><Text style={{ color: theme.muted, fontSize: 12,flex:1 }}>{loading ? "Checking activity…" : `${items.filter(item => !item.read_at).length} unread · ${items.length} loaded${hasMore ? " · more available" : ""}`}</Text><Pressable accessibilityRole="button" disabled={!canMarkAll} accessibilityState={{disabled:!canMarkAll}} onPress={()=>void markAll()} style={{minHeight:44,justifyContent:"center",paddingHorizontal:5}}><Text style={{color:canMarkAll?theme.accent:theme.muted,fontSize:12,fontWeight:"700"}}>{busy?"Updating…":"Mark all as read"}</Text></Pressable></View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{["all", "unread", "games", "clubs", "reviews"].map(value => <Pressable key={value} accessibilityRole="button" aria-pressed={filter === value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 9, borderRadius: 14, backgroundColor: filter === value ? theme.accentSurface : theme.chip }}><Text style={{ color: filter === value ? theme.accent : theme.foreground, fontSize: 12, textTransform: "capitalize" }}>{value}</Text></Pressable>)}</View>
      <View style={{flexDirection:"row",alignItems:"center",gap:8,borderWidth:1,borderColor:theme.glassBorder,borderRadius:12,paddingHorizontal:10}}>
        <Ionicons name="search-outline" size={18} color={theme.muted}/>
        <TextInput accessibilityLabel="Search loaded alerts" placeholder="Search loaded alerts" placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" maxLength={160} returnKeyType="search" style={{flex:1,minHeight:44,color:theme.foreground,fontSize:14}}/>
        {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear alert search" onPress={()=>setQuery("")} style={{minHeight:44,minWidth:44,alignItems:"center",justifyContent:"center"}}><Ionicons name="close-circle-outline" size={19} color={theme.muted}/></Pressable> : null}
      </View>
      {query.trim() ? <Text accessibilityLiveRegion="polite" style={{color:theme.muted,fontSize:12}}>{visibleItems.length} matching loaded alerts{hasMore ? " · load older alerts to search more" : ""}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text> : null}
    </View>} data={visibleItems} keyboardShouldPersistTaps="handled" keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 5, paddingBottom: 20, gap: 2 }} ListFooterComponent={hasMore && !offline && !failed ? <View style={{ paddingVertical: 12, gap: 6 }}><Button secondary disabled={loadingOlder || loading || busy} onPress={() => void loadOlder()}>{loadingOlder ? "Loading older alerts…" : "Load older alerts"}</Button>{error ? <Text accessibilityRole="alert" style={{color:theme.muted}}>{error}</Text> : null}</View> : null} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} renderItem={({ item }) => {
      const path = notificationPath(item);
      return <View style={{ borderBottomWidth: 1, borderColor: theme.glassBorder }}><Pressable accessibilityRole="button" disabled={!path || busy || loadingOlder} accessibilityState={{ disabled: !path || busy || loadingOlder }} onPress={() => void openNotice(item)} style={({ pressed }) => ({ minHeight: 61, gap: 4, paddingHorizontal: 8, paddingVertical: 10, opacity: pressed ? .7 : 1 })}>
        <View style={{flexDirection:"row",alignItems:"center",gap:6}}><Ionicons name={item.read_at?"notifications-outline":"notifications"} size={16} color={theme.accent}/><Text style={{ color: theme.accent, fontWeight: "700",fontSize:11 }}>{item.read_at ? "" : "● "}{item.notification_type.replaceAll("_", " ").toUpperCase()}</Text></View>
        <Text style={{ color: theme.foreground, fontSize: 14, fontWeight: "800" }}>{item.title}</Text>
        <Text style={{ color: theme.foreground }}>{item.body}</Text>
        <Text style={{ color: theme.muted }}>{new Date(item.created_at).toLocaleString()}</Text>
      </Pressable>{!item.read_at ? <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${item.title} as read`} disabled={busy || loadingOlder || offline} accessibilityState={{disabled:busy || loadingOlder || offline}} onPress={() => void openNotice(item, false)} style={{ minHeight:44, alignSelf:"flex-end", justifyContent:"center", paddingHorizontal:8 }}><Text style={{ color:theme.accent, fontWeight:"700", fontSize:12 }}>Mark as read</Text></Pressable> : null}</View>;
    }} ListEmptyComponent={loading ? <HoopCheckLoading compact label="Checking activity…" /> : <View style={{ gap: 12, padding: 20,alignItems:"center" }}><Ionicons name="notifications-outline" size={30} color={theme.muted}/><Text style={{ color: theme.foreground,textAlign:"center" }}>{offline ? "Reconnect to view alerts." : failed ? "Alerts are unavailable." : items.length ? (hasMore ? "No matching alerts in the loaded history. Load older alerts or change the search or filter." : query.trim() ? "No loaded alerts match your search." : "Nothing in this category.") : "No notifications yet."}</Text>{failed ? <Button secondary onPress={() => void load()}>Retry loading alerts</Button> : <Button secondary onPress={() => router.push("/teams")}>Find teams</Button>}</View>} />}
  </SafeAreaView>;
}
