import { ExploreLinks } from "../components/ExploreLinks";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Input, GlassCard, Button } from "../src/primitives";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { motion } from "../src/motion/config";
import { searchDirectory, searchResultPath, type SearchGroup, type SearchKind } from "../src/native/directorySearch";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { canBrowsePlayers } from "../src/native/playerProfiles";
import { useNetwork } from "../src/native/network";
import { RecentSearches, useRecentSearches } from "../components/RecentSearches";
import { Skeleton } from "../components/Motion";
const EMPTY_OFFSETS: Partial<Record<SearchKind,number>> = {};
const labels: Record<SearchKind, string> = { teams: "Men’s teams", women: "Women’s teams", leagues: "Men’s leagues", "womens-leagues": "Women’s leagues", players: "Players", coaches: "Coaches" };
export default function SearchScreen() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account } = useNativeAccount();
  const includePlayers = canBrowsePlayers(account?.user.accountType);
  const scope = `${account?.user.id ?? ""}:${account?.user.accountType ?? ""}`;
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [term, setTerm] = useState(typeof q === "string" ? q : "");
  const [result, setResult] = useState<{ term: string; scope: string; offsets: Partial<Record<SearchKind,number>>; groups: SearchGroup[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<SearchKind | "all">("all");
  const [pageState, setPageState] = useState<{key:string; offsets:Partial<Record<SearchKind,number>>}>({key:"",offsets:{}});
  const [retryId,setRetryId] = useState(0);
  const [failed,setFailed] = useState(false);
  const searchKey = JSON.stringify([scope,term]);
  const offsets = pageState.key === searchKey ? pageState.offsets : EMPTY_OFFSETS;
  const selectedKind = kind === "players" && !includePlayers ? "all" : kind;
  useEffect(()=>{if (!includePlayers && kind === "players") setKind("all");},[includePlayers,kind]);
  const { offline, revision } = useNetwork();
  const { recents, remember } = useRecentSearches("all-directories");
  useEffect(() => { if (typeof q === "string") setTerm(q); }, [q]);
  useEffect(() => {
    let active = true;
    if (term.trim().length < 2 || offline) { setLoading(false); return; }
    setLoading(true); setFailed(false);
    const timer = setTimeout(() => {
      void searchDirectory(supabase, term, includePlayers, offsets).then(groups => {
        if (active) setResult({ term, scope, offsets, groups });
      }).catch(()=>{if(active){setResult(null);setFailed(true);}}).finally(() => { if (active) setLoading(false); });
    }, motion.searchDelay);
    return () => { active = false; clearTimeout(timer); };
  }, [term, offline, revision, includePlayers, scope, offsets, retryId]);
  const groups = result?.term === term && result.scope === scope && result.offsets === offsets && !offline ? result.groups : [];
  const visibleGroups = groups.filter(group => (group.kind !== "players" || includePlayers) && (selectedKind === "all" || selectedKind === group.kind));
  const changePage = (directory:SearchKind,offset:number) => setPageState({key:searchKey,offsets:{...offsets,[directory]:Math.max(0,offset)}});
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, paddingBottom: 100, gap: 10 }}>
      <Input accessibilityLabel="Search basketball directory" placeholder="Team, country, league, coach or @username" value={term} maxLength={100} onChangeText={setTerm} returnKeyType="search" onSubmitEditing={() => remember(term)} onBlur={() => remember(term)} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {(["all", ...Object.keys(labels).filter(value => value !== "players" || includePlayers)] as (SearchKind | "all")[]).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: selectedKind === value }} onPress={() => setKind(value)} style={({ pressed }) => ({ minHeight: theme.courtside.navigation.touchTarget, paddingHorizontal: 7, maxWidth: "100%", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: selectedKind === value ? theme.accentSurface : theme.chip, opacity: pressed ? .7 : 1 })}><Text style={{ color: selectedKind === value ? theme.accent : theme.onChip, ...theme.type.caption }}>{value === "all" ? "All" : labels[value]}</Text></Pressable>)}
      </View>
      {!term ? <RecentSearches items={recents} onSelect={setTerm} /> : null}
      {!term.trim() ? <View style={{ gap: 7 }}><Text accessibilityRole="header" style={{ fontFamily: "HoopCheckDisplay", color: theme.foreground, fontSize: 22 }}>EXPLORE</Text><ExploreLinks compact /></View> : null}
      {offline ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>Reconnect to search the directories.</Text> : term.trim().length < 2 ? (term.trim().length > 0 ? <Text style={{ color: theme.muted }}>Enter at least two characters.</Text> : null) : loading ? <Skeleton /> : failed ? <View><Text accessibilityRole="alert" style={{color:theme.muted}}>Search could not load.</Text><Button secondary onPress={()=>setRetryId(v=>v+1)}>Retry search</Button></View> : result?.offsets === offsets && result.term === term && result.scope === scope && visibleGroups.every(group => !group.rows.length && !group.failed) ? <Text style={{ color: theme.muted }}>No matching results.</Text> : null}
      {visibleGroups.map(group => <View key={group.kind} style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 19, fontFamily: "HoopCheckDisplay" }}>{labels[group.kind]}</Text>
        {group.failed ? <View><Text accessibilityRole="alert" style={{ color: theme.muted }}>These results could not be loaded.</Text><Button secondary onPress={()=>setRetryId(v=>v+1)}>Retry search</Button></View> : !group.rows.length ? <Text style={{ color: theme.muted }}>No matches in this directory.</Text> : group.rows.map(row => {
          const path = searchResultPath(group.kind, row.id);
          return <Pressable key={row.id} style={({ pressed }) => ({ minHeight: theme.courtside.navigation.touchTarget, opacity: pressed ? .7 : 1 })} accessibilityRole="link" disabled={!path} onPress={() => { remember(term); if (path) router.push(path as "/teams"); }}><GlassCard style={{ padding: 9 }}>
            <Text style={{ color: theme.foreground, fontSize: 17, fontWeight: "700" }}>{row.name || row.display_name || (row.username ? `@${row.username}` : "Player")}</Text>
            {row.country ? <Text style={{ color: theme.muted }}>{row.country}</Text> : null}
          </GlassCard></Pressable>;
        })}
        {!group.failed && ((offsets[group.kind] ?? 0)>0 || group.rows.length===6) ? <View style={{flexDirection:"row",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {(offsets[group.kind] ?? 0)>0 ? <Button secondary disabled={loading} onPress={()=>changePage(group.kind,(offsets[group.kind]??0)-6)}>Previous</Button> : null}
          <Text style={{color:theme.muted}}>Page {Math.floor((offsets[group.kind]??0)/6)+1}</Text>
          {group.rows.length===6 ? <Button secondary disabled={loading} onPress={()=>changePage(group.kind,(offsets[group.kind]??0)+6)}>Next results</Button> : null}
        </View> : null}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
