import { EntityArtwork } from "./EntityArtwork";
import { CountryChip } from "../components/DirectoryIdentity";
import { Input, Button } from "../src/primitives";
import { Sheet } from "../components/Sheet";
import { useCachedRead, useNetwork } from "../src/native/network";
import { OfflineBanner } from "../components/OfflineBanner";
import { Reveal, Skeleton } from "../components/Motion";
import { RecentSearches, useRecentSearches } from "../components/RecentSearches";
import { motion } from "../src/motion/config";
import { useEntryTheme, type EntryTheme } from "../src/theme";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { teamDirectoryQuery, cleanTeamSearch, TEAM_PAGE_SIZE, mergeTeamDirectoryRows, teamDirectoryScope, EMPTY_TEAM_FACET, type TeamFacet } from "../src/native/teamDirectory";
import { TeamDirectoryFilters } from "./TeamDirectoryFilters";
import { supabase } from "../src/lib/supabase";

type Team = { logo_url?: string | null; logo_bg?: string | null; id: string; name: string; country: string | null; city: string | null; league_name: string | null; website?: string | null };
const PAGE_SIZE = TEAM_PAGE_SIZE;

export function TeamDirectoryScreen({ women = false }: { women?: boolean }) {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { read, savedAt } = useCachedRead();
  const { revision } = useNetwork();
  const { recents, remember } = useRecentSearches(women ? "womens-teams" : "teams");
  const requestId = useRef(0);
  const loadingRequest = useRef<number | null>(null);
  const appliedScope = useRef<string | null>(null);
  const [preview, setPreview] = useState<Team | null>(null);
  const [items, setItems] = useState<Team[]>([]);
  const [term, setTerm] = useState("");
  const [facet,setFacet] = useState<TeamFacet>(EMPTY_TEAM_FACET);
  const [filterOpen,setFilterOpen] = useState(false);
  const [appliedTerm, setAppliedTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (search: string, start = 0, append = false) => {
    const currentRequest = ++requestId.current;
    loadingRequest.current = currentRequest;
    setLoading(true);
    setError("");
    const clean = cleanTeamSearch(search);
    const scope = teamDirectoryScope(women,clean,facet);
    const { data, error: queryError } = await Promise.resolve().then(() => read(`team-directory:${scope}:${start}`, () => teamDirectoryQuery(supabase, women, clean, start, facet))).catch(() => ({ data: null, error: true }));
    if (currentRequest !== requestId.current) return;
    loadingRequest.current = null;
    if (queryError) {
      setError("We couldn’t load teams. Check your connection and try again.");
      if (!append) { setItems([]); setHasMore(false); setOffset(0); appliedScope.current = null; }
      setLoading(false); setRefreshing(false); return;
    }
    const rows = (data ?? []) as Team[];
    setHasMore(rows.length > PAGE_SIZE);
    const page = rows.slice(0, PAGE_SIZE);
    setItems(current => mergeTeamDirectoryRows(append ? current : [], page));
    appliedScope.current = scope;
    setOffset(start);
    setLoading(false); setRefreshing(false);
  }, [read, women, facet]);



  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedTerm(term.trim());
      void load(term, 0, false);
    }, motion.searchDelay);
    return () => { clearTimeout(timer); requestId.current += 1; loadingRequest.current = null; appliedScope.current = null; };
  }, [term, revision, load]);

  async function nextPage() {
    if (loadingRequest.current !== null || loading || refreshing || !hasMore || cleanTeamSearch(term) !== cleanTeamSearch(appliedTerm) || appliedScope.current !== teamDirectoryScope(women,appliedTerm,facet)) return;
    await load(appliedTerm, offset + PAGE_SIZE, true);
  }

  const refresh = () => {
    if (loadingRequest.current !== null || cleanTeamSearch(term) !== cleanTeamSearch(appliedTerm)) return;
    setRefreshing(true); void load(appliedTerm, 0, false);
  };
  const updateTerm = (value: string) => {
    if (value === term) return;
    requestId.current++; loadingRequest.current = null; appliedScope.current = null;
    setTerm(value); setLoading(true); setRefreshing(false); setItems([]); setHasMore(false); setOffset(0); setPreview(null);
  };

  const updateFacet = (value: TeamFacet) => {
    if (value.country===facet.country && value.league===facet.league) {setFilterOpen(false);return;}
    requestId.current++;loadingRequest.current=null;appliedScope.current=null;
    setFacet(value);setFilterOpen(false);setItems([]);setHasMore(false);setOffset(0);setLoading(true);setRefreshing(false);setPreview(null);
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <OfflineBanner savedAt={savedAt} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>DIRECTORY</Text>
        <Text style={styles.title}>Find a team</Text>
        <Text style={styles.subtitle}>{women ? "Explore women’s professional basketball teams before you sign." : "Explore men’s professional basketball teams before you sign."}</Text>
        <Pressable accessibilityRole="link" style={styles.womensLink}
          onPress={() => router.push(women ? "/teams" : "/womens")}>
          <Text style={styles.womensLinkText}>{women ? "Browse men’s teams" : "Browse women’s teams"}</Text>
        </Pressable>
        <View style={styles.searchRow}>
          <Input onBlur={() => remember(term)} onSubmitEditing={() => remember(term)} value={term} onChangeText={updateTerm} returnKeyType="search" placeholder="Team, country, city or league" placeholderTextColor={theme.muted} style={styles.input} />
        </View>
        <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
          <Pressable accessibilityRole="button" accessibilityLabel="Filter teams by country and league" onPress={()=>setFilterOpen(true)} style={{flex:1,minHeight:44,justifyContent:"center"}}><Text numberOfLines={2} style={{color:theme.accent,fontWeight:"700"}}>{facet.country ? `${facet.country}${facet.league ? " · "+facet.league : " · All leagues"}` : "Country ▾  ·  League ▾"}</Text></Pressable>
          {facet.country ? <Button secondary onPress={()=>updateFacet(EMPTY_TEAM_FACET)}>Clear</Button> : null}
        </View>
        {!term ? <RecentSearches items={recents} onSelect={updateTerm} /> : null}
        <Text style={styles.count}>{loading ? "Loading teams…" : `${items.length}${hasMore ? "+" : ""} ${items.length === 1 && !hasMore ? "result" : "results"} shown`}</Text>
      </View>
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={refresh}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {loading && items.length === 0 ? <Skeleton /> : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} colors={[theme.accent]} progressBackgroundColor={theme.surface} />}
          renderItem={({ item, index }) => (
            <Reveal key={`${appliedTerm}:${item.id}`} index={index}>
            <Pressable accessibilityHint="Hold to preview this team" onLongPress={() => setPreview(item)} onPress={() => router.push({ pathname: women ? "/womens/[id]" : "/teams/[id]", params: { id: item.id } })} style={styles.card}>
              <EntityArtwork name={item.name} kind={women ? "women" : "teams"} size={48} logoUrl={item.logo_url} logoBg={item.logo_bg} />
              <View style={styles.cardBody}>
                <Text style={styles.teamName}>{item.name}</Text>
                <CountryChip country={item.country} />
                <Text style={styles.meta}>{[item.city, item.country].filter(Boolean).join(", ") || "Location not listed"}</Text>
                {item.league_name ? <Text style={styles.league}>{item.league_name}</Text> : null}
                <Text style={styles.openProfile}>View profile →</Text>
              </View>
            </Pressable>
            </Reveal>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No teams found</Text><Text style={styles.emptyText}>Try a shorter name or another country.</Text></View>}
          ListFooterComponent={hasMore ? <Button onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color={theme.onButton} /> : <Text style={styles.moreText}>Load more teams</Text>}</Button> : <Text style={styles.footer}>Team data can change. Confirm contract details directly before signing.</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) void nextPage(); }}
        />
      )}
      {filterOpen ? <TeamDirectoryFilters key={String(women)} women={women} value={facet} onClose={()=>setFilterOpen(false)} onApply={updateFacet} /> : null}
      <Sheet open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name ?? "Team preview"}>
        <Text style={{ color: theme.muted }}>{[preview?.city, preview?.country, preview?.league_name].filter(Boolean).join(" · ") || "Location and league not listed"}</Text>
        {preview ? <Pressable accessibilityRole="button" onPress={() => { const id = preview.id; setPreview(null); router.push({ pathname: women ? "/womens/[id]" : "/teams/[id]", params: { id } }); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent }}>Open team profile</Text></Pressable> : null}
      </Sheet>
    </SafeAreaView>
  );
}

