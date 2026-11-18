import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Input, GlassCard } from "../src/primitives";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { motion } from "../src/motion/config";
import { searchDirectory, searchResultPath, type SearchGroup, type SearchKind } from "../src/native/directorySearch";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { canBrowsePlayers } from "../src/native/playerProfiles";
import { useNetwork } from "../src/native/network";
import { RecentSearches, useRecentSearches } from "../components/RecentSearches";
import { Skeleton } from "../components/Motion";
const labels: Record<SearchKind, string> = { teams: "Men’s teams", women: "Women’s teams", leagues: "Men’s leagues", "womens-leagues": "Women’s leagues", players: "Players", coaches: "Coaches" };
export default function SearchScreen() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account } = useNativeAccount();
  const includePlayers = canBrowsePlayers(account?.user.accountType);
  const scope = `${account?.user.id ?? ""}:${account?.user.accountType ?? ""}`;
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [term, setTerm] = useState(typeof q === "string" ? q : "");
  const [result, setResult] = useState<{ term: string; scope: string; groups: SearchGroup[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { offline, revision } = useNetwork();
  const { recents, remember } = useRecentSearches("all-directories");
  useEffect(() => { if (typeof q === "string") setTerm(q); }, [q]);
  useEffect(() => {
    let active = true;
    if (term.trim().length < 2 || offline) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      void searchDirectory(supabase, term, includePlayers).then(groups => {
        if (active) setResult({ term, scope, groups });
      }).finally(() => { if (active) setLoading(false); });
    }, motion.searchDelay);
    return () => { active = false; clearTimeout(timer); };
  }, [term, offline, revision, includePlayers, scope]);
  const groups = result?.term === term && result.scope === scope && !offline ? result.groups : [];
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 30, fontWeight: "900" }}>Search basketball</Text>
      <Input accessibilityLabel="Search basketball directory" placeholder="Team, country, league, coach or @username" value={term} maxLength={100} onChangeText={setTerm} returnKeyType="search" onSubmitEditing={() => remember(term)} onBlur={() => remember(term)} />
      {!term ? <RecentSearches items={recents} onSelect={setTerm} /> : null}
      {offline ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>Reconnect to search the directories.</Text> : term.trim().length < 2 ? <Text style={{ color: theme.muted }}>Enter at least two characters. Player search uses public usernames.</Text> : loading ? <Skeleton /> : groups.every(group => !group.rows.length && !group.failed) ? <Text style={{ color: theme.muted }}>No matching results.</Text> : null}
      {groups.filter(group => group.kind !== "players" || includePlayers).map(group => <View key={group.kind} style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 19, fontWeight: "800" }}>{labels[group.kind]}</Text>
        {group.failed ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>These results could not be loaded. Try searching again.</Text> : !group.rows.length ? <Text style={{ color: theme.muted }}>No matches in this directory.</Text> : group.rows.map(row => {
          const path = searchResultPath(group.kind, row.id);
          return <Pressable key={row.id} accessibilityRole="link" disabled={!path} onPress={() => { remember(term); if (path) router.push(path as "/teams"); }}><GlassCard style={{ padding: 16 }}>
            <Text style={{ color: theme.foreground, fontSize: 17, fontWeight: "700" }}>{row.name || row.display_name || (row.username ? `@${row.username}` : "Player")}</Text>
            {row.country ? <Text style={{ color: theme.muted }}>{row.country}</Text> : null}
          </GlassCard></Pressable>;
        })}
        {group.rows.length === 6 ? <Text style={{ color: theme.muted }}>Showing the first six matches.</Text> : null}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
