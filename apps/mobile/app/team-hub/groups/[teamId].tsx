import { EntityArtwork } from "../../../components/EntityArtwork";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, Text, TextInput, View, type ViewToken } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useNativeDraft } from "../../../src/native/drafts";
import { Button, GlassCard } from "../../../src/primitives";
import { GroupImage } from "../../../components/GroupImage";
import { GroupComments } from "../../../components/GroupComments";
import { supabase } from "../../../src/lib/supabase";
import { useEntryTheme } from "../../../src/theme";
import { useNativeAccount } from "../../../src/native/useNativeAccount";
import { useActiveScreen } from "../../../src/native/useActiveScreen";
import { requireOnline, useNetwork } from "../../../src/native/network";
import { clubGroupAction, readClubGroupAccess, readClubGroupPosts, type GroupAction, type GroupPost } from "../../../src/native/clubGroups";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type Access = Awaited<ReturnType<typeof readClubGroupAccess>>;
type Snapshot = { scope: string; access: Access; posts: GroupPost[]; page: number; more: boolean };
export default function ClubGroup() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { teamId: parameter } = useLocalSearchParams<{ teamId?: string }>();
  const teamId = typeof parameter === "string" ? parameter : "";
  const { account, loading: accountLoading, error: accountError, retry } = useNativeAccount();
  const { offline } = useNetwork();
  const active = useActiveScreen();
  useFocusEffect(useCallback(() => { retry(); }, [retry]));
  const uid = account?.user.id;
  const canBrowse = Boolean(uid && active && !offline);
  const canJoin = account?.features.canUseFanGroups === true;
  const scope = `${uid ?? ""}:${teamId}`;
  const viewer = useRef({ scope, active: canBrowse });
  useLayoutEffect(() => { viewer.current = { scope, active: canBrowse }; }, [scope, canBrowse]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [text, setDraft] = useNativeDraft(`group:post:${teamId}`, uid);
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const busy = busyScope === scope;
  const pending = useRef(new Set<string>());
  const generation = useRef(0);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState<{ scope: string; postId: string; text: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState<string | null>(null);
  const [visible, setVisible] = useState(new Set<string>());
  const viewability = useMemo(() => ({ viewAreaCoveragePercentThreshold: 20 }), []);
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<GroupPost>[] }) => setVisible(new Set(viewableItems.filter(item => item.isViewable).map(item => item.item.id))), []);
  const canReadPosts = useCallback((access: Access) => (canJoin && access.member) || access.moderator, [canJoin]);
  const load = useCallback(async (page = 0) => {
    if (!uid || !canBrowse) return;
    const current = ++generation.current;
    setLoading(true); setError("");
    try {
      const access = await readClubGroupAccess(supabase, teamId, uid);
      const result = canReadPosts(access) ? await readClubGroupPosts(supabase, teamId, page) : { posts: [], more: false };
      if (current !== generation.current || viewer.current.scope !== scope || !viewer.current.active) return;
      setSnapshot(previous => ({ scope, access, posts: page && previous?.scope === scope ? [...new Map([...previous.posts, ...result.posts].map(post => [post.id, post])).values()] : result.posts, page, more: result.more }));
    } catch { if (current === generation.current) { setSnapshot(null); setError("Group access or posts could not load. Refresh to try again."); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [uid, canBrowse, teamId, scope, canReadPosts]);
  useEffect(() => {
    setSnapshot(null); setOpenComments({}); setNotice(""); setError(""); setConfirmRemoval(null); setConfirmLeave(false);
    if (canBrowse) void load();
    // Revalidate membership while visible without repeatedly resetting paged history.
    let valid = true;
    const poll = setInterval(() => {
      if (!uid || !canBrowse) return;
      const current = generation.current;
      void readClubGroupAccess(supabase, teamId, uid).then(access => {
        if (valid && current === generation.current && viewer.current.scope === scope) setSnapshot(previous => previous?.scope === scope ? { ...previous, access, posts: canReadPosts(access) ? previous.posts : [], more: canReadPosts(access) && previous.more } : previous);
      }).catch(() => { if (valid && current === generation.current) { setSnapshot(null); setError("Group access could not be verified. Refresh to try again."); } });
    }, 30000);
    // This ref counts async request generations; it does not reference a mounted node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { valid = false; clearInterval(poll); generation.current++; };
  }, [canBrowse, uid, teamId, scope, load, canReadPosts]);
  const current = canBrowse && snapshot?.scope === scope ? snapshot : null;
  const access = current?.access;
  const participates = Boolean(canJoin && access?.member);
  async function act(action: GroupAction, values: { text?: string; postId?: string } = {}) {
    if (!uid || !canBrowse || pending.current.has(scope)) return false;
    pending.current.add(scope); setBusyScope(scope); setNotice("");
    try {
      await requireOnline();
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || data.session?.user.id !== uid || viewer.current.scope !== scope || !viewer.current.active) throw new Error("Session changed. Sign in again.");
      await clubGroupAction(origin, data.session.access_token, teamId, action, values);
      if (viewer.current.scope !== scope || !viewer.current.active) return false;
      if (action === "leave") setSnapshot(null);
      if (action === "report_post") setNotice("Report sent to HoopCheck moderators.");
      else await load();
      return true;
    } catch (failure) { if (viewer.current.scope === scope) setNotice(failure instanceof Error ? failure.message : "The action could not be confirmed. Your draft is retained."); return false; }
    finally { pending.current.delete(scope); setBusyScope(previous => previous === scope ? null : previous); }
  }
  const copy = { color: theme.foreground };
  const touch = { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: 8 };
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100} style={{ flex: 1, backgroundColor: theme.background }}>
    <FlatList data={current?.posts ?? []} keyExtractor={post => post.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }} viewabilityConfig={viewability} onViewableItemsChanged={onViewable} initialNumToRender={4} windowSize={5} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      ListHeaderComponent={<View style={{ gap: 14 }}>
        <Button secondary onPress={() => router.push("/team-hub/groups")}>All club groups</Button>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.lg, backgroundColor: theme.surface, borderRadius: theme.radius.hero }}><EntityArtwork name={access?.name || "HoopGroups"} kind="teams" size={56} /><View style={{ flex: 1, gap: theme.spacing.xs }}><Text style={{ color: theme.accent, ...theme.type.caption }}>CLUB COMMUNITY</Text><Text accessibilityRole="header" style={{ ...copy, ...theme.type.section }}>{access?.name || "HoopGroups"}</Text></View></View>
        {access ? <><Text style={{ color: theme.muted }}>{access.teamName} supporters · {access.memberCount === null ? "Member count unavailable" : `${access.memberCount} members`}</Text><Button secondary onPress={() => router.push(access.teamPath as "/teams")}>Club profile</Button>
          {!canJoin && !access.moderator ? <Text style={copy}>Club group conversations are available to fan accounts and appointed moderators.</Text> : null}
          {canJoin ? <Button secondary disabled={busy} onPress={() => { if (access.member && access.moderator) setConfirmLeave(true); else void act(access.member ? "leave" : "join"); }}>{access.member ? "Leave club group" : "Join club group"}</Button> : null}
          {confirmLeave && access.member && access.moderator ? <View style={{ gap: 8 }}><Text style={copy}>Leaving also removes your fan co-moderator appointment.</Text><Button secondary disabled={busy} onPress={() => void act("leave").then(ok => { if (ok) setConfirmLeave(false); })}>Confirm leave club group</Button><Button secondary onPress={() => setConfirmLeave(false)}>Stay in group</Button></View> : null}
          {!access.member && !access.moderator && canJoin ? <Text style={{ color: theme.muted }}>Join to see the conversation.</Text> : null}
          {access.moderator ? <Button secondary onPress={() => router.push({ pathname: "/web", params: { path: `/team-hub/groups/${teamId}` } })}>Full group moderation tools</Button> : null}
        </> : null}
        {accountError || error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: theme.muted }}>{offline ? "Reconnect to verify group access." : error || accountError}</Text><Button secondary onPress={() => { retry(); void load(); }}>Verify group access again</Button></View> : null}
        {accountLoading || loading && !current ? <Text style={{ color: theme.muted }}>Verifying club group…</Text> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={{ color: theme.muted }}>{notice}</Text> : null}
        {participates ? <View style={{ gap: 10 }}><TextInput accessibilityLabel="Club group post" multiline maxLength={2000} value={text} onChangeText={setDraft} placeholder="Share something with the club group" placeholderTextColor={theme.muted} style={{ ...copy, minHeight: 70, maxHeight: 160, padding: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.input, borderRadius: theme.radius.control }} /><Button disabled={busy || !text.trim()} onPress={() => void act("create_post", { text }).then(ok => { if (ok) setDraft(previous => previous === text ? "" : previous); })}>{busy ? "Checking safety…" : "Post to club group"}</Button></View> : null}
      </View>}
      renderItem={({ item: post }) => <GlassCard style={{ padding: theme.spacing.lg, gap: theme.spacing.md, borderRadius: theme.courtside.card.radius }}>
        <Text style={{ ...copy, fontSize: 17, fontWeight: "800" }}>{post.profiles?.display_name || "HoopCheck member"}</Text><Text style={{ color: theme.muted }}>{post.is_pinned ? "Pinned · " : ""}{new Date(post.created_at).toLocaleString()}</Text><Text style={{ ...copy, lineHeight: 23 }}>{post.body}</Text>
        {post.image_url ? <GroupImage key={`${uid}:${post.id}`} userId={uid!} teamId={teamId} reference={post.image_url} enabled={active && visible.has(post.id)} /> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Pressable accessibilityRole="button" onPress={() => setOpenComments(previous => ({ ...previous, [post.id]: !previous[post.id] }))} style={touch}><Text style={{ color: theme.accent }}>Comments</Text></Pressable>
          {participates ? <Pressable accessibilityRole="button" onPress={() => setReport({ scope, postId: post.id, text: "" })} style={touch}><Text style={{ color: theme.accent }}>Report post</Text></Pressable> : null}
          {access?.moderator ? <><Pressable accessibilityRole="button" disabled={busy || post.is_pinned} onPress={() => void act("pin_post", { postId: post.id })} style={touch}><Text style={{ color: theme.accent }}>{post.is_pinned ? "Pinned" : "Pin post"}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmRemoval(post.id)} style={touch}><Text style={{ color: theme.accent }}>Remove post</Text></Pressable></> : null}
        </View>
        {report?.scope === scope && report.postId === post.id ? <View style={{ gap: 8 }}><TextInput accessibilityLabel="Group post report reason" value={report.text} maxLength={500} onChangeText={value => setReport({ scope, postId: post.id, text: value })} style={{ ...copy, minHeight: 48, padding: 12, backgroundColor: theme.input }} /><Button secondary disabled={busy || report.text.trim().length < 3} onPress={() => void act("report_post", { postId: post.id, text: report.text }).then(ok => { if (ok) setReport(null); })}>Send group report</Button><Button secondary onPress={() => setReport(null)}>Cancel group report</Button></View> : null}
        {confirmRemoval === post.id && access?.moderator ? <View style={{ gap: 8 }}><Text style={copy}>Remove this post from the club group?</Text><Button secondary disabled={busy} onPress={() => void act("remove_post", { postId: post.id }).then(ok => { if (ok) setConfirmRemoval(null); })}>Confirm remove post</Button><Button secondary onPress={() => setConfirmRemoval(null)}>Keep post</Button></View> : null}
        {openComments[post.id] ? <GroupComments key={`${uid}:${post.id}`} userId={uid!} teamId={teamId} postId={post.id} canWrite={participates} /> : null}
      </GlassCard>}
      ListFooterComponent={current?.more ? <Button secondary disabled={loading || busy} onPress={() => void load(current.page + 1)}>More group posts</Button> : access && canReadPosts(access) && !current?.posts.length && !loading ? <Text style={{ color: theme.muted }}>No club group posts yet.</Text> : null}
    />
  </KeyboardAvoidingView>;
}
