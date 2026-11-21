import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, PressableCard, SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { useNetwork } from "../src/native/network";
import { Skeleton } from "./Motion";
type Club = { id: string; name: string; country: string | null };
/** Same direct + active-membership union as the website league profile. */
export function LeagueClubs({ id }: { id: string }) {
  const t = useEntryTheme(); const router = useRouter(); const { offline, revision } = useNetwork();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ id: string; rows: Club[]; error: boolean } | null>(null);
  useEffect(() => {
    let active = true; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    setResult(null);
    async function load() {
      if (offline) return;
      try {
        const [direct, memberships] = await Promise.all([
          supabase.from("teams").select("id,name,country").eq("league_id", id).eq("active", true).order("name").limit(50).abortSignal(controller.signal),
          supabase.from("team_league_memberships").select("team_id").eq("league_id", id).eq("active", true).order("team_id").limit(100).abortSignal(controller.signal),
        ]);
        if (direct.error || memberships.error) throw Error("Clubs unavailable");
        const ids = [...new Set((memberships.data || []).map(row => row.team_id))];
        const linked = ids.length ? await supabase.from("teams").select("id,name,country").in("id", ids).eq("active", true).order("name").limit(50).abortSignal(controller.signal) : { data: [], error: null };
        if (linked.error) throw Error("Clubs unavailable");
        if (active) setResult({ id, rows: [...new Map([...(direct.data || []), ...(linked.data || [])].map(row => [row.id, row])).values()].sort((a, b) => a.name.localeCompare(b.name)), error: false });
      } catch { if (active) setResult({ id, rows: [], error: true }); }
      finally { clearTimeout(timer); }
    }
    void load(); return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [id, offline, revision, refresh]);
  const current = !offline && result?.id === id ? result : null;
  return <View style={{ gap: t.spacing.md, marginTop: t.spacing.xl }}><SectionHeader>Clubs</SectionHeader>
    {offline ? <Text style={{ color: t.muted }}>Reconnect for current league clubs.</Text> : !current ? <Skeleton review /> : current.error ? <><Text accessibilityRole="alert" style={{ color: t.muted }}>League clubs could not load.</Text><Button secondary onPress={() => setRefresh(value => value + 1)}>Retry league clubs</Button></> : !current.rows.length ? <Text style={{ color: t.muted }}>No active clubs linked to this league.</Text> : current.rows.slice(0, 8).map(club => <PressableCard key={club.id} accessibilityRole="link" onPress={() => router.push({ pathname: "/teams/[id]", params: { id: club.id } })}><Text style={{ color: t.foreground, ...t.type.section }}>{club.name}</Text><Text style={{ color: t.muted }}>{club.country || "Country not listed"}</Text></PressableCard>)}
    {current && current.rows.length > 8 ? <Text style={{ color: t.muted }}>Showing the first eight linked clubs.</Text> : null}
  </View>;
}
