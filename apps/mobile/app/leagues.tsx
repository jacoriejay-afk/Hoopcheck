import { DirectoryCrest, CountryChip } from "../components/DirectoryIdentity";
import { Input, Button } from "../src/primitives";
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
import { supabase } from "../src/lib/supabase";

type League = { id: string; name: string; country: string | null; level: string | null; season: string | null; website: string | null };
const PAGE_SIZE = 40;

export default function LeaguesScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { read, savedAt } = useCachedRead();
  const { revision } = useNetwork();
  const { recents, remember } = useRecentSearches("leagues");
  const requestId = useRef(0);
  const [items, setItems] = useState<League[]>([]);
  const [term, setTerm] = useState("");
  const [appliedTerm, setAppliedTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (search: string, start = 0, append = false) => {
    const currentRequest = ++requestId.current;
    if (start === 0) setLoading(true);
    setError("");
    const clean = search.trim().replace(/[^\p{L}\p{N} '\-]/gu, " ").replace(/\s+/g, " ").trim();
    let query = supabase.from("leagues").select("id,name,country,level,season,website").eq("active", true).eq("basketball_type", "mens").order("name", { ascending: true }).range(start, start + PAGE_SIZE);
    if (clean) query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%,level.ilike.%${clean}%`);
    const { data, error: queryError } = await read(`leagues:${clean}:${start}`, () => query);
    if (currentRequest !== requestId.current) return;
    if (queryError) {
      setError("We couldn’t load leagues. Check your connection and try again.");
      if (!append) setItems([]);
      setLoading(false); setRefreshing(false); return;
    }
    const rows = (data ?? []) as League[];
    setHasMore(rows.length > PAGE_SIZE);
    const page = rows.slice(0, PAGE_SIZE);
    setItems(append ? current => [...current, ...page] : page);
    setOffset(start);
    setLoading(false); setRefreshing(false);
  }, [read]);


  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedTerm(term.trim());
      void load(term, 0, false);
    }, motion.searchDelay);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [term, revision, load]);

  async function nextPage() { if (loading || !hasMore) return; setLoading(true); await load(appliedTerm, offset + PAGE_SIZE, true); }
  const refresh = () => { setRefreshing(true); void load(appliedTerm, 0, false); };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <OfflineBanner savedAt={savedAt} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>DIRECTORY</Text>
        <Text style={styles.title}>Find a league</Text>
        <Text style={styles.subtitle}>Explore men’s professional basketball leagues and competition levels.</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: "/web", params: { path: "/womens" } })}
          style={styles.womensLink}
        >
          <Text style={styles.openProfile}>Browse women’s teams and leagues on HoopCheck ↗</Text>
        </Pressable>
        <View style={styles.searchRow}>
          <Input onBlur={() => remember(term)} onSubmitEditing={() => remember(term)} value={term} onChangeText={value => { requestId.current++; setTerm(value); setLoading(true); setItems([]); setHasMore(false); }} returnKeyType="search" placeholder="League, country or level" placeholderTextColor={theme.muted} style={styles.input} />
        </View>
        {!term ? <RecentSearches items={recents} onSelect={setTerm} /> : null}
        <Text style={styles.count}>{loading ? "Loading leagues…" : `${items.length}${hasMore ? "+" : ""} ${items.length === 1 && !hasMore ? "result" : "results"} shown`}</Text>
      </View>
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(appliedTerm)}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {loading && items.length === 0 ? <Skeleton /> : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} colors={[theme.accent]} progressBackgroundColor={theme.surface} />}
          renderItem={({ item, index }) => (
            <Reveal key={`${appliedTerm}:${item.id}`} index={index}>
            <Pressable onPress={() => router.push({ pathname: "/leagues/[id]", params: { id: item.id } })} style={styles.card}>
              <DirectoryCrest name={item.name} kind="leagues" />
              <View style={styles.cardBody}>
                <Text style={styles.leagueName}>{item.name}</Text>
                <CountryChip country={item.country} />
                <Text style={styles.meta}>{item.country || "Country not listed"}{item.level ? ` · ${item.level}` : ""}</Text>
                {item.season ? <Text style={styles.season}>Season: {item.season}</Text> : null}
                <Text style={styles.openProfile}>View profile →</Text>
              </View>
            </Pressable>
            </Reveal>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No leagues found</Text><Text style={styles.emptyText}>Try a shorter name or another country.</Text></View>}
          ListFooterComponent={hasMore ? <Button onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color={theme.onButton} /> : <Text style={styles.moreText}>Load more leagues</Text>}</Button> : <Text style={styles.footer}>Confirm league rules, payment terms and contract details independently before signing.</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) void nextPage(); }}
        />
      )}
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
  womensLink: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  input: { flex: 1, minWidth: 0, height: 48, backgroundColor: theme.input, borderRadius: theme.radius.control, paddingHorizontal: 12, color: theme.foreground, fontSize: 14 },
  searchButton: { backgroundColor: theme.surface, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 },
  searchButtonText: { color: theme.foreground, fontWeight: "900" },
  count: { color: theme.muted, fontSize: 12, marginTop: 12 },
  list: { padding: 16, paddingBottom: 30, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: theme.radius.card, padding: 14, borderWidth: 1, borderColor: theme.border, gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  logoText: { color: theme.foreground, fontSize: 19, fontWeight: "900" },
  cardBody: { flex: 1 },
  leagueName: { color: theme.foreground, fontSize: 15, fontWeight: "800" },
  meta: { color: theme.muted, fontSize: 12, marginTop: 4 },
  season: { color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 5 },
  openProfile: { color: theme.accent, fontSize: 12, fontWeight: "900", marginTop: 8 },
  loader: { marginTop: 45 },
  errorBox: { margin: 16, padding: 14, backgroundColor: theme.errorSurface, borderRadius: 10 },
  error: { color: theme.error }, retry: { color: theme.accent, fontWeight: "800", marginTop: 8 },
  empty: { padding: 30, alignItems: "center" }, emptyTitle: { color: theme.foreground, fontWeight: "900", fontSize: 17 }, emptyText: { color: theme.muted, textAlign: "center", marginTop: 7 },
  more: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: theme.button, borderRadius: theme.radius.control, marginTop: 4 },
  moreText: { color: theme.onButton, fontWeight: "800" },
  footer: { color: theme.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 8, paddingTop: 14, textAlign: "center" },
});
