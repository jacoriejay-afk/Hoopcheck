import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { canBrowsePlayers } from "../src/native/playerProfiles";
import { readTeamRoster } from "../src/native/teamRoster";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { useEntryTheme } from "../src/theme";
import { Button, PressableCard, SectionHeader } from "../src/primitives";
import { Skeleton } from "./Motion";
export function TeamRoster({ teamId }: { teamId: string }) {
  const t = useEntryTheme(); const router = useRouter(); const active = useActiveScreen(); const { account, loading, retry } = useNativeAccount();
  const uid = account?.user.id; const role = account?.user.accountType; const allowed = canBrowsePlayers(role);
  const scope = `${teamId}:${uid}:${role}`; const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ scope: string; data: Awaited<ReturnType<typeof readTeamRoster>> | null; error: string } | null>(null);
  useEffect(() => {
    let live = true; setSnapshot(null);
    async function load() {
      if (!active || !allowed || !uid || !role) return;
      try {
        const before = await supabase.auth.getSession();
        if (before.error || before.data.session?.user.id !== uid) throw Error("Verify your account again.");
        const data = await readTeamRoster(supabase, teamId, { id: uid, accountType: role });
        const after = await supabase.auth.getSession();
        if (after.error || after.data.session?.user.id !== uid) throw Error("Your session changed. Verify your account again.");
        if (live) setSnapshot({ scope, data, error: "" });
      } catch (error) { if (live) setSnapshot({ scope, data: null, error: error instanceof Error ? error.message : "Roster research could not load." }); }
    }
    void load(); return () => { live = false; };
  }, [teamId, uid, role, scope, active, allowed, revision]);
  const current = active && account && snapshot?.scope === scope ? snapshot : null;
  if (!loading && account && !allowed) return null;
  return <View style={{ marginTop: t.spacing.xl, gap: t.spacing.md }}><SectionHeader>Roster research</SectionHeader>
    {!account ? <><Text style={{ color: t.muted }}>Verify your account to view player research.</Text><Button secondary onPress={retry}>Verify roster access</Button></> : !current ? <Skeleton review /> : current.error ? <><Text accessibilityRole="alert" style={{ color: t.muted }}>{current.error}</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Retry roster research</Button></> : current.data ? <>
      <Text style={{ color: t.muted, ...t.type.caption }}>Players below shared career history linked to this club. This is not a verified current roster.</Text>
      {current.data.players.length ? current.data.players.map(player => <PressableCard key={player.id} accessibilityRole="link" onPress={() => router.push({ pathname: "/players/[id]", params: { id: player.id } })}><Text style={{ color: t.foreground, ...t.type.section }}>{player.name}</Text><Text style={{ color: t.muted }}>{[player.position, ...player.seasons].filter(Boolean).join(" · ")}</Text>{player.verified ? <Text style={{ color: t.success }}>Verified professional player</Text> : null}</PressableCard>) : <Text style={{ color: t.muted }}>No visible players with shared team history.</Text>}
      <SectionHeader>Open roster opportunities</SectionHeader>
      {current.data.spots.length ? current.data.spots.map(spot => <View key={spot.id} style={{ padding: t.spacing.lg, gap: t.spacing.sm, backgroundColor: t.surface, borderRadius: t.radius.card }}><Text style={{ color: t.accent, ...t.type.caption }}>OPEN{spot.season ? ` · ${spot.season}` : ""}</Text><Text style={{ color: t.foreground, ...t.type.section }}>{spot.title}</Text>{spot.description ? <Text style={{ color: t.foreground, ...t.type.body }}>{spot.description}</Text> : null}{spot.expires_at ? <Text style={{ color: t.muted, ...t.type.caption }}>Closes {new Date(spot.expires_at).toLocaleDateString()}</Text> : null}</View>) : <Text style={{ color: t.muted }}>No open roster opportunities listed.</Text>}
      {current.data.partial ? <Text accessibilityRole="alert" style={{ color: t.muted }}>Some player profiles could not be verified.</Text> : null}
      {current.data.limited ? <Text style={{ color: t.muted, ...t.type.caption }}>This preview is limited to 24 career records, 12 players and 20 opportunities.</Text> : null}
      <Button secondary onPress={() => setRevision(value => value + 1)}>Refresh roster research</Button>
    </> : null}
  </View>;
}
