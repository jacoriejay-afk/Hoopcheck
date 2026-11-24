import { useHaptics } from "../src/native/haptics";
import { HoopCheckLoading } from "../components/HoopCheckLoading";
import MessagesScreen from "./messages";
import { hoopChatAuthAction } from "../src/native/hoopChatLoad";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { requireOnline, useNetwork } from "../src/native/network";
import { nativeDestination } from "../src/native/deepLinks";
import { markNotificationsRead, noticeMatches, notificationPath, readNotifications, type Notice } from "../src/native/notifications";

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
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("all");
  const [section, setSection] = useState<"activity" | "chat" | "requests">(
    tab === "chat" ? "chat" : tab === "requests" ? "requests" : "activity",
  );
  useEffect(() => {
    if (tab === "chat" || tab === "requests" || tab === "activity") setSection(tab);
  }, [tab]);
  const load = useCallback(async () => {
    const current = ++generation.current;
    owner.current = null; setRows([]); setLoading(true); setError(""); setFailed(false);
    try {
      if (offline) throw new Error("Reconnect to view alerts.");
      await requireOnline();
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session) throw new Error("Sign in again to view your alerts.");
      const items = await readNotifications(supabase, data.session.user.id);
      if (current !== generation.current) return;
      owner.current = data.session.user.id; setRows(items);
    } catch (failure) {
      if (current === generation.current) { setFailed(true); setError(failure instanceof Error ? failure.message : "Alerts could not load. Try again."); }
    } finally { if (current === generation.current) setLoading(false); }
  }, [offline]);
  useFocusEffect(useCallback(() => {
    focused.current = true; void load();
    return () => { focused.current = false; generation.current++; owner.current = null; setRows([]); };
  }, [load]));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const action = hoopChatAuthAction(event, owner.current, session?.user.id ?? null);
      if (action === "ignore") return;
      generation.current++; owner.current = null; setRows([]);
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
  async function markAll() {
    if (marking.current || failed || offline || !owner.current) return;
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
  async function openNotice(item: Notice) {
    const path = notificationPath(item);
    if (!path || marking.current || !owner.current || offline) return;
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
      if (current === generation.current && owner.current === userId) { haptic("tab"); router.push(nativeDestination(path) as "/dashboard"); }
    } catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : "Activity could not be opened."); }
    finally { marking.current = false; setBusy(false); }
  }
  const items = offline ? [] : rows;
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 7, gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontWeight: "900", fontSize: 24 }}>Alerts</Text>
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
            borderRadius: 13, borderWidth: section === tab.id ? 1 : 0,
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
      <View style={{ gap: 4 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{loading ? "Checking activity…" : `${items.filter(item => !item.read_at).length} unread · ${items.length} recent updates`}</Text></View>
      <Button secondary disabled={busy || failed || offline || !items.some(item => !item.read_at)} onPress={() => void markAll()}>{busy ? "Updating…" : "Mark all as read"}</Button>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{["all", "unread", "games", "clubs", "reviews"].map(value => <Pressable key={value} accessibilityRole="button" aria-pressed={filter === value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: theme.radius.control, backgroundColor: filter === value ? theme.accentSurface : theme.chip }}><Text style={{ color: theme.foreground, textTransform: "capitalize" }}>{value}</Text></Pressable>)}</View>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text> : null}
    </View>} data={items.filter(item => noticeMatches(item, filter))} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 5, paddingBottom: 120, gap: 2 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} renderItem={({ item }) => {
      const path = notificationPath(item);
      return <View style={{ borderBottomWidth: 1, borderColor: theme.glassBorder }}><Pressable accessibilityRole="button" disabled={!path || busy} accessibilityState={{ disabled: !path || busy }} onPress={() => void openNotice(item)} style={({ pressed }) => ({ minHeight: 61, gap: 4, paddingHorizontal: 8, paddingVertical: 10, opacity: pressed ? .7 : 1 })}>
        <Text style={{ color: theme.accent, fontWeight: "700" }}>{item.read_at ? "" : "● "}{item.notification_type.replaceAll("_", " ").toUpperCase()}</Text>
        <Text style={{ color: theme.foreground, fontSize: 14, fontWeight: "800" }}>{item.title}</Text>
        <Text style={{ color: theme.foreground }}>{item.body}</Text>
        <Text style={{ color: theme.muted }}>{new Date(item.created_at).toLocaleString()}</Text>
      </Pressable></View>;
    }} ListEmptyComponent={loading ? <HoopCheckLoading compact label="Checking activity…" /> : <View style={{ gap: 12, padding: 20 }}><Text style={{ color: theme.foreground }}>{offline ? "Reconnect to view alerts." : failed ? "Alerts are unavailable." : items.length ? "Nothing in this category." : "No notifications yet."}</Text>{failed ? <Button secondary onPress={() => void load()}>Retry loading alerts</Button> : <Button secondary onPress={() => router.push("/teams")}>Find teams</Button>}</View>} />}
  </View>;
}
