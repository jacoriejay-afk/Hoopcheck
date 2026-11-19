import { readWithDeadline } from "../src/native/readDeadline";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { supabase } from "../src/lib/supabase";
import { connectionPath, visibleConnections, type PublicConnection } from "../src/native/connectionPresentation";
import { Skeleton } from "../components/Motion";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";

export default function ConnectionsScreen() {
  const theme = useEntryTheme(); const router = useRouter();
  const { account, loading: accountLoading, error: accountError, retry } = useNativeAccount();
  const uid = account?.user.id; const role = account?.user.accountType;
  const [mode, setMode] = useState<"following" | "followers">("following");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ scope: string; rows: PublicConnection[]; failed: boolean } | null>(null);
  const scope = `${uid}:${role}:${mode}:${revision}`;
  useFocusEffect(useCallback(() => {
    let alive = true; const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 15000);
    const load = async () => {
      if (!uid || !role) return;
      try {
        const before = await readWithDeadline(() => supabase.auth.getSession());
        if (before.error || before.data.session?.user.id !== uid) throw new Error("Session changed");
        // Existing website RPC: read-only, no new tables, permissions or mutations.
        const response = await supabase.rpc("get_public_follow_list", { p_mode: mode, p_target_type: mode === "followers" ? role === "fan" ? "fan" : "player" : null, p_target_id: mode === "followers" ? uid : null, p_user_id: mode === "following" ? uid : null }).abortSignal(controller.signal);
        const after = await readWithDeadline(() => supabase.auth.getSession());
        if (controller.signal.aborted || response.error || after.error || after.data.session?.user.id !== uid) throw new Error("Connections unavailable");
        const rows = visibleConnections(response.data, role);
        if (alive) setResult({ scope, rows, failed: false });
      } catch { if (alive) setResult({ scope, rows: [], failed: true }); }
      finally { clearTimeout(deadline); }
    };
    void load();
    return () => { alive = false; controller.abort(); clearTimeout(deadline); };
  }, [uid, role, mode, scope]));
  const current = account && result?.scope === scope ? result : null;
  const loading = accountLoading || Boolean(account && !current);
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <FlatList data={current?.rows || []} keyExtractor={(row, index) => `${row.target_type}:${row.target_id}:${index}`} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
      ListHeaderComponent={<View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <Text style={{ color: theme.accent, ...theme.type.caption, fontWeight: "800" }}>{role === "fan" ? "FAN NETWORK" : "HOOPCHECK NETWORK"}</Text>
        <Text style={{ color: theme.muted, ...theme.type.body }}>{role === "fan" ? "Teams and fans in your HoopCheck network." : "Real connections from the HoopCheck follow graph. Private profiles are not listed."}</Text>
        <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: theme.spacing.sm }}>{(["following", "followers"] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === mode }} onPress={() => setMode(value)} style={({ pressed }) => ({ flex: 1, minHeight: 48, padding: theme.spacing.md, borderRadius: theme.radius.control, backgroundColor: mode === value ? theme.accentSurface : theme.surface, borderWidth: 1, borderColor: mode === value ? theme.accent : theme.border, opacity: pressed ? .7 : 1 })}><Text style={{ color: theme.foreground, fontWeight: "700" }}>{value === "following" ? "Following" : "Followers"}</Text></Pressable>)}</View>
      </View>}
      renderItem={({ item }) => { const path = connectionPath(item, role || ""); const content = <><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.chip, alignItems: "center", justifyContent: "center" }}><Text style={{ color: theme.foreground, fontWeight: "800" }}>{(item.display_name || "HC").slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: theme.foreground, fontWeight: "700" }}>{item.display_name || "HoopCheck member"}</Text><Text style={{ color: theme.muted, ...theme.type.caption }}>{item.target_type === "team" ? "Team" : item.target_type === "fan" ? "Fan" : "Player"}</Text></View>{path ? <Text style={{ color: theme.accent }}>→</Text> : null}</>;
        const style = { flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.md, padding: theme.spacing.md, minHeight: 64, borderRadius: theme.radius.control, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border };
        return path ? <Pressable accessibilityRole="link" onPress={() => path.startsWith("/fans/") ? router.push({ pathname: "/web", params: { path } }) : router.push({ pathname: item.target_type === "team" ? "/teams/[id]" : "/players/[id]", params: { id: item.target_type === "team" ? item.target_id : item.id || item.target_id } })} style={({ pressed }) => [style, { opacity: pressed ? .7 : 1 }]}>{content}</Pressable> : <View style={style}>{content}</View>;
      }}
      ListEmptyComponent={loading ? <Skeleton /> : !account || current?.failed ? <View style={{ gap: theme.spacing.md }}><Text accessibilityRole="alert" style={{ color: theme.muted }}>{account ? "Connections could not be loaded. Please try again." : accountError || "Reconnect to verify your account."}</Text><Button secondary onPress={() => account ? setRevision(value => value + 1) : retry()}>Try again</Button></View> : <View style={{ gap: theme.spacing.sm }}><Text style={{ color: theme.foreground, ...theme.type.section }}>No public connections yet</Text><Text style={{ color: theme.muted }}>Only real, visible follow relationships appear here.</Text></View>}
    />
  </SafeAreaView>;
}
