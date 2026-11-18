import { useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DirectoryCrest, CountryChip } from "../../components/DirectoryIdentity";
import { ShareSheet } from "../../components/ShareSheet";
import { OfflineBanner } from "../../components/OfflineBanner";
import { Skeleton } from "../../components/Motion";
import { GlassCard } from "../../src/primitives";
import { supabase } from "../../src/lib/supabase";
import { useCachedRead, useNetwork } from "../../src/native/network";
import { readReviewAccess, type ReviewAccess } from "../../src/native/reviewAccess";
import { useEntryTheme } from "../../src/theme";

type Team = { id: string; name: string; country: string | null; city: string | null; league_id: string | null; league_name: string | null };
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
export default function WomensTeamScreen() {
  const theme = useEntryTheme();
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
        const result = await read(`womens-teams:profile:${id}`, () => supabase.from("womens_teams").select("id,name,country,city,league_id,league_name").eq("id", id).eq("active", true).maybeSingle());
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
    <OfflineBanner savedAt={savedAt} />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} refreshControl={<RefreshControl refreshing={loading && refresh > 0} onRefresh={() => setRefresh(value => value + 1)} />}>
      <Pressable accessibilityRole="link" onPress={() => router.push("/womens")} style={touch}><Text style={link}>‹ Women’s teams</Text></Pressable>
      {loading ? <Skeleton profile /> : !current ? <Text accessibilityRole="alert" style={text}>Team unavailable. Pull to retry.</Text> : <>
        <View style={{ backgroundColor: theme.entityHero.background, padding: 24, borderRadius: theme.radius.hero, gap: 12 }}>
          <DirectoryCrest name={current.name} kind="women" size={88} />
          <CountryChip country={current.country} />
          <Text style={{ color: theme.entityHero.muted }}>WOMEN’S TEAM PROFILE</Text>
          <Text accessibilityRole="header" style={{ color: theme.entityHero.ink, fontSize: 30, fontWeight: "900" }}>{current.name}</Text>
          <ShareSheet onHero title={current.name} path={`/womens/${current.id}`} />
          <Text style={{ color: theme.entityHero.muted }}>{[current.city, current.country].filter(Boolean).join(", ") || "Location not listed"}</Text>
        </View>
        <GlassCard><Text style={{ color: theme.muted }}>LEAGUE</Text><Text style={text}>{current.league_name || "Not listed"}</Text>
          {current.league_id ? <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/womens/leagues/[id]", params: { id: current.league_id! } })} style={touch}><Text style={link}>Open league profile</Text></Pressable> : null}
        </GlassCard>
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
