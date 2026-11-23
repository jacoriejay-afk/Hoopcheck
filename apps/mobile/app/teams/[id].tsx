import { TeamRoster } from "../../components/TeamRoster";
import { EntityArtwork } from "../../components/EntityArtwork";
import { ShareSheet } from "../../components/ShareSheet";
import { GlassCard } from "../../components/glass/GlassCard";
import { GlassHeader } from "../../components/glass/GlassHeader";
import { GlassBackdrop } from "../../components/glass/GlassBackdrop";
import { glassTokens as glass } from "../../src/glassTheme";
import { Button } from "../../src/primitives";
import { useCachedRead, useNetwork } from "../../src/native/network";
import { OfflineBanner } from "../../components/OfflineBanner";
import { Skeleton } from "../../components/Motion";
import { GlassThemeScope, useEntryTheme, type EntryTheme } from "../../src/theme";
import { useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";

type ReviewSummary = { id: string; overall_rating: number | null; title: string | null; body: string | null; created_at: string; player_season: string | null; is_anonymous: boolean };
type Team = { logo_url?: string | null; logo_bg?: string | null; id: string; name: string; country: string | null; city: string | null; league_name: string | null; website: string | null };
function safeWebsite(value: string | null) { if (!value) return null; try { const url = new URL(value.startsWith("http") ? value : `https://${value}`); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; } }

// Local arena artwork is used only when no verified arena photo exists in the current payload.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const arenaArtwork = require("../../assets/courtside-arena.webp");
export default function TeamDetailScreen() { return <GlassThemeScope><TeamDetailContent /></GlassThemeScope>; }
function TeamDetailContent() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { read, savedAt } = useCachedRead();
  const { revision, offline } = useNetwork();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function loadReviews() {
      setReviewsLoading(true);
      if (!id || offline) { setReviews([]); setReviewsLoading(false); return; }
      // RLS is the source of truth for who may read approved reviews.
      const { data, error: queryError } = await supabase
        .from("reviews")
        .select("id,overall_rating,title,body,created_at,player_season,is_anonymous")
        .eq("team_id", id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(3);
      if (!alive) return;
      setReviews(!queryError && data ? data as ReviewSummary[] : []);
      setReviewsLoading(false);
    }
    void loadReviews();
    return () => { alive = false; };
  }, [id, revision, refreshId, offline, read]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      if (!id) { setError(true); setLoading(false); return; }
      const { data, error: queryError } = await read(`teams:profile:${id}`, () => supabase.from("teams").select("id,name,country,city,league_name,website,logo_url,logo_bg").eq("id", id).eq("active", true).eq("basketball_type", "mens").maybeSingle());
      if (!alive) return;
      if (queryError || !data) { setError(true); setTeam(null); } else { setError(false); setTeam(data as Team); }
      setLoading(false);
      setRefreshing(false);
    }
    void load();
    return () => { alive = false; };
  }, [id, revision, refreshId, offline, read]);

  async function openWebsite() {
    const url = safeWebsite(team?.website ?? null);
    if (!url) return;
    try { await Linking.openURL(url); } catch { Alert.alert("Unable to open website", "Try opening the team's official website in your browser."); }
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <OfflineBanner savedAt={savedAt} />
      <GlassBackdrop screen="team" />
      <GlassHeader />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setRefreshId(value => value + 1); }} />} contentContainerStyle={[styles.content, { paddingBottom: 148 }]}>
        <Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => router.back()}><Text style={styles.back}>‹ Back to teams</Text></Pressable>
        {loading ? <Skeleton profile /> : error || !team ? (
          <View style={styles.empty}><Text style={styles.title}>Team unavailable</Text><Text style={styles.body}>This team may have been removed or is not currently listed.</Text></View>
        ) : (
          <>
            <View style={{ height: 190, borderRadius: glass.radii.card, overflow: "hidden", backgroundColor: glass.solid }}>
              <Image source={arenaArtwork} alt="" accessibilityIgnoresInvertColors resizeMode="cover"
                style={{ width: "100%", height: "100%", opacity: .6 }} />
              <View style={{ position: "absolute", left: 0, right: 0, bottom: 0,
                padding: 16, paddingTop: 30, backgroundColor: "rgba(7,7,10,0.74)" }}>
                <Text style={{ color: glass.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>TEAM PROFILE</Text>
              </View>
            </View>
            <GlassCard style={{ marginTop: -44, marginHorizontal: 8 }} radius={glass.radii.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <EntityArtwork name={team.name} kind="teams" size={72} logoUrl={team.logo_url} logoBg={team.logo_bg} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text accessibilityRole="header" style={{ color: glass.foreground, fontSize: 23, fontFamily: "HoopCheckDisplay" }}>{team.name}</Text>
                  <Text style={{ color: glass.secondary, fontSize: 13 }}>{[team.city, team.country].filter(Boolean).join(", ") || "Location not listed"}</Text>
                  <Text style={{ color: glass.tertiary, fontSize: 12 }}>{team.league_name || "League not listed"}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 18, marginTop: 14,
                borderTopWidth: 1, borderColor: glass.border }}>
                {([{ label: "Reviews shown", value: reviewsLoading ? "—" : String(reviews.length) },
                  { label: "Followers", value: "—" }, { label: "Trust score", value: "—" }]).map(stat =>
                  <View key={stat.label} style={{ alignItems: "center", gap: 5 }}>
                    <Text style={{ color: glass.foreground, fontWeight: "800", fontSize: 19 }}>{stat.value}</Text>
                    <Text style={{ color: glass.secondary, fontSize: 11 }}>{stat.label}</Text>
                  </View>)}
              </View>
              <View style={{ flexDirection: "row", gap: 9 }}>
                <Pressable accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/teams/[id]/review", params: { id: team.id, teamName: team.name } })}
                  style={{ flex: 1, minHeight: 50, borderRadius: glass.radii.button, backgroundColor: glass.orange,
                    alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Write a review</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Follow unavailable from team profile" disabled
                  style={{ minHeight: 50, paddingHorizontal: 13, justifyContent: "center", alignItems: "center",
                    borderRadius: glass.radii.button, borderWidth: 1, borderColor: glass.border, backgroundColor: glass.solid, opacity: .6 }}>
                  <Text style={{ color: glass.secondary, fontWeight: "700" }}>+ Follow</Text>
                </Pressable>
              </View>
              <View style={{ marginTop: 12 }}><ShareSheet title={team.name} path={`/teams/${team.id}`} /></View>
            </GlassCard>
            {safeWebsite(team.website) ? <Button onPress={openWebsite} style={styles.button}><Text style={styles.buttonText}>Open team website ↗</Text></Button> : null}
            <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xl }}><Button secondary onPress={() => router.push({ pathname: "/team-hub/groups/[teamId]", params: { teamId: team.id } })}>Club fan group</Button></View>
            <GlassCard radius={glass.radii.row} solid style={{ marginTop: 14 }}>
              <Pressable accessibilityRole="link" onPress={() => router.push("/fan-live")} style={{ minHeight: 44, justifyContent: "space-between", alignItems: "center", flexDirection: "row" }}>
                <Text style={{ color: glass.foreground, fontWeight: "700" }}>Fixtures · Browse Live Games</Text>
                <Text style={{ color: glass.orange }}>›</Text>
              </Pressable>
            </GlassCard>
            <TeamRoster key={team.id} teamId={team.id} />
            <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>Latest reviews</Text>
              <Text style={styles.reviewsSubtitle}>{offline ? "Reconnect to revalidate review access. Reviews are not saved offline." : "Approved reviews only · access follows your HoopCheck account permissions"}</Text>
              {reviewsLoading ? <Skeleton review /> : reviews.length ? reviews.map(review => (
                <GlassCard key={review.id} solid radius={glass.radii.row} style={styles.reviewCard}>
                  <View style={styles.reviewTopRow}>
                    <Text style={styles.reviewRating}>{review.overall_rating == null ? "Rating not listed" : `${review.overall_rating}/5 overall`}</Text>
                    {review.player_season ? <Text style={styles.reviewSeason}>{review.player_season}</Text> : null}
                  </View>
                  {review.title ? <Text style={styles.reviewHeading}>{review.title}</Text> : null}
                  {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
                  <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
                </GlassCard>
              )) : <GlassCard solid radius={glass.radii.row} style={{ marginTop: 12 }}>
                  <Text style={{ color: glass.foreground, fontSize: 17, fontWeight: "800" }}>Be the first to share your experience</Text>
                  <Text style={{ color: glass.secondary, lineHeight: 21, marginTop: 7 }}>No approved reviews are visible to this account. Help the next player know what to expect.</Text>
                  <Button onPress={() => router.push({ pathname: "/teams/[id]/review", params: { id: team.id, teamName: team.name } })} style={{ marginTop: 14 }}>Write a review</Button>
                </GlassCard>}
            </View>
            <View style={styles.notice}><Text style={styles.noticeTitle}>Before you sign</Text><Text style={styles.body}>Directory details are informational and may change. Confirm the team's identity, contract terms, salary, housing, insurance and payment schedule directly using independently verified contacts.</Text></View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const createStyles = (theme: EntryTheme) => StyleSheet.create({
  safe: {flex:1,backgroundColor: theme.background},content: {padding:theme.spacing.lg,paddingBottom:theme.spacing.xl},back: {color: theme.accent,fontSize:15,fontWeight:"800",marginBottom:12},loader: {marginTop:70},heroIcon: {width:66,height:66,borderRadius:18,backgroundColor: theme.surface,alignItems:"center",justifyContent:"center",marginBottom:20},heroLetter: {fontSize:29,fontWeight:"900",color: theme.foreground},kicker: {color: theme.accent,fontSize:11,fontWeight:"900",letterSpacing:1.4},title: {color: theme.foreground,fontSize:29,fontWeight: "400", fontFamily: "HoopCheckDisplay",marginTop:8},location: {color: theme.muted,fontSize:15,marginTop:8},card: {backgroundColor: theme.surface,borderRadius: theme.radius.card,borderWidth:1,borderColor: theme.border,padding:16,marginTop:16},label: {color: theme.muted,fontSize:11,fontWeight:"900",letterSpacing:1},value: {color: theme.foreground,fontSize:16,fontWeight:"700",marginTop:7},divider: {height:1,backgroundColor: theme.border,marginVertical:16},button: {minHeight:50,backgroundColor: theme.button,borderRadius: theme.radius.control,alignItems:"center",justifyContent:"center",marginTop:16},buttonText: {color: theme.onButton,fontWeight:"900",fontSize:15},reviewButton: {backgroundColor: theme.button,marginTop:10},notice: {backgroundColor: theme.surface,borderRadius:12,padding:16,marginTop:22},noticeTitle: {color: theme.foreground,fontWeight:"900",fontSize:15,marginBottom:7},body: {color: theme.muted,fontSize:14,lineHeight:21},reviewsSection: {marginTop:24},reviewsTitle: {color: theme.foreground,fontSize:20,fontWeight:"900"},reviewsSubtitle: {color: theme.muted,fontSize:12,lineHeight:18,marginTop:5,marginBottom:12},reviewsLoader: {marginVertical:16},reviewCard: {backgroundColor: theme.surface,borderRadius: theme.radius.card,borderWidth:1,borderColor: theme.border,padding:14,marginBottom:10},reviewTopRow: {flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},reviewRating: {color: theme.accent,fontSize:13,fontWeight:"900"},reviewSeason: {color: theme.muted,fontSize:11},reviewHeading: {color: theme.foreground,fontSize:15,fontWeight:"800",marginTop:8},reviewBody: {color: theme.muted,fontSize:14,lineHeight:21,marginTop:6},reviewDate: {color: theme.muted,fontSize:11,marginTop:9},reviewsEmpty: {color: theme.muted,fontSize:13,lineHeight:19,backgroundColor: theme.surface,borderWidth:1,borderColor: theme.border,borderRadius:12,padding:14},empty: {paddingVertical:48}
});
