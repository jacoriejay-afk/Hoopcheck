import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, PressableCard, SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { readLeagueClubs, readRecordedLeagueSeasons } from "../src/native/leagueSeasons";
import { useNetwork } from "../src/native/network";
import { Skeleton } from "./Motion";
export function LeagueClubs({ id }: { id: string }) {
  const t = useEntryTheme(); const router = useRouter(); const { offline, revision } = useNetwork();
  const [refresh, setRefresh] = useState(0); const [draft, setDraft] = useState(""); const [season, setSeason] = useState("");
  const scope = `${id}:${season}`;
  const [choicesOpen, setChoicesOpen] = useState(false);
  const [choices, setChoices] = useState<Awaited<ReturnType<typeof readRecordedLeagueSeasons>> | null>(null);
  const [choicesError, setChoicesError] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(8);
  useEffect(() => {
    setChoices(null); setChoicesError(false);
    if (!choicesOpen || offline) return;
    const controller = new AbortController();
    void readRecordedLeagueSeasons(supabase, id, controller.signal).then(value => { if (!controller.signal.aborted) setChoices(value); }).catch(() => { if (!controller.signal.aborted) setChoicesError(true); });
    return () => controller.abort();
  }, [id, choicesOpen, offline, revision]);
  useEffect(() => setVisibleLimit(8), [scope]);
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
  return <View style={{ gap: t.spacing.md, marginTop: t.spacing.xl }}><SectionHeader>Historical Season Explorer</SectionHeader>
    <Text style={{ color: t.muted, ...t.type.caption }}>Current active links, or clubs recorded under an exact league season label. Historical membership is not a current player roster.</Text>
    <Button secondary onPress={() => setChoicesOpen(value => !value)}>{choicesOpen ? "Hide recorded seasons" : "Browse recorded seasons"}</Button>
    {choicesOpen ? <View style={{gap:t.spacing.sm}}>{offline ? <Text style={{color:t.muted}}>Reconnect to browse seasons.</Text> : choicesError ? <Text accessibilityRole="alert" style={{color:t.muted}}>Season records unavailable. Close and reopen to retry.</Text> : !choices ? <Skeleton review /> : <><Text style={{color:t.muted}}>Recorded labels only. Coverage may be incomplete{choices.limited ? " (bounded sample)" : ""}.</Text>{choices.seasons.slice(0, 30).map(label => <Button key={label} secondary onPress={() => {setDraft(label);setSeason(label);setRefresh(value => value+1);}}>{label}</Button>)}{choices.seasons.length > 30 ? <Text style={{color:t.muted}}>Showing 30 labels. Enter another exact label below.</Text> : null}{!choices.seasons.length ? <Text style={{color:t.muted}}>No visible season labels found.</Text> : null}</>}</View> : null}
    <Input accessibilityLabel="League season" placeholder="Exact season, e.g. 2026–27" maxLength={80} value={draft} onChangeText={setDraft} returnKeyType="search" onSubmitEditing={apply} />
    <View style={{ gap: t.spacing.sm }}><Button secondary onPress={apply}>Apply season</Button>{season ? <Button secondary onPress={() => { setDraft(""); setSeason(""); }}>Current clubs</Button> : null}</View>
    <Text accessibilityLiveRegion="polite" style={{ color: t.accent, ...t.type.caption }}>{season ? `Season: ${season}` : "Current active directory clubs"}</Text>
    {offline ? <Text style={{ color: t.muted }}>Reconnect for league clubs.</Text> : !current ? <Skeleton review /> : current.error ? <><Text accessibilityRole="alert" style={{ color: t.muted }}>League clubs could not load.</Text><Button secondary onPress={() => setRefresh(value => value + 1)}>Retry league clubs</Button></> : !current.data?.clubs.length ? <Text style={{ color: t.muted }}>{season ? "No active directory clubs recorded for this season." : "No active clubs linked to this league."}</Text> : current.data.clubs.slice(0, visibleLimit).map(club => <PressableCard key={club.id} accessibilityRole="link" onPress={() => router.push({ pathname: "/teams/[id]", params: { id: club.id } })}><Text style={{ color: t.foreground, ...t.type.section }}>{club.name}</Text><Text style={{ color: t.muted }}>{club.country || "Country not listed"}</Text></PressableCard>)}
    {current?.data && current.data.clubs.length > visibleLimit ? <Button secondary onPress={() => setVisibleLimit(value => value+8)}>Show more recorded clubs</Button> : null}
    {current?.data?.limited ? <Text style={{ color: t.muted }}>Results are bounded and may be incomplete.</Text> : null}
    {season ? <Text style={{color:t.muted}}>Names are from the current visible directory; archived or removed clubs and historical names may be missing. Membership records are not official standings.</Text> : null}
  </View>;
}
