import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, Share, Text, TextInput, View, type ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "../src/primitives";
import { Skeleton } from "../components/Motion";
import { FeedMedia } from "../components/FeedMedia";
import { FeedPoll } from "../components/FeedPoll";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useNetwork, requireOnline } from "../src/native/network";
import { feedAction, isFeedId, moderateFeedText, publishFeedPoll, readFeedChecks, readFeedComments, readFeedPage, readFeedSaved, readSharedFeedPost, toggleFeedCheck, validatedPollOptions, type FeedComment, type FeedCursor, type FeedPost } from "../src/native/feedClient";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro bundles the official local artwork.
const brandMark = require("../assets/hoopcheck-mark.png");
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
  const viewability = useMemo(() => ({ itemVisiblePercentThreshold: 30 }), []);
  const viewChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<FeedPost>[] }) => setVisible(new Set(viewableItems.filter(item => item.isViewable).map(item => item.item.id))), []);
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
    setRows({ scope, posts: [] }); setNext(null); setChecks({}); setSaved({}); setOpenComments({}); setMessage("");
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
  const posts = canRead && rows.scope === scope ? rows.posts.filter(post => !post.expires_at || Date.parse(post.expires_at) > now) : [];
  const textStyle = { color: theme.foreground };
  const linkStyle = { color: theme.accent };
  const touch = { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 999, backgroundColor: theme.elevatedSurface, justifyContent: "center" as const };
  if (accountLoading) return <View style={{ flex: 1, padding: 24, backgroundColor: theme.background }}><Skeleton /></View>;
  if (!account || !canRead) return <View style={{ flex: 1, padding: 24, gap: 20, justifyContent: "center", backgroundColor: theme.background }}>
    <Text accessibilityRole="header" style={{ ...textStyle, fontSize: 28, fontWeight: "900" }}>HoopFeed</Text>
    <Text style={textStyle}>{offline ? "Reconnect to verify community access." : account ? "An active HoopCheck membership is required to use HoopFeed." : accountError}</Text>
    <Button secondary onPress={retry}>Verify access again</Button><Button secondary onPress={() => router.push("/account")}>Your account</Button>
  </View>;
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image alt="HoopCheck" source={brandMark} accessibilityLabel="HoopCheck" style={{ width: 36, height: 36 }} resizeMode="contain" />
      <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: "row", gap: 6 }}>{[false, true].map(value => <Pressable key={String(value)} accessibilityRole="tab" accessibilityState={{ selected: reels === value }} aria-selected={reels === value} onPress={() => setReels(value)} style={[touch, { backgroundColor: reels === value ? theme.surface : theme.background, borderColor: reels === value ? theme.accent : theme.border }]}><Text style={{ ...textStyle, fontSize: 14, fontWeight: "700" }}>{value ? "Reels" : "HoopFeed"}</Text></Pressable>)}</View>
      {message || loadError ? <Text accessibilityLiveRegion="polite" style={{ color: theme.muted }}>{loadError || message}</Text> : null}
    </View>
    <FlatList style={{ flex: 1 }} onLayout={event => setHeight(event.nativeEvent.layout.height)} data={posts} keyExtractor={post => post.id} contentContainerStyle={{ padding: reels ? 0 : 16, gap: reels ? 0 : 14 }} keyboardShouldPersistTaps="handled" initialNumToRender={4} maxToRenderPerBatch={4} windowSize={5} pagingEnabled={reels} viewabilityConfig={viewability} onViewableItemsChanged={viewChanged}
      ListHeaderComponent={!reels ? <View style={{ marginBottom: 12 }}>
        {!composerExpanded ? <Pressable accessibilityRole="button" accessibilityLabel="Create HoopFeed post" disabled={!canWrite} onPress={() => setComposerExpanded(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 18, backgroundColor: theme.surface }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#171717", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FF8A5C", fontWeight: "900", fontSize: 12 }}>HC</Text></View><Text style={{ color: theme.muted, fontSize: 14 }}>Share something…</Text>
        </Pressable> : <View style={{ gap: 12, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 18, backgroundColor: theme.surface }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ ...textStyle, fontSize: 22, fontWeight: "700" }}>Create a post</Text><Pressable accessibilityRole="button" onPress={() => setComposerExpanded(false)} style={touch}><Text style={textStyle}>Close</Text></Pressable></View>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8 }}>{[false, true].map(enabled => <Pressable key={String(enabled)} accessibilityRole="tab" accessibilityState={{ selected: pollEnabled === enabled }} disabled={pending.post} onPress={() => setPoll(current => ({ owner: uid!, enabled, options: current.owner === uid ? current.options : ["", ""] }))} style={[touch, { borderColor: pollEnabled === enabled ? theme.accent : theme.border }]}><Text style={textStyle}>{enabled ? "Poll" : "Discussion"}</Text></Pressable>)}</View>
          <TextInput accessibilityLabel="Write a HoopFeed post" multiline maxLength={2000} editable={!pending.post} placeholder={pollEnabled ? "Ask your poll question…" : "Start a post... (ask, share, discuss, update)"} placeholderTextColor={theme.muted} value={draft.owner === uid ? draft.text : ""} onChangeText={text => setDraft({ owner: uid!, text })} style={{ ...textStyle, fontSize: 15, lineHeight: 23, minHeight: 90, maxHeight: 220, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.control, backgroundColor: theme.input }} />
          {pollEnabled ? <View style={{ gap: 8 }}><Text style={{ color: theme.muted }}>Add 2–4 different answers, up to 60 characters each. Polls are text only.</Text>{pollOptions.map((option, index) => <View key={index} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><TextInput accessibilityLabel={`Poll answer ${index + 1}`} value={option} maxLength={60} editable={!pending.post} onChangeText={value => setPoll(current => current.owner === uid ? { ...current, options: current.options.map((item, i) => i === index ? value : item) } : current)} style={{ ...textStyle, flex: 1, minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.control, backgroundColor: theme.input }} />{pollOptions.length > 2 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove poll answer ${index + 1}`} disabled={pending.post} onPress={() => setPoll(current => current.owner === uid ? { ...current, options: current.options.filter((_, i) => i !== index) } : current)} style={touch}><Text style={linkStyle}>Remove</Text></Pressable> : null}</View>)}{pollOptions.length < 4 ? <Button secondary disabled={pending.post} onPress={() => setPoll(current => current.owner === uid ? { ...current, options: [...current.options, ""] } : current)}>Add poll answer</Button> : null}</View> : null}
          <Button style={{ minHeight: 44, borderRadius: 999, alignSelf: "flex-end", paddingHorizontal: 24 }} disabled={!canWrite || pending.post || draft.owner !== uid || !draft.text.trim() || !pollValid} onPress={() => void publish()}>{pending.post ? "Checking safety…" : "Post"}</Button>
        </View>}
        {!canWrite ? <Text style={{ color: theme.muted, marginTop: 8 }}>Your membership does not include posting.</Text> : null}
      </View> : null}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      ListEmptyComponent={loading ? <Skeleton /> : <View style={{ padding: 24, gap: 12 }}><Text style={textStyle}>{loadError || (reels ? "No video posts are available in this page." : "No posts are available in this page.")}</Text><Button secondary onPress={() => void load()}>Refresh</Button></View>}
      renderItem={({ item: post }) => {
        const page = comments.owner === uid ? comments.values[post.id] : undefined;
        const replyTarget = reply && reply.owner === uid && reply.postId === post.id ? reply : null;
        const commentDraft = drafts.owner === uid ? drafts.values[post.id] ?? "" : "";
        const photos = (Array.isArray(post.image_urls) && post.image_urls.length ? post.image_urls : post.image_url ? [post.image_url] : []).filter((value): value is string => typeof value === "string").slice(0, 4);
        const options = Array.isArray(post.poll_options) ? post.poll_options.filter((value): value is string => typeof value === "string").slice(0, 6).map(value => value.slice(0, 120)) : [];
        return <View style={reels ? { height, padding: 12 } : undefined}><View testID={`feed-post-${post.id}`} style={{ padding: 14, gap: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.card, ...(reels ? { flex: 1 } : {}) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.chip, alignItems: "center", justifyContent: "center" }}><Text style={{ color: theme.onChip, fontWeight: "800", fontSize: 12 }}>HC</Text></View>
            <View style={{ flex: 1, gap: 3 }}><Text style={{ ...textStyle, fontWeight: "700", fontSize: 13 }}>{post.profiles?.display_name || "HoopCheck member"}</Text><Text style={{ color: theme.muted, fontSize: 11 }}>{new Date(post.created_at).toLocaleString()}</Text></View>
          </View>
          {post.body ? <Text numberOfLines={reels ? 3 : undefined} style={{ ...textStyle, fontSize: 15, lineHeight: 23 }}>{post.body}</Text> : null}
          {post.video_url ? <FeedMedia userId={uid!} postId={post.id} reference={post.video_url} video enabled={focused && visible.has(post.id)} loop={reels} height={reels ? Math.max(240, height - 230) : 300} /> : photos.map(reference => <FeedMedia userId={uid!} key={reference} postId={post.id} reference={reference} enabled={focused && visible.has(post.id)} />)}
          {post.post_kind === "poll" && options.length ? <FeedPoll userId={uid!} postId={post.id} options={options} enabled={canWrite && focused} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 12, borderTopWidth: 1, borderColor: theme.border }}>
            <Pressable accessibilityRole="button" aria-pressed={checks[post.id]?.mine === true} disabled={!canWrite || !checks[post.id] || Boolean(pending[`check:${post.id}`])} onPress={() => void action(`check:${post.id}`, async () => {
              await token();
              let activity;
              try { activity = await toggleFeedCheck(supabase, uid!, post.id, checks[post.id]?.mine === true); }
              catch {
                if (viewer.current.uid === uid) setChecks(previous => { const result = { ...previous }; delete result[post.id]; return result; });
                throw new Error("Check status could not be confirmed. Refresh the feed before trying again.");
              }
              if (viewer.current.uid !== uid || !viewer.current.canRead) return;
              const total = activity.find(row => row.post_id === post.id);
              if (total && Number.isSafeInteger(Number(total.checks_count)) && Number(total.checks_count) >= 0) setChecks(previous => ({ ...previous, [post.id]: { count: Number(total.checks_count), mine: total.checked_by_me === true } }));
            })} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>{!checks[post.id] ? "Checks unavailable" : checks[post.id].mine ? "Checked" : "Check"}{checks[post.id] ? ` · ${checks[post.id].count}` : ""}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { if (reels) { router.push({ pathname: "/feed", params: { post: post.id, comments: "1" } }); return; } setOpenComments(previous => ({ ...previous, [post.id]: !previous[post.id] })); if (!page || page.error) void loadComments(post.id); }} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>Comments</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void action(`share:${post.id}`, async () => { await Share.share({ title: "HoopFeed", message: `https://hoopcheck.online/feed#post-${post.id}` }); })} style={touch}><Text style={{ ...linkStyle, fontSize: 12 }}>Share</Text></Pressable>
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
