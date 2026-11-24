import { TeamTrustIndex } from "../../components/TeamTrustIndex";
import { EntitySchedule } from "../../components/EntitySchedule";
import { useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EntityHero } from "../../components/EntityHero";
import { OfflineBanner } from "../../components/OfflineBanner";
import { Skeleton } from "../../components/Motion";
import { GlassCard } from "../../src/primitives";
import { supabase } from "../../src/lib/supabase";
import { useCachedRead, useNetwork } from "../../src/native/network";
import { readReviewAccess, type ReviewAccess } from "../../src/native/reviewAccess";
import { useEntryTheme } from "../../src/theme";

type Team = { logo_url?: string | null; logo_bg?: string | null; id: string; name: string; country: string | null; city: string | null; league_id: string | null; league_name: string | null };
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
export default function WomensTeamScreen() {
  const theme = useEntryTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { read, savedAt } = useCachedRead();
  const { revision, offline } = useNetwork();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [access, setAccess] = useState<{ id: string; value: ReviewAccess } | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const authGeneration = useRef(0);
  const [authRevision, setAuthRevision] = useState(0);
  useEffect(() => {
    // Avoid async auth methods inside the callback: they can deadlock auth.
    const { data } = supabase.auth.onAuthStateChange(() => { authGeneration.current++; setAccess(null); setAuthRevision(value => value + 1); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        if (!id) { if (active) setTeam(null); return; }
        const result = await read(`womens-teams:profile:${id}`, () => supabase.from("womens_teams").select("id,name,country,city,league_id,league_name,logo_url,logo_bg").eq("id", id).eq("active", true).maybeSingle());
        if (active) setTeam(result.error ? null : result.data as Team | null);
      } catch { if (active) setTeam(null); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [id, revision, refresh, read]);
  useEffect(() => {
    let active = true;
    const generation = authGeneration.current;
    const controller = new AbortController();
    setAccess(null); setAccessError(false); setAccessLoading(true);
    const load = async () => {
      try {
        if (!id || offline) return;
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw new Error("Sign in required");
        const value = await readReviewAccess(origin, data.session.access_token, id, controller.signal);
        if (active && generation === authGeneration.current) setAccess({ id, value });
      } catch { if (active) setAccessError(true); }
      finally { if (active) setAccessLoading(false); }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [id, revision, refresh, offline, authRevision]);
  const current = team?.id === id ? team : null;
  const permissions = access && access.id === id && !offline ? access.value : null;
  const goWeb = (path: string) => router.push({ pathname: "/web", params: { path } });
  const text = { color: theme.foreground };
  const link = { color: theme.accent };
  const touch = { minHeight: 48, justifyContent: "center" as const };
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView contentContainerStyle={{ padding: 12, paddingTop: insets.top + 62, paddingBottom: 100, gap: 10 }} refreshControl={<RefreshControl refreshing={loading && refresh > 0} onRefresh={() => setRefresh(value => value + 1)} />}>
      <OfflineBanner savedAt={savedAt} />
      {loading ? <Skeleton profile /> : !current ? <Text accessibilityRole="alert" style={text}>Team unavailable. Pull to retry.</Text> : <>
        <EntityHero logoUrl={current.logo_url} logoBg={current.logo_bg} name={current.name} country={current.country} kind="women" label="WOMEN’S TEAM PROFILE" path={`/womens/${current.id}`} location={[current.city, current.country].filter(Boolean).join(", ") || "Location not listed"} />
          <EntitySchedule scope={{ kind: "team", id: current.id }} side="womens" refresh={refresh} />
        <GlassCard><Text style={{ color: theme.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>LEAGUE</Text><Text style={{ ...text, fontSize: 16, fontWeight: "700", marginTop: 7 }}>{current.league_name || "Not listed"}</Text>
          {current.league_id ? <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/womens/leagues/[id]", params: { id: current.league_id! } })} style={touch}><Text style={link}>Open league profile</Text></Pressable> : null}
        </GlassCard>
        <TeamTrustIndex key={current.id} id={current.id} entity="womens-team" refresh={refresh} />
            <Text accessibilityRole="header" style={{ ...text, fontSize: 22, fontWeight: "800" }}>Latest reviews</Text>
        {accessLoading ? <Skeleton review /> : offline ? <Text style={text}>Reconnect to revalidate review access. Reviews are not saved offline.</Text> : accessError ? <Text accessibilityRole="alert" style={text}>Review access could not be verified. Pull to retry.</Text> : permissions?.canReadFull ? permissions.reviews.length ? permissions.reviews.map(review => <GlassCard key={review.id}>
          <Text style={link}>{review.overall_rating == null ? "Rating not listed" : `${review.overall_rating}/5 overall`}</Text>
          {review.title ? <Text style={{ ...text, fontWeight: "700", marginTop: 8 }}>{review.title}</Text> : null}
          {review.body ? <Text style={{ ...text, marginTop: 8 }}>{review.body}</Text> : null}
          <Text style={{ color: theme.muted, marginTop: 8 }}>{new Date(review.created_at).toLocaleDateString()}</Text>
        </GlassCard>) : <Text style={text}>No approved reviews are available.</Text> : <Text style={text}>Review access follows your HoopCheck membership and account permissions.</Text>}
        {permissions?.canWrite ? <Pressable accessibilityRole="link" onPress={() => goWeb(`/womens/${current.id}/review`)} style={touch}><Text style={link}>Write a review on HoopCheck</Text></Pressable> : null}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
