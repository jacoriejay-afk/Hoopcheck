import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard, Button } from "../../src/primitives";
import { useEntryTheme } from "../../src/theme";
import { useActiveScreen } from "../../src/native/useActiveScreen";
import { useNetwork } from "../../src/native/network";
import { creatorCategories, filterPublicNetwork, readPublicNetwork, type NetworkEntry, type NetworkKind } from "../../src/native/publicNetwork";

const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
const agentFilters = [["all", "Everyone"], ["agent", "Agents"], ["scout", "Scouts"], ["reviewed", "HoopCheck reviewed"]] as const;
const safetyTips = [
  ["Upfront fees", "Verify the club and contract independently before paying any placement, roster, travel or visa fee."],
  ["Impersonation", "Confirm identities and agency authorization directly with official club contacts."],
  ["Pressure or secrecy", "Do not send account passwords, passport scans or banking credentials to unverified contacts."],
  ["Suspicious links", "Confirm tryout and payment links through official sources before opening or paying."],
] as const;
export default function BasketballNetwork() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = params.kind === "creators" || params.kind === "safety" ? params.kind : "agents";
  return <NetworkContent key={kind} kind={kind} />;
}
function NetworkContent({ kind }: { kind: NetworkKind | "safety" }) {
  const router = useRouter();
  const theme = useEntryTheme();
  const focused = useActiveScreen();
  const { offline, revision } = useNetwork();
  const [rows, setRows] = useState<NetworkEntry[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (kind === "safety") return;
    let live = true;
    const controller = new AbortController();
    setRows([]); setLoading(true); setError(false);
    if (!focused || offline) return;
    const timer = setTimeout(() => controller.abort(), 10000);
    void readPublicNetwork(origin, kind, controller.signal).then(data => {
      if (live && !controller.signal.aborted) setRows(data);
    }).catch(() => { if (live) setError(true); }).finally(() => {
      clearTimeout(timer); if (live) setLoading(false);
    });
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [kind, focused, offline, revision, refresh]);
  const visible = useMemo(() => filterPublicNetwork(rows, query, filter), [rows, query, filter]);
  const title = kind === "agents" ? "Agents & Scouts" : kind === "creators" ? "Creators" : "Player Safety";
  const muted = { color: theme.muted, fontSize: 13, lineHeight: 19 };
  const go = (path: string) => router.push({ pathname: "/web", params: { path } });
  const header = <Stack.Screen options={{ title }} />;
  if (kind === "safety") return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    {header}<ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 27, fontWeight: "900" }}>Protect your basketball career</Text>
      <Text style={muted}>Review suspicious offers and report them confidentially. A public incident feed is not available yet; unreviewed accusations are not published.</Text>
      {safetyTips.map(([label, detail]) => <GlassCard key={label} style={{ gap: 6 }}><Text style={{ color: theme.foreground, fontWeight: "800", fontSize: 16 }}>{label}</Text><Text style={muted}>{detail}</Text></GlassCard>)}
      <Button onPress={() => go("/support?scamAlert=1")}>Submit confidential report (website)</Button>
      <Button secondary onPress={() => router.push("/teams")}>Research a team</Button>
      <Text style={muted}>Do not include passwords, banking details or confidential documents in your report.</Text>
    </ScrollView>
  </SafeAreaView>;
  const filters: readonly (readonly [string, string])[] = kind === "agents" ? agentFilters : [["all", "All creators"], ...Object.entries(creatorCategories)];
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    {header}
    <FlatList data={offline || error || loading ? [] : visible} keyExtractor={row => row.id} initialNumToRender={8} maxToRenderPerBatch={8}
      refreshing={loading && refresh > 0 && !offline} onRefresh={() => setRefresh(value => value + 1)}
      keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 100 }}
      ListHeaderComponent={<View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 26, fontWeight: "900" }}>{title}</Text>
        <Text style={muted}>{kind === "agents" ? "Discover published professional showcases. Identity checks do not certify agency licensing or the legitimacy of an offer." : "Browse opt-in basketball media, trainers, podcasters and other creators. Self-described categories do not imply verification."}</Text>
        <TextInput accessibilityLabel={"Search " + title} placeholder={"Search " + title} placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} maxLength={100} style={{ minHeight: 48, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: theme.foreground, backgroundColor: theme.input }} />
        <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {filters.map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: filter === value ? theme.accent : theme.border }}><Text style={{ color: filter === value ? theme.accent : theme.foreground, fontWeight: "700" }}>{label}</Text></Pressable>)}
        </View>
        <Button secondary onPress={() => go(kind === "agents" ? "/agent-studio" : "/creator-studio")}>{kind === "agents" ? "Manage professional showcase" : "Manage creator showcase"} (website)</Button>
        {kind === "agents" ? <Button secondary onPress={() => router.push({ pathname: "/account/network", params: { kind: "safety" } })}>Player safety & confidential reporting</Button> : null}
      </View>}
      ListEmptyComponent={<View style={{ gap: 10, paddingVertical: 16 }}>
        <Text accessibilityLiveRegion="polite" style={muted}>{offline ? "Reconnect to load published showcases." : loading ? "Loading published showcases…" : error ? "The directory is temporarily unavailable." : "No matching published showcases."}</Text>
        {error && !offline ? <Button secondary onPress={() => setRefresh(value => value + 1)}>Retry</Button> : null}
      </View>}
      renderItem={({ item }) => <GlassCard style={{ gap: 8 }}>
        <Text style={{ color: theme.foreground, fontSize: 18, fontWeight: "800" }}>{item.name}</Text>
        <Text style={{ color: theme.accent, fontWeight: "700" }}>{kind === "agents" ? (item.category === "agent" ? "Agent" : "Scout") : creatorCategories[item.category]}</Text>
        {kind === "agents" ? <Text style={muted}>{item.professionallyReviewed ? "HoopCheck reviewed" : item.identityChecked ? "Identity checked" : "Not yet reviewed"}</Text> : null}
        {item.country || item.agency ? <Text style={muted}>{[item.agency, item.country].filter(Boolean).join(" · ")}</Text> : null}
        {item.headline || item.description ? <Text numberOfLines={3} style={{ color: theme.foreground }}>{item.headline || item.description}</Text> : null}
        <Button secondary onPress={() => go("/" + kind + "/" + item.id)}>View public showcase (website)</Button>
      </GlassCard>}
      ListFooterComponent={rows.length === 200 && !offline && !error ? <Text style={muted}>Showing up to 200 published showcases.</Text> : null}
    />
  </SafeAreaView>;
}
