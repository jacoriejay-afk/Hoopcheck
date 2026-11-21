import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, PressableCard, SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { readLeagueClubs } from "../src/native/leagueSeasons";
import { useNetwork } from "../src/native/network";
import { Skeleton } from "./Motion";
export function LeagueClubs({ id }: { id: string }) {
  const t = useEntryTheme(); const router = useRouter(); const { offline, revision } = useNetwork();
  const [refresh, setRefresh] = useState(0); const [draft, setDraft] = useState(""); const [season, setSeason] = useState("");
  const scope = `${id}:${season}`;
  const [result, setResult] = useState<{ scope: string; data: Awaited<ReturnType<typeof readLeagueClubs>> | null; error: boolean } | null>(null);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    async function load() {
      if (offline) return;
      try { const data = await readLeagueClubs(supabase, id, { season, signal: controller.signal }); if (active) setResult({ scope, data, error: false }); }
      catch { if (active) setResult({ scope, data: null, error: true }); }
    }
    void load(); return () => { active = false; controller.abort(); };
  }, [id, season, scope, offline, revision, refresh]);
  const current = !offline && result?.scope === scope ? result : null;
  const apply = () => { setSeason(draft.trim()); setRefresh(value => value + 1); };
  return <View style={{ gap: t.spacing.md, marginTop: t.spacing.xl }}><SectionHeader>Clubs</SectionHeader>
    <Text style={{ color: t.muted, ...t.type.caption }}>Current active links, or clubs recorded under an exact league season label. Historical membership is not a current player roster.</Text>
    <Input accessibilityLabel="League season" placeholder="Exact season, e.g. 2026–27" maxLength={80} value={draft} onChangeText={setDraft} returnKeyType="search" onSubmitEditing={apply} />
    <View style={{ gap: t.spacing.sm }}><Button secondary onPress={apply}>Apply season</Button>{season ? <Button secondary onPress={() => { setDraft(""); setSeason(""); }}>Current clubs</Button> : null}</View>
    <Text accessibilityLiveRegion="polite" style={{ color: t.accent, ...t.type.caption }}>{season ? `Season: ${season}` : "Current active directory clubs"}</Text>
    {offline ? <Text style={{ color: t.muted }}>Reconnect for league clubs.</Text> : !current ? <Skeleton review /> : current.error ? <><Text accessibilityRole="alert" style={{ color: t.muted }}>League clubs could not load.</Text><Button secondary onPress={() => setRefresh(value => value + 1)}>Retry league clubs</Button></> : !current.data?.clubs.length ? <Text style={{ color: t.muted }}>{season ? "No active directory clubs recorded for this season." : "No active clubs linked to this league."}</Text> : current.data.clubs.slice(0, 8).map(club => <PressableCard key={club.id} accessibilityRole="link" onPress={() => router.push({ pathname: "/teams/[id]", params: { id: club.id } })}><Text style={{ color: t.foreground, ...t.type.section }}>{club.name}</Text><Text style={{ color: t.muted }}>{club.country || "Country not listed"}</Text></PressableCard>)}
    {current?.data && (current.data.limited || current.data.clubs.length > 8) ? <Text style={{ color: t.muted }}>Showing up to eight clubs from bounded directory/membership records.</Text> : null}
  </View>;
}
