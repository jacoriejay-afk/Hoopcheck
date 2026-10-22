import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";

type Team = { id: string; name: string; country: string | null; city: string | null; league_name: string | null; website: string | null };
const PAGE_SIZE = 40;

export default function TeamsScreen() {
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
    if (start === 0) setLoading(true);
    setError("");
    const clean = search.trim().replace(/[^\p{L}\p{N} '\-]/gu, " ").replace(/\s+/g, " ").trim();
    let query = supabase.from("teams").select("id,name,country,city,league_name,website").eq("active", true).eq("basketball_type", "mens").order("name", { ascending: true }).range(start, start + PAGE_SIZE);
    if (clean) query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%,city.ilike.%${clean}%,league_name.ilike.%${clean}%`);
    const { data, error: queryError } = await query;
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

  useEffect(() => { void load("", 0, false); }, [load]);

  function search() {
    setAppliedTerm(term.trim());
    void load(term, 0, false);
  }

  async function nextPage() {
    if (loading || !hasMore) return;
    setLoading(true);
    await load(appliedTerm, offset + PAGE_SIZE, true);
  }

  const refresh = () => { setRefreshing(true); void load(appliedTerm, 0, false); };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>DIRECTORY</Text>
        <Text style={styles.title}>Find a team</Text>
        <Text style={styles.subtitle}>Explore men’s professional basketball teams before you sign.</Text>
        <View style={styles.searchRow}>
          <TextInput value={term} onChangeText={setTerm} onSubmitEditing={search} returnKeyType="search" placeholder="Team, country, city or league" placeholderTextColor="#858585" style={styles.input} />
          <Pressable onPress={search} style={styles.searchButton}><Text style={styles.searchButtonText}>Search</Text></Pressable>
        </View>
        <Text style={styles.count}>{loading ? "Loading teams…" : `${items.length}${hasMore ? "+" : ""} results shown`}</Text>
      </View>
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(appliedTerm)}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {loading && items.length === 0 ? <ActivityIndicator style={styles.loader} size="large" color="#D69E18" /> : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: "/teams/[id]", params: { id: item.id } })} style={styles.card}>
              <View style={styles.logo}><Text style={styles.logoText}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.cardBody}>
                <Text style={styles.teamName}>{item.name}</Text>
                <Text style={styles.meta}>{[item.city, item.country].filter(Boolean).join(", ") || "Location not listed"}</Text>
                {item.league_name ? <Text style={styles.league}>{item.league_name}</Text> : null}
                <Text style={styles.openProfile}>View profile →</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No teams found</Text><Text style={styles.emptyText}>Try a shorter name or another country.</Text></View>}
          ListFooterComponent={hasMore ? <Pressable onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color="#101827" /> : <Text style={styles.moreText}>Load more teams</Text>}</Pressable> : <Text style={styles.footer}>Team data can change. Confirm contract details directly before signing.</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) void nextPage(); }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050505" },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: "#050505" },
  back: { color: "#FF6A00", fontSize: 15, fontWeight: "700", marginBottom: 18 },
  kicker: { color: "#FF6A00", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#FFFFFF", fontSize: 29, fontWeight: "900", marginTop: 5 },
  subtitle: { color: "#C7D0DE", fontSize: 14, lineHeight: 20, marginTop: 7 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  input: { flex: 1, minWidth: 0, height: 48, backgroundColor: "#111111", borderRadius: 10, paddingHorizontal: 12, color: "#FFFFFF", fontSize: 14 },
  searchButton: { backgroundColor: "#FF6A00", borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 },
  searchButtonText: { color: "#FFFFFF", fontWeight: "900" },
  count: { color: "#AAB5C5", fontSize: 12, marginTop: 12 },
  list: { padding: 16, paddingBottom: 30, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#111111", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#303030", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#1B120A", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  cardBody: { flex: 1 },
  teamName: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  meta: { color: "#59677A", fontSize: 12, marginTop: 4 },
  league: { color: "#A16E00", fontSize: 12, fontWeight: "700", marginTop: 5 },
  openProfile: { color: "#FF6A00", fontSize: 12, fontWeight: "900", marginTop: 8 },
  loader: { marginTop: 45 },
  errorBox: { margin: 16, padding: 14, backgroundColor: "#FDECEC", borderRadius: 10 },
  error: { color: "#8C2525" }, retry: { color: "#8C2525", fontWeight: "800", marginTop: 8 },
  empty: { padding: 30, alignItems: "center" }, emptyTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 17 }, emptyText: { color: "#969696", textAlign: "center", marginTop: 7 },
  more: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: "#E8EDF3", borderRadius: 10, marginTop: 4 },
  moreText: { color: "#FFFFFF", fontWeight: "800" },
  footer: { color: "#6B7788", fontSize: 12, lineHeight: 18, paddingHorizontal: 8, paddingTop: 14, textAlign: "center" },
});
