import { LeagueStandings } from "../../components/LeagueStandings";
import { EntitySchedule } from "../../components/EntitySchedule";
import { LeagueClubs } from "../../components/EntityCompetition";
import { EntityHero } from "../../components/EntityHero";
import { DirectoryCrest } from "../../components/DirectoryIdentity";
import { GlassCard, Button } from "../../src/primitives";
import { useCachedRead, useNetwork } from "../../src/native/network";
import { OfflineBanner } from "../../components/OfflineBanner";
import { Skeleton } from "../../components/Motion";
import { useEntryTheme, type EntryTheme } from "../../src/theme";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";

type ReviewSummary = { id: string; overall_rating: number | null; title: string | null; body: string | null; created_at: string; player_season: string | null; is_anonymous: boolean };
type League = { id: string; name: string; country: string | null; level: string | null; season: string | null; website: string | null; logo_url: string | null };
function safeWebsite(value: string | null) { if (!value) return null; try { const url = new URL(value.startsWith("http") ? value : `https://${value}`); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; } }

export default function LeagueDetailScreen() {
  const theme = useEntryTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const { read, savedAt } = useCachedRead();
  const { revision, offline } = useNetwork();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [league, setLeague] = useState<League | null>(null);
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
        .eq("league_id", id)
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
      const { data, error: queryError } = await read(`leagues:profile:${id}`, () => supabase.from("leagues").select("id,name,country,level,season,website,logo_url").eq("id", id).eq("active", true).eq("basketball_type", "mens").maybeSingle());
      if (!alive) return;
      if (queryError || !data) { setError(true); setLeague(null); } else { setError(false); setLeague(data as League); }
      setLoading(false);
      setRefreshing(false);
    }
    void load();
    return () => { alive = false; };
  }, [id, revision, refreshId, offline, read]);

  async function openWebsite() {
    const url = safeWebsite(league?.website ?? null);
    if (!url) return;
    try { await Linking.openURL(url); } catch { Alert.alert("Unable to open website", "Try opening the league's official website in your browser."); }
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setRefreshId(value => value + 1); }} />} contentContainerStyle={[styles.content, { paddingTop: insets.top + 62, paddingBottom: 100 }]}>
        <OfflineBanner savedAt={savedAt} />
        {loading ? <Skeleton profile /> : error || !league ? (
          <View style={styles.empty}><Text style={styles.title}>League unavailable</Text><Text style={styles.body}>This league may have been removed or is not currently listed.</Text></View>
        ) : (
          <>
            <EntityHero name={league.name} country={league.country} kind="leagues" label="LEAGUE PROFILE" path={`/leagues/${league.id}`} />
          <EntitySchedule scope={{ kind: "league", name: league.name, country: league.country }} side="mens" refresh={refreshId} />
            <View style={{marginTop:12,flexDirection:"row",alignItems:"center",gap:12}}>
              <DirectoryCrest name={league.name} kind="leagues" logoUrl={league.logo_url} size={70}/>
              <View style={{flex:1}}><Text style={{color:theme.foreground,fontWeight:"800"}}>{league.logo_url?"League logo URL on record":"League badge placeholder"}</Text>
                <Text style={{color:theme.muted,fontSize:12}}>Official crest identity and usage rights require verification.</Text></View>
            </View>
            <GlassCard style={styles.card}>
              <Text style={styles.label}>COMPETITION LEVEL</Text><Text style={styles.value}>{league.level || "Not listed"}</Text>
              <View style={styles.divider} />
              <Text style={styles.label}>SEASON</Text><Text style={styles.value}>{league.season || "Not listed"}</Text>
              <View style={styles.divider} />
              <Text style={styles.label}>COUNTRY</Text><Text style={styles.value}>{league.country || "Not listed"}</Text>
            </GlassCard>
            {safeWebsite(league.website) ? <Button onPress={openWebsite} style={styles.button}><Text style={styles.buttonText}>Open league website ↗</Text></Button> : null}
            <LeagueStandings key={league.id} id={league.id} season={league.season} side="mens" />
            <LeagueClubs key={league.id} id={league.id} />
            <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>Latest reviews</Text>
              <Text style={styles.reviewsSubtitle}>{offline ? "Reconnect to revalidate review access. Reviews are not saved offline." : "Approved reviews only · access follows your HoopCheck account permissions"}</Text>
              {reviewsLoading ? <Skeleton review /> : reviews.length ? reviews.map(review => (
                <GlassCard key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewTopRow}>
                    <Text style={styles.reviewRating}>{review.overall_rating == null ? "Rating not listed" : `${review.overall_rating}/5 overall`}</Text>
                    {review.player_season ? <Text style={styles.reviewSeason}>{review.player_season}</Text> : null}
                  </View>
                  {review.title ? <Text style={styles.reviewHeading}>{review.title}</Text> : null}
                  {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
                  <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
                </GlassCard>
              )) : <Text style={styles.reviewsEmpty}>No reviews are available to display for this account. Reviews are filtered by HoopCheck’s existing subscription and moderation permissions.</Text>}
            </View>
            <View style={styles.notice}><Text style={styles.noticeTitle}>Before you sign</Text><Text style={styles.body}>Competition details and seasons can change. Confirm league registration, team participation, contract terms and payment obligations through independently verified contacts.</Text></View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const createStyles = (theme: EntryTheme) => StyleSheet.create({
  safe: {flex:1,backgroundColor: theme.background},content: {padding:theme.spacing.lg,paddingBottom:theme.spacing.xl},back: {color: theme.accent,fontSize:15,fontWeight:"800",marginBottom:12},loader: {marginTop:70},heroIcon: {width:66,height:66,borderRadius:18,backgroundColor: theme.surface,alignItems:"center",justifyContent:"center",marginBottom:20},heroLetter: {fontSize:29,fontWeight:"900",color: theme.foreground},kicker: {color: theme.accent,fontSize:11,fontWeight:"900",letterSpacing:1.4},title: {color: theme.foreground,fontSize:29,fontWeight: "400", fontFamily: "HoopCheckDisplay",marginTop:8},location: {color: theme.muted,fontSize:15,marginTop:8},card: {backgroundColor: "transparent",borderRadius:0,borderWidth:0,borderBottomWidth:1,borderColor: theme.border,padding:8,marginTop:8},label: {color: theme.muted,fontSize:11,fontWeight:"900",letterSpacing:1},value: {color: theme.foreground,fontSize:16,fontWeight:"700",marginTop:7},divider: {height:1,backgroundColor: theme.border,marginVertical:8},button: {minHeight:50,backgroundColor: theme.button,borderRadius: theme.radius.control,alignItems:"center",justifyContent:"center",marginTop:16},buttonText: {color: theme.onButton,fontWeight:"900",fontSize:15},notice: {backgroundColor: theme.surface,borderRadius:12,padding:16,marginTop:22},noticeTitle: {color: theme.foreground,fontWeight:"900",fontSize:15,marginBottom:7},body: {color: theme.muted,fontSize:14,lineHeight:21},reviewsSection: {marginTop:14},reviewsTitle: {color: theme.foreground,fontSize:20,fontWeight:"900"},reviewsSubtitle: {color: theme.muted,fontSize:12,lineHeight:18,marginTop:5,marginBottom:12},reviewsLoader: {marginVertical:16},reviewCard: {backgroundColor: theme.surface,borderRadius: theme.radius.card,borderWidth:1,borderColor: theme.border,padding:14,marginBottom:10},reviewTopRow: {flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},reviewRating: {color: theme.accent,fontSize:13,fontWeight:"900"},reviewSeason: {color: theme.muted,fontSize:11},reviewHeading: {color: theme.foreground,fontSize:15,fontWeight:"800",marginTop:8},reviewBody: {color: theme.muted,fontSize:14,lineHeight:21,marginTop:6},reviewDate: {color: theme.muted,fontSize:11,marginTop:9},reviewsEmpty: {color: theme.muted,fontSize:13,lineHeight:19,backgroundColor: theme.surface,borderWidth:1,borderColor: theme.border,borderRadius:12,padding:14},empty: {paddingVertical:48}
});
