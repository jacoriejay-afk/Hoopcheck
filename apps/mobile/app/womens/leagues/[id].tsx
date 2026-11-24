import { EntitySchedule } from "../../../components/EntitySchedule";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EntityHero } from "../../../components/EntityHero";
import { Skeleton } from "../../../components/Motion";
import { OfflineBanner } from "../../../components/OfflineBanner";
import { Button, GlassCard } from "../../../src/primitives";
import { supabase } from "../../../src/lib/supabase";
import { useCachedRead, useNetwork } from "../../../src/native/network";
import { useEntryTheme } from "../../../src/theme";

type League = { id: string; name: string; country: string | null; level: string | null };
type Team = { id: string; name: string; city: string | null; country: string | null };
export default function WomensLeagueScreen() {
  const theme = useEntryTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { read, savedAt } = useCachedRead();
  const { revision } = useNetwork();
  const [refresh, setRefresh] = useState(0);
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const resultsId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true); setFailed(false); setMore(false); setTeams([]);
    const load = async () => {
      try {
        if (!id) throw new Error("Missing league");
        const [details, rows] = await Promise.all([
          read(`womens-leagues:profile:${id}`, () => supabase.from("womens_leagues").select("id,name,country,level").eq("id", id).eq("active", true).maybeSingle()),
          read(`womens-leagues:teams:${id}:0`, () => supabase.from("womens_teams").select("id,name,city,country").eq("league_id", id).eq("active", true).order("name").order("id").range(0, 40)),
        ]);
        if (current !== generation.current) return;
        if (details.error || rows.error || !details.data) throw new Error("Unavailable");
        setLeague(details.data as League); resultsId.current = id;
        const data = (rows.data ?? []) as Team[];
        setTeams(data.slice(0, 40)); setMore(data.length > 40); setPage(0);
      } catch { if (current === generation.current) { setFailed(true); setLeague(null); } }
      finally { if (current === generation.current) setLoading(false); }
    };
    void load();
    return () => { generation.current = current + 1; };
  }, [id, revision, refresh, read]);
  async function nextPage() {
    if (loading || !more || !id || resultsId.current !== id) return;
    const current = generation.current;
    setLoading(true); setFailed(false);
    try {
      const offset = page + 40;
      const result = await read(`womens-leagues:teams:${id}:${offset}`, () => supabase.from("womens_teams").select("id,name,city,country").eq("league_id", id).eq("active", true).order("name").order("id").range(offset, offset + 40));
      if (current !== generation.current) return;
      if (result.error) throw result.error;
      const data = (result.data ?? []) as Team[];
      setTeams(previous => [...previous, ...data.slice(0, 40)]); setMore(data.length > 40); setPage(offset);
    } catch { if (current === generation.current) setFailed(true); }
    finally { if (current === generation.current) setLoading(false); }
  }
  const visible = league?.id === id ? league : null;
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <OfflineBanner savedAt={savedAt} />
    <FlatList data={visible ? teams : []} keyExtractor={item => item.id} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={loading && refresh > 0} onRefresh={() => setRefresh(value => value + 1)} />}
      ListHeaderComponent={<View style={{ gap: 16, marginBottom: 16 }}>
        {visible ? <>
          <EntityHero name={visible.name} country={visible.country} kind="leagues" label="WOMEN’S LEAGUE PROFILE" path={`/womens/leagues/${visible.id}`} />
          <EntitySchedule scope={{ kind: "league", name: visible.name, country: visible.country }} side="womens" refresh={refresh} />
          <GlassCard><Text style={{ color: theme.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>COMPETITION LEVEL</Text><Text style={{ color: theme.foreground, fontSize: 16, fontWeight: "700", marginTop: 7 }}>{visible.level || "Not listed"}</Text></GlassCard>
          <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 22, fontWeight: "800" }}>Teams</Text>
        </> : loading ? <Skeleton profile /> : <Text style={{ color: theme.foreground }}>League unavailable.</Text>}
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/womens/[id]", params: { id: item.id } })} style={{ minHeight: 64, backgroundColor: theme.surface, borderRadius: theme.radius.card, padding: 16 }}>
        <Text style={{ color: theme.foreground, fontWeight: "700" }}>{item.name}</Text><Text style={{ color: theme.muted }}>{[item.city, item.country].filter(Boolean).join(", ")}</Text>
      </Pressable>}
      ListEmptyComponent={!loading && visible ? <Text style={{ color: theme.muted }}>No teams are currently listed.</Text> : null}
      ListFooterComponent={<View style={{ gap: 12 }}>{failed ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>Could not load all results. Pull to retry.</Text> : null}{more ? <Button disabled={loading} onPress={() => void nextPage()}>{loading ? "Loading…" : "Load more teams"}</Button> : null}</View>}
    />
  </SafeAreaView>;
}
