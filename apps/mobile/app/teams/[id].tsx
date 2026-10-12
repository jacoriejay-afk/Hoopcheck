import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";

type ReviewSummary = { id: string; overall_rating: number | null; title: string | null; body: string | null; created_at: string; player_season: string | null; is_anonymous: boolean };
type Team = { id: string; name: string; country: string | null; city: string | null; league_name: string | null; website: string | null };
function safeWebsite(value: string | null) { if (!value) return null; try { const url = new URL(value.startsWith("http") ? value : `https://${value}`); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; } }

export default function TeamDetailScreen() {
  const router = useRouter();
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
      if (!id) { setReviewsLoading(false); return; }
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
  }, [id]);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!id) { setError(true); setLoading(false); return; }
      const { data, error: queryError } = await supabase.from("teams").select("id,name,country,city,league_name,website").eq("id", id).eq("active", true).eq("basketball_type", "mens").maybeSingle();
      if (!alive) return;
      if (queryError || !data) { setError(true); setTeam(null); } else setTeam(data as Team);
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [id]);

  async function openWebsite() {
    const url = safeWebsite(team?.website ?? null);
    if (!url) return;
    try { await Linking.openURL(url); } catch { Alert.alert("Unable to open website", "Try opening the team's official website in your browser."); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back to teams</Text></Pressable>
        {loading ? <ActivityIndicator size="large" color="#D69E18" style={styles.loader} /> : error || !team ? (
          <View style={styles.empty}><Text style={styles.title}>Team unavailable</Text><Text style={styles.body}>This team may have been removed or is not currently listed.</Text></View>
        ) : (
          <>
            <View style={styles.heroIcon}><Text style={styles.heroLetter}>{team.name.slice(0,1).toUpperCase()}</Text></View>
            <Text style={styles.kicker}>TEAM PROFILE</Text>
            <Text style={styles.title}>{team.name}</Text>
            <Text style={styles.location}>{[team.city, team.country].filter(Boolean).join(", ") || "Location not listed"}</Text>
            <View style={styles.card}>
              <Text style={styles.label}>LEAGUE</Text><Text style={styles.value}>{team.league_name || "Not listed"}</Text>
              <View style={styles.divider} />
              <Text style={styles.label}>LOCATION</Text><Text style={styles.value}>{[team.city, team.country].filter(Boolean).join(", ") || "Not listed"}</Text>
            </View>
            {safeWebsite(team.website) ? <Pressable onPress={openWebsite} style={styles.button}><Text style={styles.buttonText}>Open team website ↗</Text></Pressable> : null}
            <Pressable onPress={() => router.push({ pathname: "/teams/[id]/review", params: { id: team.id, teamName: team.name } })} style={[styles.button, styles.reviewButton]}><Text style={styles.buttonText}>Write a team review</Text></Pressable>
            <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>Latest reviews</Text>
              <Text style={styles.reviewsSubtitle}>Approved reviews only · access follows your HoopCheck account permissions</Text>
              {reviewsLoading ? <ActivityIndicator color="#D69E18" style={styles.reviewsLoader} /> : reviews.length ? reviews.map(review => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewTopRow}>
                    <Text style={styles.reviewRating}>{review.overall_rating == null ? "Rating not listed" : `${review.overall_rating}/5 overall`}</Text>
                    {review.player_season ? <Text style={styles.reviewSeason}>{review.player_season}</Text> : null}
                  </View>
                  {review.title ? <Text style={styles.reviewHeading}>{review.title}</Text> : null}
                  {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
                  <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
                </View>
              )) : <Text style={styles.reviewsEmpty}>No reviews are available to display for this account. Reviews are filtered by HoopCheck’s existing subscription and moderation permissions.</Text>}
            </View>
            <View style={styles.notice}><Text style={styles.noticeTitle}>Before you sign</Text><Text style={styles.body}>Directory details are informational and may change. Confirm the team's identity, contract terms, salary, housing, insurance and payment schedule directly using independently verified contacts.</Text></View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F4F6F9"},content:{padding:22,paddingBottom:36},back:{color:"#946600",fontSize:15,fontWeight:"800",marginBottom:24},loader:{marginTop:70},heroIcon:{width:66,height:66,borderRadius:18,backgroundColor:"#FFF0C2",alignItems:"center",justifyContent:"center",marginBottom:20},heroLetter:{fontSize:29,fontWeight:"900",color:"#101827"},kicker:{color:"#946600",fontSize:11,fontWeight:"900",letterSpacing:1.4},title:{color:"#101827",fontSize:29,fontWeight:"900",marginTop:8},location:{color:"#586579",fontSize:15,marginTop:8},card:{backgroundColor:"#FFFFFF",borderRadius:14,borderWidth:1,borderColor:"#E0E6EE",padding:18,marginTop:26},label:{color:"#657287",fontSize:11,fontWeight:"900",letterSpacing:1},value:{color:"#101827",fontSize:16,fontWeight:"700",marginTop:7},divider:{height:1,backgroundColor:"#E8ECF1",marginVertical:16},button:{minHeight:50,backgroundColor:"#101827",borderRadius:10,alignItems:"center",justifyContent:"center",marginTop:16},buttonText:{color:"#FFFFFF",fontWeight:"900",fontSize:15},reviewButton:{backgroundColor:"#946600",marginTop:10},notice:{backgroundColor:"#FFF6DB",borderRadius:12,padding:16,marginTop:22},noticeTitle:{color:"#5F4600",fontWeight:"900",fontSize:15,marginBottom:7},body:{color:"#586579",fontSize:14,lineHeight:21},reviewsSection:{marginTop:24},reviewsTitle:{color:"#101827",fontSize:20,fontWeight:"900"},reviewsSubtitle:{color:"#657287",fontSize:12,lineHeight:18,marginTop:5,marginBottom:12},reviewsLoader:{marginVertical:16},reviewCard:{backgroundColor:"#FFFFFF",borderRadius:12,borderWidth:1,borderColor:"#E0E6EE",padding:14,marginBottom:10},reviewTopRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},reviewRating:{color:"#946600",fontSize:13,fontWeight:"900"},reviewSeason:{color:"#657287",fontSize:11},reviewHeading:{color:"#101827",fontSize:15,fontWeight:"800",marginTop:8},reviewBody:{color:"#465367",fontSize:14,lineHeight:21,marginTop:6},reviewDate:{color:"#7B8797",fontSize:11,marginTop:9},reviewsEmpty:{color:"#657287",fontSize:13,lineHeight:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E0E6EE",borderRadius:12,padding:14},empty:{paddingVertical:48}
});
