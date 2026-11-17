import { useCachedRead, useNetwork } from "../src/native/network";
import { OfflineBanner } from "../components/OfflineBanner";
import { Reveal, Skeleton } from "../components/Motion";
import { RecentSearches, useRecentSearches } from "../components/RecentSearches";
import { motion } from "../src/motion/config";
import { useEntryTheme } from "../src/theme";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
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
    <SafeAreaView style={styles.safe}>
      <OfflineBanner savedAt={savedAt} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>DIRECTORY</Text>
        <Text style={styles.title}>Find a league</Text>
        <Text style={styles.subtitle}>Explore men’s professional basketball leagues and competition levels.</Text>
        <View style={styles.searchRow}>
          <TextInput value={term} onChangeText={value => { requestId.current += 1; setTerm(value); setLoading(true); }} onSubmitEditing={() => remember(term)} onBlur={() => remember(term)} returnKeyType="search" placeholder="League, country or level" placeholderTextColor={theme.muted} style={styles.input} />
        </View>
        {!term ? <RecentSearches items={recents} onSelect={setTerm} /> : null}
        <Text style={styles.count}>{loading ? "Loading leagues…" : `${items.length}${hasMore ? "+" : ""} ${items.length === 1 && !hasMore ? "result" : "results"} shown`}</Text>
      </View>
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(appliedTerm)}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {loading && items.length === 0 ? <Skeleton /> : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item, index }) => (
            <Reveal key={`${appliedTerm}:${item.id}`} index={index}>
            <Pressable onPress={() => router.push({ pathname: "/leagues/[id]", params: { id: item.id } })} style={styles.card}>
              <View style={styles.logo}><Text style={styles.logoText}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.cardBody}>
                <Text style={styles.leagueName}>{item.name}</Text>
                <Text style={styles.meta}>{item.country || "Country not listed"}{item.level ? ` · ${item.level}` : ""}</Text>
                {item.season ? <Text style={styles.season}>Season: {item.season}</Text> : null}
                <Text style={styles.openProfile}>View profile →</Text>
              </View>
            </Pressable>
            </Reveal>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No leagues found</Text><Text style={styles.emptyText}>Try a shorter name or another country.</Text></View>}
          ListFooterComponent={hasMore ? <Pressable onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color="#101827" /> : <Text style={styles.moreText}>Load more leagues</Text>}</Pressable> : <Text style={styles.footer}>Confirm league rules, payment terms and contract details independently before signing.</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) void nextPage(); }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useEntryTheme>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: theme.background },
  back: { color: theme.accent, fontSize: 15, fontWeight: "700", marginBottom: 18 },
  kicker: { color: theme.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: theme.foreground, fontSize: 29, fontWeight: "900", marginTop: 5 },
  subtitle: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  input: { flex: 1, minWidth: 0, height: 48, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 12, color: theme.foreground, fontSize: 14 },
  searchButton: { backgroundColor: theme.accent, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 },
  searchButtonText: { color: theme.foreground, fontWeight: "900" },
  count: { color: theme.muted, fontSize: 12, marginTop: 12 },
  list: { padding: 16, paddingBottom: 30, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.border, gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.accentSurface, alignItems: "center", justifyContent: "center" },
  logoText: { color: theme.foreground, fontSize: 19, fontWeight: "900" },
  cardBody: { flex: 1 },
  leagueName: { color: theme.foreground, fontSize: 15, fontWeight: "800" },
  meta: { color: theme.muted, fontSize: 12, marginTop: 4 },
  season: { color: theme.accent, fontSize: 12, fontWeight: "700", marginTop: 5 },
  openProfile: { color: theme.accent, fontSize: 12, fontWeight: "900", marginTop: 8 },
  loader: { marginTop: 45 },
  errorBox: { margin: 16, padding: 14, backgroundColor: theme.errorSurface, borderRadius: 10 },
  error: { color: theme.error }, retry: { color: theme.error, fontWeight: "800", marginTop: 8 },
  empty: { padding: 30, alignItems: "center" }, emptyTitle: { color: theme.foreground, fontWeight: "900", fontSize: 17 }, emptyText: { color: theme.muted, textAlign: "center", marginTop: 7 },
  more: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderRadius: 10, marginTop: 4 },
  moreText: { color: theme.foreground, fontWeight: "800" },
  footer: { color: theme.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 8, paddingTop: 14, textAlign: "center" },
});
