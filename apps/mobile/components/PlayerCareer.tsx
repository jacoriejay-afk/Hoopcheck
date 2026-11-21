import { summarizeCareer } from "../src/native/careerSummary";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, SectionHeader } from "../src/primitives";
import { Skeleton } from "./Motion";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import type { PlayerViewer } from "../src/native/playerProfiles";
type Stop = { id: string; team_name: string; league_name: string | null; country: string; seasons: string; position: string | null; is_public: boolean };
/** Existing website career contract and RLS; peer players also need an accepted connection. */
export function PlayerCareer({ playerId, viewer }: { playerId: string; viewer: PlayerViewer }) {
  const t = useEntryTheme();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ rows: Stop[]; loading: boolean; error: string }>({ rows: [], loading: true, error: "" });
  useEffect(() => {
    let active = true; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    setState({ rows: [], loading: true, error: "" });
    async function load() {
      try {
        if (viewer.accountType === "player" && viewer.id !== playerId) {
          const access = await supabase.from("player_contact_requests").select("id").eq("player_id", playerId).eq("requester_id", viewer.id).eq("status", "accepted").abortSignal(controller.signal).maybeSingle();
          if (access.error || !access.data) throw Error("Connect with this player to view their career history.");
        }
        if (!active || controller.signal.aborted) return;
        const result = await supabase.from("player_career_stops").select("id,team_name,league_name,country,seasons,position,is_public").eq("player_id", playerId).order("stop_order").order("created_at").limit(100).abortSignal(controller.signal);
        if (result.error) throw Error("Career history could not load. Try again.");
        if (active) setState({ rows: (result.data || []) as Stop[], loading: false, error: "" });
      } catch (error) { if (active) setState({ rows: [], loading: false, error: error instanceof Error ? error.message : "Career history is unavailable." }); }
      finally { clearTimeout(timer); }
    }
    void load(); return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [playerId, viewer.id, viewer.accountType, revision]);
  const summary = summarizeCareer(state.rows);
  return <View style={{ gap: t.spacing.md, marginBottom: t.spacing.xl }}>
    {!state.loading && !state.error ? <View style={{ gap: t.spacing.sm }}>
      <SectionHeader>Career stats</SectionHeader>
      <Text style={{ color: t.muted, ...t.type.caption }}>Based on the career records visible to your account. These are not game averages.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm }}>{[{ label: "Recorded stops", value: summary.stops }, { label: "Teams", value: summary.teams }, { label: "Countries", value: summary.countries }].map(item => <View key={item.label} style={{ flexGrow: 1, minWidth: 88, padding: t.spacing.md, borderRadius: t.radius.control, backgroundColor: t.surface, gap: t.spacing.xs }}><Text style={{ color: t.foreground, ...t.type.title, fontVariant: ["tabular-nums"] }}>{item.value}</Text><Text style={{ color: t.muted, ...t.type.caption }}>{item.label}</Text></View>)}</View>
      {state.rows.length === 100 ? <Text style={{ color: t.muted, ...t.type.caption }}>Showing totals for the first 100 visible career stops.</Text> : null}
    </View> : null}
    <SectionHeader>Career journey</SectionHeader>
    {state.loading ? <Skeleton review /> : state.error ? <><Text accessibilityRole="alert" style={{ color: t.muted }}>{state.error}</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Retry career history</Button></> : !state.rows.length ? <Text style={{ color: t.muted }}>No career stops are available to display. Playing history is supplied by the player.</Text> : state.rows.map((stop, index) => <View key={stop.id} style={{ flexDirection: "row", gap: t.spacing.md }}>
      <View style={{ width: 28, alignItems: "center", borderLeftWidth: 2, borderLeftColor: t.border }}><Text style={{ color: t.accent, ...t.type.caption }}>{String(index + 1).padStart(2, "0")}</Text></View>
      <View style={{ flex: 1, padding: t.spacing.lg, backgroundColor: t.surface, borderRadius: t.radius.card, gap: t.spacing.sm }}><Text style={{ color: t.accent, ...t.type.caption }}>{stop.seasons}</Text><Text style={{ color: t.foreground, ...t.type.section }}>{stop.team_name}</Text><Text style={{ color: t.muted }}>{[stop.league_name, stop.country, stop.position].filter(Boolean).join(" · ")}</Text>{viewer.id === playerId ? <Text style={{ color: t.muted, ...t.type.caption }}>{stop.is_public ? "Public career stop" : "Private career stop · visible to you"}</Text> : null}</View>
    </View>)}
  </View>;
}
