import { useHaptics } from "../src/native/haptics";
import { Skeleton } from "../components/Motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, GlassCard } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { requireOnline, useNetwork } from "../src/native/network";
import { nativeDestination } from "../src/native/deepLinks";
import { markNotificationsRead, noticeMatches, notificationPath, readNotifications, type Notice } from "../src/native/notifications";

export default function Notifications() {
  const theme = useEntryTheme();
  const router = useRouter();
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
    const { data } = supabase.auth.onAuthStateChange(() => {
      generation.current++; owner.current = null; setRows([]);
      clearTimeout(timer);
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
    <FlatList ListHeaderComponent={<View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.sm }}><Text style={{ color: theme.foreground, ...theme.type.section }}>Your basketball updates</Text><Text style={{ color: theme.muted }}>{loading ? "Loading activity…" : `${items.filter(item => !item.read_at).length} unread in your latest ${items.length} updates`}</Text></View>
      <Button secondary disabled={busy || failed || offline || !items.some(item => !item.read_at)} onPress={() => void markAll()}>{busy ? "Updating…" : "Mark all as read"}</Button>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{["all", "unread", "games", "clubs", "reviews"].map(value => <Pressable key={value} accessibilityRole="button" aria-pressed={filter === value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: theme.radius.control, backgroundColor: filter === value ? theme.accentSurface : theme.chip }}><Text style={{ color: theme.foreground, textTransform: "capitalize" }}>{value}</Text></Pressable>)}</View>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text> : null}
    </View>} data={items.filter(item => noticeMatches(item, filter))} keyExtractor={item => item.id} contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} renderItem={({ item }) => {
      const path = notificationPath(item);
      return <GlassCard style={{ padding: theme.spacing.lg, gap: theme.spacing.sm, borderLeftWidth: item.read_at ? 1 : 3, borderLeftColor: item.read_at ? theme.border : theme.accent }}><Pressable accessibilityRole="button" disabled={!path || busy} accessibilityState={{ disabled: !path || busy }} onPress={() => void openNotice(item)} style={({ pressed }) => ({ minHeight: 60, gap: theme.spacing.sm, opacity: pressed ? .7 : 1 })}>
        <Text style={{ color: theme.accent, fontWeight: "700" }}>{item.read_at ? "" : "● "}{item.notification_type.replaceAll("_", " ").toUpperCase()}</Text>
        <Text style={{ color: theme.foreground, fontSize: 18, fontWeight: "800" }}>{item.title}</Text>
        <Text style={{ color: theme.foreground }}>{item.body}</Text>
        <Text style={{ color: theme.muted }}>{new Date(item.created_at).toLocaleString()}</Text>
      </Pressable></GlassCard>;
    }} ListEmptyComponent={loading ? <Skeleton /> : <View style={{ gap: 12, padding: 20 }}><Text style={{ color: theme.foreground }}>{offline ? "Reconnect to view alerts." : failed ? "Alerts are unavailable." : items.length ? "Nothing in this category." : "No notifications yet."}</Text>{failed ? <Button secondary onPress={() => void load()}>Retry loading alerts</Button> : <Button secondary onPress={() => router.push("/teams")}>Find teams</Button>}</View>} />
  </View>;
}