const createStyles = (theme: EntryTheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: theme.background },
  back: { color: theme.accent, fontSize: 15, fontWeight: "700", marginBottom: 18 },
  kicker: { color: theme.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: theme.foreground, fontSize: 28, fontWeight: "400", fontFamily: "HoopCheckDisplay", marginTop: 5 },
  subtitle: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  womensLink: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center" },
  womensLinkText: { color: theme.accent, fontWeight: "700", textDecorationLine: "underline" },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  input: { flex: 1, minWidth: 0, height: 48, backgroundColor: theme.input, borderRadius: theme.radius.control, paddingHorizontal: 12, color: theme.foreground, fontSize: 14 },
  searchButton: { backgroundColor: theme.surface, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 },
  searchButtonText: { color: theme.foreground, fontWeight: "900" },
  count: { color: theme.muted, fontSize: 12, marginTop: 12 },
  list: { padding: 10, paddingBottom: 100, gap: 2 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "transparent", borderRadius: 0, padding: 9, borderBottomWidth: 1, borderColor: theme.border, gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  logoText: { color: theme.foreground, fontSize: 19, fontWeight: "900" },
  cardBody: { flex: 1 },
  teamName: { color: theme.foreground, fontSize: 15, fontWeight: "800" },
  meta: { color: theme.muted, fontSize: 12, marginTop: 4 },
  league: { color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 5 },
  openProfile: { color: theme.accent, fontSize: 12, fontWeight: "900", marginTop: 8 },
  loader: { marginTop: 45 },
  errorBox: { margin: 16, padding: 14, backgroundColor: theme.errorSurface, borderRadius: 10 },
  error: { color: theme.error }, retry: { color: theme.accent, fontWeight: "800", marginTop: 8 },
  empty: { padding: 30, alignItems: "center" }, emptyTitle: { color: theme.foreground, fontWeight: "900", fontSize: 17 }, emptyText: { color: theme.muted, textAlign: "center", marginTop: 7 },
  more: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: theme.button, borderRadius: theme.radius.control, marginTop: 4 },
  moreText: { color: theme.onButton, fontWeight: "800" },
  footer: { color: theme.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 8, paddingTop: 14, textAlign: "center" },
});
