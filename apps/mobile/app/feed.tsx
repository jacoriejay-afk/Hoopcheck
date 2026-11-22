import { CourtsideBanner } from "../components/CourtsideBanner";
import { GlassSurface } from "../components/GlassSurface";
import { BrandLogo } from "../components/BrandLogo";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlatList, Linking, Pressable, RefreshControl, Share, Text, TextInput, View, type ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "../src/primitives";
import { Skeleton } from "../components/Motion";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { FeedMedia } from "../components/FeedMedia";
import { MediaPostComposer } from "../components/MediaPostComposer";
import { FeedPoll } from "../components/FeedPoll";
import { FeedCheckAction } from "../components/FeedCheckAction";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useNetwork, requireOnline } from "../src/native/network";
import { feedAction, isFeedId, moderateFeedText, publishFeedPoll, readFeedChecks, readFeedComments, readFeedPage, readFeedSaved, readSharedFeedPost, toggleFeedCheck, validatedPollOptions, type FeedComment, type FeedCursor, type FeedPost } from "../src/native/feedClient";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type CommentPage = { rows: FeedComment[]; more: boolean; offset: number; loading: boolean; error: string };
export function FeedScreen({ initialReels = false }: { initialReels?: boolean }) {
  const theme = useEntryTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ post?: string; comments?: string }>();
  const linkedId = typeof params.post === "string" && isFeedId(params.post) ? params.post : undefined;
  const { account, loading: accountLoading, error: accountError, retry } = useNativeAccount();
  const { offline } = useNetwork();
  const uid = account?.user.id;
  const canRead = Boolean(uid && account?.features.canReadHoopFeed && !offline);
  const canWrite = Boolean(uid && account?.features.canWriteHoopFeed && !offline);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [mediaMode, setMediaMode] = useState(false);
  const [reels, setReels] = useState(initialReels);
  const scope = `${uid ?? ""}:${reels}`;
  const viewer = useRef({ uid, canRead, scope });
  useLayoutEffect(() => { viewer.current = { uid, canRead, scope }; }, [uid, canRead, scope]);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); retry(); return () => setFocused(false); }, [retry]));
  const [rows, setRows] = useState<{ scope: string; posts: FeedPost[] }>({ scope: "", posts: [] });
  const [next, setNext] = useState<FeedCursor | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [checks, setChecks] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [checkPulses, setCheckPulses] = useState<{ scope: string; values: Record<string, number> }>({ scope: "", values: {} });
  const [saved, setSaved] = useState<Record<string, boolean | undefined>>({});
  const requests = useRef(new Set<string>());
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState({ owner: "", text: "" });
  const [poll, setPoll] = useState({ owner: "", enabled: false, options: ["", ""] });
  const pollEnabled = poll.owner === uid && poll.enabled;
  const pollOptions = poll.owner === uid ? poll.options : ["", ""];
  let pollValid = !pollEnabled;
  if (pollEnabled) { try { validatedPollOptions(pollOptions); pollValid = true; } catch { /* Keep the draft editable until valid. */ } }
  const [drafts, setDrafts] = useState<{ owner: string; values: Record<string, string> }>({ owner: "", values: {} });
  const [comments, setComments] = useState<{ owner: string; values: Record<string, CommentPage> }>({ owner: "", values: {} });
  const [reply, setReply] = useState<{ owner: string; postId: string; id: string; name: string } | null>(null);
  const [autoOpened, setAutoOpened] = useState<string | undefined>(undefined);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState(new Set<string>());
  const [hiddenReels, setHiddenReels] = useState<{ owner: string; ids: string[] }>({ owner: "", ids: [] });
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void AsyncStorage.getItem(`hoopcheck:reels:hidden:${uid}`).then(raw => {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (alive) setHiddenReels({ owner: uid, ids: Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && isFeedId(id)).slice(-500) : [] });
    }).catch(() => { if (alive) setHiddenReels({ owner: uid, ids: [] }); });
    return () => { alive = false; };
  }, [uid]);
  const [mutedCreators, setMutedCreators] = useState<{ owner: string; ids: string[] }>({ owner: "", ids: [] });
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void AsyncStorage.getItem(`hoopcheck:reels:muted-creators:${uid}`).then(raw => {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (alive) setMutedCreators({ owner: uid, ids: Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && isFeedId(id)).slice(-500) : [] });
    }).catch(() => { if (alive) setMutedCreators({ owner: uid, ids: [] }); });
    return () => { alive = false; };
  }, [uid]);
  // Use the owner-scoped shared account block list; fail closed if unavailable.
  const [blocksVersion, setBlocksVersion] = useState(0);
  const [blockedCreators, setBlockedCreators] = useState<{ owner: string; ids: string[]; ready: boolean; failed: boolean }>({ owner: "", ids: [], ready: false, failed: false });
  useEffect(() => {
    if (!uid || !canRead) { setBlockedCreators({ owner: "", ids: [], ready: false, failed: false }); return; }
    let alive = true;
    setBlockedCreators({ owner: uid, ids: [], ready: false, failed: false });
    void Promise.resolve(supabase.from("user_blocks").select("blocked_id").eq("blocker_id", uid).limit(500))
      .then(({ data, error }) => {
        if (alive) setBlockedCreators({ owner: uid, ids: error ? [] : (data || []).map(row => row.blocked_id), ready: true, failed: Boolean(error) });
      }).catch(() => { if (alive) setBlockedCreators({ owner: uid, ids: [], ready: true, failed: true }); });
    return () => { alive = false; };
  }, [uid, canRead, blocksVersion]);
  const viewability = useMemo(() => ({ itemVisiblePercentThreshold: reels ? 75 : 30 }), [reels]);
  const viewChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<FeedPost>[] }) => {
    const candidates = viewableItems.filter(item => item.isViewable).map(item => item.item.id);
    setVisible(previous => {
      const nextIds = reels ? candidates.slice(0, 1) : candidates;
      if (previous.size === nextIds.length && nextIds.every(id => previous.has(id))) return previous;
      return new Set(nextIds);
    });
  }, [reels]);

  const [height, setHeight] = useState(600);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const load = useCallback(async (cursor?: FeedCursor) => {
    if (!uid || !canRead) return;
    const current = ++generation.current;
    setLoading(true); setLoadError("");
    try {
      const [page, shared] = await Promise.all([readFeedPage(supabase, uid, cursor, reels), !cursor && linkedId ? readSharedFeedPost(supabase, uid, linkedId) : null]);
      const posts = shared && (!reels || shared.video_url) && !page.posts.some(post => post.id === shared.id) ? [shared, ...page.posts] : page.posts;
      const [checkResult, savedResult] = await Promise.allSettled([readFeedChecks(supabase, posts.map(post => post.id)), readFeedSaved(supabase, uid, posts.map(post => post.id))]);
      const activity = checkResult.status === "fulfilled" ? checkResult.value : [];
      const activityFailed = checkResult.status === "rejected";
      if (current !== generation.current || viewer.current.scope !== scope || !viewer.current.canRead) return;
      setRows(previous => ({ scope, posts: cursor && previous.scope === scope ? [...new Map([...previous.posts, ...posts].map(post => [post.id, post])).values()] : posts }));
      setNext(page.next);
      setSaved(previous => {
        const result: Record<string, boolean | undefined> = cursor ? { ...previous } : {};
        for (const post of posts) result[post.id] = savedResult.status === "fulfilled" ? savedResult.value.includes(post.id) : undefined;
        return result;
      });
      setChecks(previous => {
        const result = cursor ? { ...previous } : {};
        const ids = new Set(posts.map(post => post.id));
        for (const item of activity) { const count = Number(item.checks_count); if (ids.has(item.post_id) && Number.isSafeInteger(count) && count >= 0) result[item.post_id] = { count, mine: item.checked_by_me === true }; }
        return result;
      });
      if (activityFailed) setMessage("Posts loaded. Check totals could not be verified.");
      else if (!cursor && linkedId && !shared) setMessage("The shared post is unavailable for this account.");
    } catch { if (current === generation.current) setLoadError("HoopFeed could not load. Try again."); }
    finally { if (current === generation.current) setLoading(false); }
  }, [uid, canRead, reels, linkedId, scope]);
  useEffect(() => {
    setRows({ scope, posts: [] }); setNext(null); setChecks({}); setCheckPulses({ scope, values: {} }); setSaved({}); setOpenComments({}); setMessage("");
    if (canRead) void load(); else setLoading(false);
    // This is an async request generation counter, not a mounted node reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generation.current++; };
  }, [canRead, load, scope]);
  async function token() {
    await requireOnline();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || data.session.user.id !== uid || viewer.current.uid !== uid || !viewer.current.canRead) throw new Error("Sign in again before continuing.");
    return data.session.access_token;
  }
  async function action(key: string, task: () => Promise<void>) {
    const requestKey = `${uid}:${key}`;
    if (requests.current.has(requestKey)) return;
    requests.current.add(requestKey); setPending(value => ({ ...value, [key]: true })); setMessage("");
    try { await task(); }
    catch (failure) { if (viewer.current.uid === uid) setMessage(failure instanceof Error ? failure.message : "The action could not be confirmed. Try again."); }
    finally { requests.current.delete(requestKey); if (viewer.current.uid === uid) setPending(value => ({ ...value, [key]: false })); }
  }
  async function publish() {
    if (!canWrite || draft.owner !== uid || !draft.text.trim() || !pollValid) return;
    const text = draft.text;
    await action("post", async () => {
      if (pollEnabled) await publishFeedPoll(origin, await token(), text, pollOptions);
      else await moderateFeedText(origin, await token(), "post", text);
      setDraft(current => current.owner === uid && current.text === text ? { owner: uid!, text: "" } : current);
      setPoll(current => current.owner === uid ? { owner: uid!, enabled: false, options: ["", ""] } : current);
      if (viewer.current.scope === scope && viewer.current.canRead) { setMessage("Published after safety checks."); await load(); }
    });
  }
  const loadComments = useCallback(async (postId: string, offset = 0) => {
    if (!uid || !canRead) return;
    const owner = uid;
    setComments(previous => ({ owner, values: { ...(previous.owner === owner ? previous.values : {}), [postId]: { rows: previous.owner === owner && offset ? previous.values[postId]?.rows ?? [] : [], more: false, offset, loading: true, error: "" } } }));
    try {
      const page = await readFeedComments(supabase, postId, offset);
      if (viewer.current.uid !== owner || !viewer.current.canRead) return;
      setComments(previous => ({ owner, values: { ...(previous.owner === owner ? previous.values : {}), [postId]: { rows: offset && previous.owner === owner ? [...new Map([...(previous.values[postId]?.rows ?? []), ...page.comments].map(row => [row.id, row])).values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) : page.comments, more: page.more, offset, loading: false, error: "" } } }));
    } catch { if (viewer.current.uid === owner) setComments(previous => ({ owner, values: { ...(previous.owner === owner ? previous.values : {}), [postId]: { rows: previous.owner === owner ? previous.values[postId]?.rows ?? [] : [], more: false, offset, loading: false, error: "Comments could not load. Tap Comments to retry." } } })); }
  }, [uid, canRead]);
  useEffect(() => {
    if (params.comments !== "1" || !linkedId || reels || autoOpened === linkedId || rows.scope !== scope || !rows.posts.some(post => post.id === linkedId)) return;
    setAutoOpened(linkedId); setOpenComments(previous => ({ ...previous, [linkedId]: true })); void loadComments(linkedId);
  }, [params.comments, linkedId, reels, autoOpened, rows, scope, loadComments]);
  const posts = canRead && rows.scope === scope ? rows.posts.filter(post =>
    (!post.expires_at || Date.parse(post.expires_at) > now) &&
    (!reels || (
      (hiddenReels.owner !== uid || !hiddenReels.ids.includes(post.id)) &&
      (mutedCreators.owner !== uid || !mutedCreators.ids.includes(post.author_id)) &&
      blockedCreators.owner === uid && blockedCreators.ready && !blockedCreators.failed &&
      !blockedCreators.ids.includes(post.author_id)
    )),
  ) : [];
  async function hideCreator(authorId: string) {
    if (!uid || !reels || authorId === uid) return;
    const existing = mutedCreators.owner === uid ? mutedCreators.ids : [];
    const ids = [...new Set([...existing, authorId])].slice(-500);
    setMutedCreators({ owner: uid, ids });
    try { await AsyncStorage.setItem(`hoopcheck:reels:muted-creators:${uid}`, JSON.stringify(ids)); }
    catch { setMessage("This creator is hidden for this session. It could not be saved on this device."); }
  }
  async function blockAccount(authorId: string) {
    if (!uid || !canRead || !reels || authorId === uid) return;
    await action(`block:${authorId}`, async () => {
      await token();
      // user_blocks intentionally grants INSERT + owner SELECT, not UPDATE.
      // An upsert requires UPDATE and would fail under the production RLS boundary.
      const { error } = await supabase.from("user_blocks").insert({ blocker_id: uid, blocked_id: authorId });
      if (error) {
        if (error.code !== "23505") throw new Error("Could not block this account. Try again.");
        // Repeated taps are idempotent only if an owner-scoped read proves the row exists.
        const { data: existing, error: verifyError } = await supabase.from("user_blocks")
          .select("blocked_id").eq("blocker_id", uid).eq("blocked_id", authorId).maybeSingle();
        if (verifyError || existing?.blocked_id !== authorId) throw new Error("Could not confirm this account is blocked. Try again.");
      }
      if (viewer.current.uid !== uid || !viewer.current.canRead) return;
      setBlockedCreators(current => ({ owner: uid, ids: [...new Set([...(current.owner === uid ? current.ids : []), authorId])], ready: true, failed: false }));
      setMessage("Creator added to your HoopCheck blocked accounts.");
    });
  }
  async function hideReel(postId: string) {
    if (!uid || !reels) return;
    const existing = hiddenReels.owner === uid ? hiddenReels.ids : [];
    const nextIds = [...new Set([...existing, postId])].slice(-500);
    setHiddenReels({ owner: uid, ids: nextIds });
    try { await AsyncStorage.setItem(`hoopcheck:reels:hidden:${uid}`, JSON.stringify(nextIds)); }
    catch { setMessage("Video hidden for this session. It could not be saved to your device."); }
  }
  const textStyle = { color: theme.foreground };
  const linkStyle = { color: theme.accent };
  const touch = { minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 13, backgroundColor: theme.chip, justifyContent: "center" as const };
  if (accountLoading) return <View style={{ flex: 1, padding: 24, backgroundColor: theme.background }}><Skeleton /></View>;
  if (!account || !canRead) return <View style={{ flex: 1, padding: 24, gap: 20, justifyContent: "center", backgroundColor: theme.background }}>
    <Text accessibilityRole="header" style={{ ...textStyle, fontSize: 28, fontWeight: "900" }}>HoopFeed</Text>
    <Text style={textStyle}>{offline ? "Reconnect to verify community access." : account ? "An active HoopCheck membership is required to use HoopFeed." : accountError}</Text>
    <Button secondary onPress={retry}>Verify access again</Button><Button secondary onPress={() => router.push("/account")}>Your account</Button>
  </View>;
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <GlassSurface style={{
      marginHorizontal: 12, marginTop: 5, marginBottom: 5, padding: 5,
      borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 7,
    }}>
      <BrandLogo compact />
      <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: "row", gap: 6 }}>
        {[false, true].map(value => <Pressable key={String(value)}
          accessibilityRole="tab" accessibilityLabel={value ? "Reels" : "HoopFeed"}
          accessibilityState={{ selected: reels === value }}
          aria-selected={reels === value} onPress={() => setReels(value)}
          style={({ pressed }) => ({
            flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center",
            borderRadius: 12, borderWidth: 1, opacity: pressed ? .7 : 1,
            backgroundColor: reels === value ? theme.accentSurface : "transparent",
            borderColor: reels === value ? theme.accent : "transparent",
          })}>
          <Text style={{ color: reels === value ? theme.accent : theme.foreground,
            fontSize: 14, fontFamily: theme.type.ui.fontFamily, fontWeight: "700" }}>
            {value ? "REELS" : "HOOPFEED"}
          </Text>
        </Pressable>)}
      </View>
    </GlassSurface>
    {message || loadError ? <Text accessibilityLiveRegion="polite"
      style={{ color: theme.muted, paddingHorizontal: 18 }}>{loadError || message}</Text> : null}
    <FlatList key={reels ? "reels" : "posts"} keyboardDismissMode="on-drag" style={{ flex: 1 }} onLayout={event => setHeight(event.nativeEvent.layout.height)} data={posts} keyExtractor={post => post.id} contentContainerStyle={{ padding: reels ? 0 : 12, gap: reels ? 0 : theme.spacing.md }} keyboardShouldPersistTaps="handled" initialNumToRender={reels ? 2 : 4} maxToRenderPerBatch={reels ? 2 : 4} windowSize={reels ? 3 : 5} pagingEnabled={reels} viewabilityConfig={viewability} onViewableItemsChanged={viewChanged}
      ListHeaderComponent={!reels ? <View style={{ marginBottom: theme.spacing.sm, gap: theme.spacing.sm }}><CourtsideBanner eyebrow="HOOPFEED" title="Your basketball community">Stories, perspectives and conversations from around the game.</CourtsideBanner>
        <Pressable accessibilityRole="button" accessibilityLabel="Meet HoopBot welcome guide"
          onPress={()=>router.push("/feed-welcome")}
          style={{minHeight:44,paddingHorizontal:12,paddingVertical:7,borderWidth:1,borderRadius:14,
            borderColor:theme.border,backgroundColor:theme.accentSurface,flexDirection:"row",
            justifyContent:"space-between",alignItems:"center",gap:8}}>
          <Text style={{color:theme.foreground,fontWeight:"700",fontSize:13}}>Meet HoopBot · Welcome guide</Text>
          <Text style={{color:theme.accent,fontWeight:"700",fontSize:12}}>Open →</Text>
        </Pressable>
        {!composerExpanded ? <Pressable accessibilityRole="button" accessibilityLabel="Create HoopFeed post" disabled={!canWrite} onPress={() => setComposerExpanded(true)} style={{ flexDirection: "row", alignItems: "center", gap: 9, padding: 9, borderWidth: 1, borderColor: theme.border, borderRadius: 15, backgroundColor: theme.elevatedSurface }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accentSurface, alignItems: "center", justifyContent: "center" }}><Text style={{ color: theme.accent, fontWeight: "900", fontSize: 12 }}>HC</Text></View><Text style={{ color: theme.muted, fontSize: 14 }}>Share something…</Text>
        </Pressable> : <View style={{ gap: 12, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 18, backgroundColor: theme.surface }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ ...textStyle, fontFamily: theme.type.ui.fontFamily, fontSize: 18, fontWeight: "700" }}>Create a post</Text><Pressable accessibilityRole="button" onPress={() => setComposerExpanded(false)} style={touch}><Text style={textStyle}>Close</Text></Pressable></View>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8 }}>{[false, true].map(enabled => <Pressable key={String(enabled)} accessibilityRole="tab" accessibilityState={{ selected: !mediaMode && pollEnabled === enabled }} disabled={pending.post} onPress={() => { setMediaMode(false); setPoll(current => ({ owner: uid!, enabled, options: current.owner === uid ? current.options : ["", ""] })); }} style={[touch, { borderColor: !mediaMode && pollEnabled === enabled ? theme.accent : theme.border }]}><Text style={textStyle}>{enabled ? "Poll" : "Discussion"}</Text></Pressable>)}</View>
          <Button secondary disabled={pending.post} onPress={() => { setMediaMode(true); setPoll(current => ({ ...current, owner: uid!, enabled: false })); }}>Photo or video</Button>
          <TextInput accessibilityLabel="Write a HoopFeed post" multiline maxLength={2000} editable={!pending.post} placeholder={pollEnabled ? "Ask your poll question…" : "Start a post... (ask, share, discuss, update)"} placeholderTextColor={theme.muted} value={draft.owner === uid ? draft.text : ""} onChangeText={text => setDraft({ owner: uid!, text })} style={{ ...textStyle, fontSize: 15, lineHeight: 23, minHeight: 90, maxHeight: 220, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.control, backgroundColor: theme.input }} />
          {pollEnabled && !mediaMode ? <View style={{ gap: 8 }}><Text style={{ color: theme.muted }}>Add 2–4 different answers, up to 60 characters each. Polls are text only.</Text>{pollOptions.map((option, index) => <View key={index} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><TextInput accessibilityLabel={`Poll answer ${index + 1}`} value={option} maxLength={60} editable={!pending.post} onChangeText={value => setPoll(current => current.owner === uid ? { ...current, options: current.options.map((item, i) => i === index ? value : item) } : current)} style={{ ...textStyle, flex: 1, minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.control, backgroundColor: theme.input }} />{pollOptions.length > 2 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove poll answer ${index + 1}`} disabled={pending.post} onPress={() => setPoll(current => current.owner === uid ? { ...current, options: current.options.filter((_, i) => i !== index) } : current)} style={touch}><Text style={linkStyle}>Remove</Text></Pressable> : null}</View>)}{pollOptions.length < 4 ? <Button secondary disabled={pending.post} onPress={() => setPoll(current => current.owner === uid ? { ...current, options: [...current.options, ""] } : current)}>Add poll answer</Button> : null}</View> : null}
          {mediaMode && uid ? <MediaPostComposer key={uid} userId={uid} enabled={canWrite} caption={draft.owner === uid ? draft.text : ""} token={token} onRefresh={() => load()} onPublished={async () => { setDraft(current => current.owner === uid && current.text === draft.text ? { owner: uid, text: "" } : current); await load(); }} /> : <Button style={{ minHeight: 44, borderRadius: 999, alignSelf: "flex-end", paddingHorizontal: 24 }} disabled={!canWrite || pending.post || draft.owner !== uid || !draft.text.trim() || !pollValid} onPress={() => void publish()}>{pending.post ? "Checking safety…" : "Post"}</Button>}
        </View>}
        {!canWrite ? <Text style={{ color: theme.muted, marginTop: 8 }}>Your membership does not include posting.</Text> : null}
      </View> : null}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setBlocksVersion(version => version + 1); void load(); }} />}
      ListEmptyComponent={loading || (reels && blockedCreators.owner === uid && !blockedCreators.ready) ? <Skeleton /> : <View style={{ padding: 24, gap: 12 }}><Text style={textStyle}>{loadError || (reels && blockedCreators.failed ? "Blocked accounts could not be verified. Retry before viewing Reels." : reels ? "No video posts are available in this page." : "No posts are available in this page.")}</Text><Button secondary onPress={() => { setBlocksVersion(version => version + 1); void load(); }}>Refresh</Button></View>}
      renderItem={({ item: post }) => {
        const page = comments.owner === uid ? comments.values[post.id] : undefined;
        const replyTarget = reply && reply.owner === uid && reply.postId === post.id ? reply : null;
        const commentDraft = drafts.owner === uid ? drafts.values[post.id] ?? "" : "";
        const photos = (Array.isArray(post.image_urls) && post.image_urls.length ? post.image_urls : post.image_url ? [post.image_url] : []).filter((value): value is string => typeof value === "string").slice(0, 4);
        const options = Array.isArray(post.poll_options) ? post.poll_options.filter((value): value is string => typeof value === "string").slice(0, 6).map(value => value.slice(0, 120)) : [];
        return <View style={reels ? { height, padding: 12 } : undefined}><View testID={`feed-post-${post.id}`} style={{ padding: theme.courtside.card.featuredPadding, gap: theme.spacing.sm, backgroundColor: theme.elevatedSurface, borderWidth: 1, borderColor: theme.glassBorder, borderRadius: theme.courtside.card.radius, borderCurve: "continuous", ...(reels ? { flex: 1 } : {}) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ProfileAvatar url={post.profiles?.avatar_moderation_status === "approved" ? post.profiles.avatar_url : null} name={post.profiles?.display_name || "HoopCheck member"} size={36} />
            <View style={{ flex: 1, gap: 3 }}><Text style={{ ...textStyle, fontFamily: theme.type.ui.fontFamily, fontWeight: "700", fontSize: 14 }}>{post.profiles?.display_name || "HoopCheck member"}</Text><Text style={{ color: theme.muted, ...theme.type.caption }}>{new Date(post.created_at).toLocaleString()}</Text></View>
          </View>
          {post.body ? <Text numberOfLines={reels ? 3 : undefined} style={{ ...textStyle, fontSize: 14, lineHeight: 20 }}>{post.body}</Text> : null}
          {post.video_url ? <FeedMedia userId={uid!} postId={post.id} reference={post.video_url} video enabled={focused && visible.has(post.id)} loop={reels} height={reels ? Math.max(120, height - 280) : 280} /> : photos.map(reference => <FeedMedia userId={uid!} key={reference} postId={post.id} reference={reference} enabled={focused && visible.has(post.id)} />)}
          {post.post_kind === "poll" && options.length ? <FeedPoll userId={uid!} postId={post.id} options={options} enabled={canWrite && focused} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 12, borderTopWidth: 1, borderColor: theme.border }}>
            <FeedCheckAction checked={checks[post.id]?.mine} count={checks[post.id]?.count}
              pulseKey={checkPulses.scope === scope ? checkPulses.values[post.id] ?? 0 : 0}
              disabled={!canWrite || !checks[post.id]} busy={Boolean(pending[`check:${post.id}`])}
              onPress={() => void action(`check:${post.id}`, async () => {
              await token();
              const wasChecked = checks[post.id]?.mine;
              let activity;
              try { activity = await toggleFeedCheck(supabase, uid!, post.id, wasChecked === true); }
              catch {
                if (viewer.current.uid === uid) setChecks(previous => { const result = { ...previous }; delete result[post.id]; return result; });
                throw new Error("Check status could not be confirmed. Refresh the feed before trying again.");
              }
              if (viewer.current.uid !== uid || viewer.current.scope !== scope || !viewer.current.canRead) return;
              const total = activity.find(row => row.post_id === post.id);
              if (total && Number.isSafeInteger(Number(total.checks_count)) && Number(total.checks_count) >= 0) {
                setChecks(previous => ({ ...previous, [post.id]: { count: Number(total.checks_count), mine: total.checked_by_me === true } }));
                if (wasChecked === false && total.checked_by_me === true) {
                  setCheckPulses(previous => ({
                    scope,
                    values: {
                      ...(previous.scope === scope ? previous.values : {}),
                      [post.id]: ((previous.scope === scope ? previous.values[post.id] : 0) ?? 0) + 1,
                    },
                  }));
                }
              }
            })} />
            <Pressable accessibilityRole="button" onPress={() => { if (reels) { router.push({ pathname: "/feed", params: { post: post.id, comments: "1" } }); return; } setOpenComments(previous => ({ ...previous, [post.id]: !previous[post.id] })); if (!page || page.error) void loadComments(post.id); }} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>Comments</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void action(`share:${post.id}`, async () => { await Share.share({ title: "HoopFeed", message: `https://hoopcheck.online/feed#post-${post.id}` }); })} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>Share</Text></Pressable>
            {reels && <Pressable accessibilityRole="button" accessibilityLabel="Report this Reel" onPress={() => void action(`report:${post.id}`, async () => { await Linking.openURL(`https://hoopcheck.online/support?reportReel=${post.id}`); })} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>Report</Text></Pressable>}
            {reels && <Pressable accessibilityRole="button" accessibilityLabel="Hide this Reel from your device" onPress={() => void hideReel(post.id)} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>Hide</Text></Pressable>}
            {reels && post.author_id !== uid && <Pressable accessibilityRole="button" accessibilityLabel="Hide this creator's Reels on this device" onPress={() => void hideCreator(post.author_id)} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>Hide creator</Text></Pressable>}
            {reels && post.author_id !== uid && <Pressable accessibilityRole="button" accessibilityLabel="Block this HoopCheck account" disabled={Boolean(pending[`block:${post.author_id}`])} onPress={() => void blockAccount(post.author_id)} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>Block account</Text></Pressable>}
            <Pressable accessibilityRole="button" disabled={!canWrite || saved[post.id] === undefined || Boolean(pending[`save:${post.id}`])} onPress={() => void action(`save:${post.id}`, async () => { const value = !saved[post.id]; await feedAction(origin, await token(), "bookmark", post.id, value); if (viewer.current.uid === uid) setSaved(previous => ({ ...previous, [post.id]: value })); })} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>{saved[post.id] === undefined ? "Saved status unavailable" : saved[post.id] ? "Saved" : "Save"}</Text></Pressable>
          </View>
          {openComments[post.id] && !reels ? <View style={{ gap: 12 }}>
            {page?.loading ? <Text style={textStyle}>Loading comments…</Text> : page?.error ? <Text accessibilityRole="alert" style={textStyle}>{page.error}</Text> : !page?.rows.length ? <Text style={{ color: theme.muted }}>No comments yet.</Text> : page.rows.map(comment => <View key={comment.id} style={{ paddingLeft: comment.parent_id ? 12 : 0, borderLeftWidth: comment.parent_id ? 2 : 0, borderColor: theme.border }}><Text style={{ ...textStyle, fontWeight: "700" }}>{comment.profiles?.display_name || "HoopCheck member"}</Text><Text style={textStyle}>{comment.body}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${comment.profiles?.display_name || "HoopCheck member"}`} onPress={() => setReply({ owner: uid!, postId: post.id, id: comment.id, name: comment.profiles?.display_name || "HoopCheck member" })} style={touch}><Text style={linkStyle}>Reply</Text></Pressable></View>)}
            {page?.more ? <Button secondary disabled={page.loading} onPress={() => void loadComments(post.id, page.offset + 50)}>Load more comments</Button> : null}
            {replyTarget ? <Pressable accessibilityRole="button" onPress={() => setReply(null)} style={touch}><Text style={linkStyle}>Replying to {replyTarget.name} · Cancel reply</Text></Pressable> : null}
            <TextInput accessibilityLabel="Write a comment" placeholder="Add a comment" placeholderTextColor={theme.muted} value={commentDraft} maxLength={1000} onChangeText={value => setDrafts(previous => ({ owner: uid!, values: { ...(previous.owner === uid ? previous.values : {}), [post.id]: value } }))} style={{ ...textStyle, minHeight: 48, padding: 12, backgroundColor: theme.input, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.control }} />
            <Button secondary disabled={!canWrite || !commentDraft.trim() || Boolean(pending[`comment:${post.id}`])} onPress={() => void action(`comment:${post.id}`, async () => { const published = await moderateFeedText(origin, await token(), "comment", commentDraft, post.id, undefined, replyTarget?.id); setDrafts(previous => previous.owner === uid ? { owner: uid!, values: { ...previous.values, [post.id]: previous.values[post.id] === commentDraft ? "" : previous.values[post.id] } } : previous); if (viewer.current.uid === uid) {
              await loadComments(post.id);
              if (published && published.author_id === uid && viewer.current.uid === uid && viewer.current.canRead) setComments(previous => {
                const current = previous.owner === uid ? previous.values[post.id] : undefined;
                const rows = [...new Map([...(current?.rows ?? []), { ...published, profiles: { display_name: account.user.displayName } }].map(row => [row.id, row])).values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
                return { owner: uid!, values: { ...(previous.owner === uid ? previous.values : {}), [post.id]: { rows, more: current?.more ?? false, offset: current?.offset ?? 0, loading: false, error: "" } } };
              });
              setReply(current => current && current.owner === uid && current.id === replyTarget?.id ? null : current);
            } })}>{pending[`comment:${post.id}`] ? "Checking safety…" : "Comment"}</Button>
          </View> : null}
        </View></View>;
      }}
      ListFooterComponent={next ? <View style={{ padding: 16 }}><Button secondary disabled={loading} onPress={() => void load(next)}>{loading ? "Loading…" : "Load more"}</Button></View> : null}
    />
  </SafeAreaView>;
}
export default function FeedRoute() { return <FeedScreen />; }
