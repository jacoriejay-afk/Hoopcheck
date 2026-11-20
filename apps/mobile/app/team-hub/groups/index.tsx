import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, PressableCard } from "../../../src/primitives";
import { useEntryTheme } from "../../../src/theme";
import { useNativeAccount } from "../../../src/native/useNativeAccount";
import { useNetwork } from "../../../src/native/network";
import { supabase } from "../../../src/lib/supabase";
import { readClubGroups } from "../../../src/native/clubGroups";
export default function ClubGroups() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account, loading: accountLoading, error: accountError, retry } = useNativeAccount();
  const { offline } = useNetwork();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const uid = account?.user.id;
  const scope = `${uid ?? ""}:${query}:${page}`;
  const [result, setResult] = useState<{ scope: string; data: Awaited<ReturnType<typeof readClubGroups>> } | null>(null);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { retry(); }, [retry]));
  useEffect(() => {
    if (!uid || offline) { setResult(null); return; }
    let valid = true;
    setResult(null); setError("");
    const timer = setTimeout(() => { void readClubGroups(supabase, query, page).then(data => { if (valid) setResult({ scope, data }); }).catch(() => { if (valid) setError("Club groups could not load. Try again."); }); }, query ? 250 : 0);
    return () => { valid = false; clearTimeout(timer); };
  }, [uid, query, page, scope, offline, revision]);
  const current = !offline && result?.scope === scope ? result.data : null;
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ padding: 20, gap: 12 }}><Text style={{ color: theme.muted }}>Explore club fan spaces. Fans can join and take part under the existing group rules.</Text>
      <TextInput accessibilityLabel="Search club groups" placeholder="Search club groups" placeholderTextColor={theme.muted} maxLength={120} value={query} onChangeText={value => { setQuery(value); setPage(0); }} style={{ minHeight: 48, padding: 12, color: theme.foreground, backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1, borderRadius: theme.radius.control }} />
      {accountError || error || offline ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>{offline ? "Reconnect to browse club groups." : error || accountError}</Text> : null}
      {!account && !accountLoading ? <Button secondary onPress={retry}>Verify account again</Button> : null}
    </View>
    <FlatList data={current?.groups ?? []} keyExtractor={group => group.team_id} contentContainerStyle={{ padding: 16, gap: 12 }} renderItem={({ item }) => <PressableCard accessibilityRole="button" onPress={() => router.push({ pathname: "/team-hub/groups/[teamId]", params: { teamId: item.team_id } })}><Text style={{ color: theme.foreground, fontSize: 20, fontWeight: "800" }}>{item.group_name}</Text><Text style={{ color: theme.accent }}>Open club group</Text></PressableCard>} ListEmptyComponent={<View style={{ padding: 20, gap: 12 }}><Text style={{ color: theme.muted }}>{accountLoading || (!current && uid && !offline && !error) ? "Loading club groups…" : current ? "No club groups match this search." : "Club groups are unavailable."}</Text>{error ? <Button secondary onPress={() => setRevision(value => value + 1)}>Retry club groups</Button> : null}</View>} />
    {page > 0 || current?.more ? <View style={{ flexDirection: "row", padding: 16, gap: 12 }}><Button secondary disabled={page === 0} onPress={() => setPage(value => value - 1)}>Previous</Button><Button secondary disabled={!current?.more} onPress={() => setPage(value => value + 1)}>Next</Button></View> : null}
  </View>;
}
