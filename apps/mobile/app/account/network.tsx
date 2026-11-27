import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard, Button } from "../../src/primitives";
import { useEntryTheme } from "../../src/theme";
import { useActiveScreen } from "../../src/native/useActiveScreen";
import { useNetwork } from "../../src/native/network";
import { useNativeAccount } from "../../src/native/useNativeAccount";
import { canBrowsePlayers } from "../../src/native/playerProfiles";
import { creatorCategories, filterPublicNetwork, readPublicNetwork, readPublicShowcase, type NetworkEntry, type NetworkKind } from "../../src/native/publicNetwork";

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
  const { account } = useNativeAccount();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; entry: NetworkEntry | null; state: "ready" | "error" } | null>(null);
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
  useEffect(() => {
    setDetail(null);
    if (kind === "safety" || !selectedId || !focused || offline) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    void readPublicShowcase(origin, kind, selectedId, controller.signal).then(entry => {
      if (active && !controller.signal.aborted) setDetail({ id: selectedId, entry, state: "ready" });
    }).catch(() => { if (active) setDetail({ id: selectedId, entry: null, state: "error" }); }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [kind, selectedId, focused, offline, revision, refresh]);
  const visible = useMemo(() => filterPublicNetwork(rows, query, filter), [rows, query, filter]);
  const title = kind === "agents" ? "Agents & Scouts" : kind === "creators" ? "Creators" : "Player Safety";
  const muted = { color: theme.muted, fontSize: 13, lineHeight: 19 };
  const go = (path: string) => router.push({ pathname: "/web", params: { path } });
  const header = <Stack.Screen options={{ title }} />;
  const currentDetail = focused && !offline && detail?.id === selectedId ? detail : null;
  if (kind === "safety") return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    {header}<ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 27, fontWeight: "900" }}>Protect your basketball career</Text>
      <Text style={muted}>Review suspicious offers and report them confidentially. A public incident feed is not available yet; unreviewed accusations are not published.</Text>
      {safetyTips.map(([label, detail]) => <GlassCard key={label} style={{ gap: 6 }}><Text style={{ color: theme.foreground, fontWeight: "800", fontSize: 16 }}>{label}</Text><Text style={muted}>{detail}</Text></GlassCard>)}
      <Button onPress={() => router.push({pathname:"/account/support",params:{topic:"scam"}})}>Submit confidential report</Button>
      <Button secondary onPress={() => router.push("/teams")}>Research a team</Button>
      <Text style={muted}>Do not include passwords, banking details or confidential documents in your report.</Text>
    </ScrollView>
  </SafeAreaView>;
  if (selectedId) return <SafeAreaView edges={["left","right","bottom"]} style={{flex:1,backgroundColor:theme.background}}>
    {header}<ScrollView contentContainerStyle={{padding:14,gap:12,paddingBottom:100}}>
      <Button secondary onPress={()=>{setSelectedId(null);setDetail(null);}}>Back to directory</Button>
      {offline ? <Text style={muted}>Reconnect to verify this showcase.</Text> : !currentDetail ? <Text accessibilityLiveRegion="polite" style={muted}>Loading published showcase…</Text> : currentDetail.state==="error" ? <><Text accessibilityRole="alert" style={muted}>This showcase could not be verified.</Text><Button secondary onPress={()=>setRefresh(v=>v+1)}>Retry</Button></> : !currentDetail.entry ? <Text style={muted}>This showcase is no longer available.</Text> : <View style={{gap:10}}>
        <Text accessibilityRole="header" style={{fontFamily:"HoopCheckDisplay",fontSize:24,color:theme.foreground}}>{currentDetail.entry.name}</Text>
        <Text style={{color:theme.accent,fontWeight:"700"}}>{kind==="agents"?(currentDetail.entry.category==="agent"?"Agent":"Scout"):creatorCategories[currentDetail.entry.category]}</Text>
        {kind==="agents"?<Text style={muted}>{currentDetail.entry.professionallyReviewed?"HoopCheck reviewed":currentDetail.entry.identityChecked?"Identity checked":"Not yet reviewed"} · Not a guarantee of licensing or an offer.</Text>:null}
        {[currentDetail.entry.agency,currentDetail.entry.country].filter(Boolean).length?<Text style={muted}>{[currentDetail.entry.agency,currentDetail.entry.country].filter(Boolean).join(" · ")}</Text>:null}
        {currentDetail.entry.headline?<Text style={{color:theme.foreground,fontWeight:"700"}}>{currentDetail.entry.headline}</Text>:null}
        {currentDetail.entry.description?<Text style={{color:theme.foreground,lineHeight:21}}>{currentDetail.entry.description}</Text>:<Text style={muted}>No additional public description provided.</Text>}
        {kind==="agents"?<Button secondary onPress={()=>router.push({pathname:"/account/network",params:{kind:"safety"}})}>Player safety & confidential reporting</Button>:null}
      </View>}
    </ScrollView>
  </SafeAreaView>;
  const filters: readonly (readonly [string, string])[] = kind === "agents" ? agentFilters : [["all", "All creators"], ...Object.entries(creatorCategories)];
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    {header}
    <FlatList data={offline || error || loading ? [] : visible} keyExtractor={row => row.id} initialNumToRender={8} maxToRenderPerBatch={8}
      refreshing={loading && refresh > 0 && !offline} onRefresh={() => setRefresh(value => value + 1)}
      keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 100 }}
      ListHeaderComponent={<View style={{ gap: 12 }}>
        <Text style={muted}>{kind === "agents" ? "Discover published professional showcases. Identity checks do not certify agency licensing or the legitimacy of an offer." : "Browse opt-in basketball media, trainers, podcasters and other creators. Self-described categories do not imply verification."}</Text>
        <TextInput accessibilityLabel={"Search " + title} placeholder={"Search " + title} placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} maxLength={100} style={{ minHeight: 48, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: theme.foreground, backgroundColor: theme.input }} />
        <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {filters.map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: filter === value ? theme.accent : theme.border }}><Text style={{ color: filter === value ? theme.accent : theme.foreground, fontWeight: "700" }}>{label}</Text></Pressable>)}
        </View>
        {kind==="agents" && account && canBrowsePlayers(account.user.accountType)?<Button secondary onPress={()=>router.push("/players")}>Find players</Button>:null}
        {kind==="agents" && (account?.user.accountType==="agent"||account?.user.accountType==="scout")?<Button secondary onPress={()=>router.push("/messages")}>HoopChat</Button>:null}
        <Button secondary onPress={() => go(kind === "agents" ? "/agent-studio" : "/creator-studio")}>{kind === "agents" ? "Manage professional showcase" : "Manage creator showcase"} (website)</Button>
        {kind === "agents" ? <Button secondary onPress={() => router.push({ pathname: "/account/network", params: { kind: "safety" } })}>Player safety & confidential reporting</Button> : null}
      </View>}
      ListEmptyComponent={<View style={{ gap: 10, paddingVertical: 16 }}>
        <Text accessibilityLiveRegion="polite" style={muted}>{offline ? "Reconnect to load published showcases." : loading ? "Loading published showcases…" : error ? "The directory is temporarily unavailable." : "No matching published showcases."}</Text>
        {error && !offline ? <Button secondary onPress={() => setRefresh(value => value + 1)}>Retry</Button> : null}
      </View>}
      renderItem={({ item }) => <View style={{ gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border }}>
        <Text style={{ color: theme.foreground, fontSize: 18, fontWeight: "800" }}>{item.name}</Text>
        <Text style={{ color: theme.accent, fontWeight: "700" }}>{kind === "agents" ? (item.category === "agent" ? "Agent" : "Scout") : creatorCategories[item.category]}</Text>
        {kind === "agents" ? <Text style={muted}>{item.professionallyReviewed ? "HoopCheck reviewed" : item.identityChecked ? "Identity checked" : "Not yet reviewed"}</Text> : null}
        {item.country || item.agency ? <Text style={muted}>{[item.agency, item.country].filter(Boolean).join(" · ")}</Text> : null}
        {item.headline || item.description ? <Text numberOfLines={3} style={{ color: theme.foreground }}>{item.headline || item.description}</Text> : null}
        <Button secondary onPress={() => {setDetail(null);setSelectedId(item.id);}}>View public showcase</Button>
      </View>}
      ListFooterComponent={rows.length === 200 && !offline && !error ? <Text style={muted}>Showing up to 200 published showcases.</Text> : null}
    />
  </SafeAreaView>;
}
