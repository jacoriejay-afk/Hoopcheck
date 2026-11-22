import { CourtsideBanner } from "../../../components/CourtsideBanner";
import { Skeleton } from "../../../components/Motion";
import { EntityArtwork } from "../../../components/EntityArtwork";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, PressableCard } from "../../../src/primitives";
import { useEntryTheme } from "../../../src/theme";
import { useNativeAccount } from "../../../src/native/useNativeAccount";
import { useNetwork } from "../../../src/native/network";
import { supabase } from "../../../src/lib/supabase";
import { readClubGroups, readJoinedClubGroups } from "../../../src/native/clubGroups";
export default function ClubGroups() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account, loading: accountLoading, error: accountError, retry } = useNativeAccount();
  const { offline } = useNetwork();
  const [mode, setMode] = useState<"discover" | "joined">("discover");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const uid = account?.user.id;
  const scope = `${uid ?? ""}:${query}:${page}:${mode}`;
  const [result, setResult] = useState<{ scope: string; data: Awaited<ReturnType<typeof readClubGroups>> } | null>(null);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { retry(); }, [retry]));
  useEffect(() => {
    if (!uid || offline) { setResult(null); return; }
    let valid = true;
    setResult(null); setError("");
    const timer = setTimeout(() => { void (mode === "joined" ? readJoinedClubGroups(supabase, uid, query, page) : readClubGroups(supabase, query, page)).then(data => { if (valid) setResult({ scope, data }); }).catch(() => { if (valid) setError("Club groups could not load. Try again."); }); }, query ? 250 : 0);
    return () => { valid = false; clearTimeout(timer); };
  }, [uid, query, page, mode, scope, offline, revision]);
  const current = !offline && result?.scope === scope ? result.data : null;
  const header = <View style={{ gap: theme.spacing.md }}><CourtsideBanner eyebrow="HOOPGROUPS" title="Find your people">Find your club. Join the conversation.</CourtsideBanner>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 6, padding: 6, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: theme.glassBorder, backgroundColor: theme.elevatedSurface }}>{(["discover", "joined"] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => { setMode(value); setPage(0); }} style={({ pressed }) => ({ minHeight: 44, flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: mode === value ? theme.accentSurface : "transparent", opacity: pressed ? .7 : 1 })}><Text style={{ color: mode === value ? theme.accent : theme.foreground, fontWeight: "600" }}>{value === "discover" ? "Discover" : "Joined groups"}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="Search club groups" placeholder="Search club groups" placeholderTextColor={theme.muted} maxLength={120} value={query} onChangeText={value => { setQuery(value); setPage(0); }} style={{ minHeight: 54, paddingHorizontal: 16, paddingVertical: 12, color: theme.foreground, backgroundColor: theme.glassFill, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: 20 }} />
      {accountError || error || offline ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>{offline ? "Reconnect to browse club groups." : error || accountError}</Text> : null}
      {!account && !accountLoading ? <Button secondary onPress={retry}>Verify account again</Button> : null}
    </View>;
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <FlatList style={{ flex: 1 }} ListHeaderComponent={header} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" data={current?.groups ?? []} keyExtractor={group => group.team_id} contentContainerStyle={{ padding: 16, gap: 12 }} renderItem={({ item }) => <PressableCard accessibilityRole="button" onPress={() => router.push({ pathname: "/team-hub/groups/[teamId]", params: { teamId: item.team_id } })}><View style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}><EntityArtwork name={item.group_name} kind="teams" size={60} /><Text style={{ ...theme.type.section, color: theme.foreground, flex: 1 }}>{item.group_name}</Text></View><Text style={{ color: theme.muted, ...theme.type.caption }}>{mode === "joined" ? "Your club community" : "Club fan community"}</Text><Text style={{ color: theme.accent }}>Open club group</Text></PressableCard>} ListEmptyComponent={accountLoading || (!current && uid && !offline && !error) ? <Skeleton /> : <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}><Text accessibilityRole="header" style={{ ...theme.type.title, color: theme.foreground }}>HoopGroups</Text><Text style={{ color: theme.muted }}>{accountLoading || (!current && uid && !offline && !error) ? "Loading club groups…" : current ? "No club groups match this search." : "Club groups are unavailable."}</Text>{error ? <Button secondary onPress={() => setRevision(value => value + 1)}>Retry club groups</Button> : null}</View>} ListFooterComponent={page > 0 || current?.more ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}><Button secondary disabled={page === 0} onPress={() => setPage(value => value - 1)}>Previous</Button><Button secondary disabled={!current?.more} onPress={() => setPage(value => value + 1)}>Next</Button></View> : null} />
  </View>;
}
