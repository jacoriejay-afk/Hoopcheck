import { DirectoryCrest, CountryChip } from "../components/DirectoryIdentity";
import { useEntryTheme, type EntryTheme } from "../src/theme";
import { Input, Button } from "../src/primitives";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";

type Team = { id: string; name: string; country: string | null; city: string | null; league_name: string | null; website: string | null };
const PAGE_SIZE = 40;

export default function TeamsScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const requestId = useRef(0);
  const router = useRouter();
  const [items, setItems] = useState<Team[]>([]);
  const [term, setTerm] = useState("");
  const [appliedTerm, setAppliedTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (search: string, start = 0, append = false) => {
    const request = ++requestId.current;
    if (start === 0) setLoading(true);
    setError("");
    const clean = search.trim().replace(/[^\p{L}\p{N} '\-]/gu, " ").replace(/\s+/g, " ").trim();
    let query = supabase.from("teams").select("id,name,country,city,league_name,website").eq("active", true).eq("basketball_type", "mens").order("name", { ascending: true }).range(start, start + PAGE_SIZE);
    if (clean) query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%,city.ilike.%${clean}%,league_name.ilike.%${clean}%`);
    const { data, error: queryError } = await query;
    if (request !== requestId.current) return;
    if (queryError) {
      setError("We couldn’t load teams. Check your connection and try again.");
      if (!append) setItems([]);
      setLoading(false); setRefreshing(false); return;
    }
    const rows = (data ?? []) as Team[];
    setHasMore(rows.length > PAGE_SIZE);
    const page = rows.slice(0, PAGE_SIZE);
    setItems(append ? current => [...current, ...page] : page);
    setOffset(start);
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedTerm(term.trim());
      void load(term, 0, false);
    }, 300);
    return () => { clearTimeout(timer); requestId.current++; };
  }, [term, load]);


  async function nextPage() {
    if (loading || !hasMore) return;
    setLoading(true);
    await load(appliedTerm, offset + PAGE_SIZE, true);
  }

  const refresh = () => { setRefreshing(true); void load(appliedTerm, 0, false); };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>DIRECTORY</Text>
        <Text style={styles.title}>Find a team</Text>
        <Text style={styles.subtitle}>Explore men’s professional basketball teams before you sign.</Text>
        <View style={styles.searchRow}>
          <Input value={term} onChangeText={value => { requestId.current++; setTerm(value); setLoading(true); setItems([]); setHasMore(false); }} returnKeyType="search" placeholder="Team, country, city or league" placeholderTextColor={theme.muted} style={styles.input} />
        </View>
        <Text style={styles.count}>{loading ? "Loading teams…" : `${items.length}${hasMore ? "+" : ""} results shown`}</Text>
      </View>
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(appliedTerm)}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {loading && items.length === 0 ? <ActivityIndicator style={styles.loader} size="large" color={theme.accent} /> : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} colors={[theme.accent]} progressBackgroundColor={theme.surface} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: "/teams/[id]", params: { id: item.id } })} style={styles.card}>
              <DirectoryCrest name={item.name} kind="teams" />
              <View style={styles.cardBody}>
                <Text style={styles.teamName}>{item.name}</Text>
                <CountryChip country={item.country} />
                <Text style={styles.meta}>{[item.city, item.country].filter(Boolean).join(", ") || "Location not listed"}</Text>
                {item.league_name ? <Text style={styles.league}>{item.league_name}</Text> : null}
                <Text style={styles.openProfile}>View profile →</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No teams found</Text><Text style={styles.emptyText}>Try a shorter name or another country.</Text></View>}
          ListFooterComponent={hasMore ? <Button onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color={theme.onButton} /> : <Text style={styles.moreText}>Load more teams</Text>}</Button> : <Text style={styles.footer}>Team data can change. Confirm contract details directly before signing.</Text>}
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
