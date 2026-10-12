import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";

type Coach = { id: string; name: string; country: string | null; city: string | null; website: string | null };
const PAGE_SIZE = 30;

export default function CoachesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Coach[]>([]);
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
    let query = supabase.from("coaches")
      .select("id,name,country,city,website")
      .eq("active", true)
      .order("name", { ascending: true })
      .range(start, start + PAGE_SIZE);
    if (clean) query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%,city.ilike.%${clean}%`);
    const { data, error: queryError } = await query;
    if (queryError) {
      setError("We couldn’t load coach records. Check your connection and try again.");
      if (!append) setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const rows = (data ?? []) as Coach[];
    setHasMore(rows.length > PAGE_SIZE);
    const page = rows.slice(0, PAGE_SIZE);
    setItems(append ? current => [...current, ...page] : page);
    setOffset(start);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load("", 0, false); }, [load]);
  function search() { setAppliedTerm(term.trim()); void load(term, 0, false); }
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
        <Text style={styles.kicker}>COACH DIRECTORY</Text>
        <Text style={styles.title}>Find a coach</Text>
        <Text style={styles.subtitle}>Search available coach records by name or location. Verify a coach’s current role and contract details independently.</Text>
        <View style={styles.searchRow}>
          <TextInput value={term} onChangeText={setTerm} onSubmitEditing={search} returnKeyType="search" placeholder="Coach name, country or city" placeholderTextColor="#7B8797" style={styles.input} />
          <Pressable onPress={search} style={styles.searchButton}><Text style={styles.searchButtonText}>Search</Text></Pressable>
        </View>
        <Text style={styles.count}>{loading ? "Loading coaches…" : `${items.length}${hasMore ? "+" : ""} results shown`}</Text>
      </View>
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(appliedTerm)}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {loading && items.length === 0 ? <ActivityIndicator style={styles.loader} size="large" color="#D69E18" /> : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.cardBody}>
                <Text style={styles.coachName}>{item.name}</Text>
                <Text style={styles.meta}>{[item.city, item.country].filter(Boolean).join(", ") || "Location not listed"}</Text>
                {item.website && /^https?:\/\//i.test(item.website) ? <Text style={styles.website}>{item.website}</Text> : null}
              </View>
            </View>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No coach records available yet</Text><Text style={styles.emptyText}>HoopCheck’s coach directory currently has no active records. No sample or invented coaches are shown. Check back as verified directory data is added.</Text></View>}
          ListFooterComponent={hasMore ? <Pressable onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color="#101827" /> : <Text style={styles.moreText}>Load more coaches</Text>}</Pressable> : <Text style={styles.footer}>Directory listings are not endorsements. Confirm current employment, references, and contract terms before making a decision.</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) void nextPage(); }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F6F9" },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: "#101827" },
  back: { color: "#F5B82E", fontSize: 15, fontWeight: "700", marginBottom: 18 },
  kicker: { color: "#F5B82E", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#FFFFFF", fontSize: 29, fontWeight: "900", marginTop: 5 },
  subtitle: { color: "#C7D0DE", fontSize: 14, lineHeight: 20, marginTop: 7 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  input: { flex: 1, minWidth: 0, height: 48, backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, color: "#101827", fontSize: 14 },
  searchButton: { backgroundColor: "#F5B82E", borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 },
  searchButtonText: { color: "#101827", fontWeight: "900" },
  count: { color: "#AAB5C5", fontSize: 12, marginTop: 12 },
  list: { padding: 16, paddingBottom: 30, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E3E8EF", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#FFF3CD", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#101827", fontSize: 19, fontWeight: "900" },
  cardBody: { flex: 1 },
  coachName: { color: "#101827", fontSize: 16, fontWeight: "900" },
  meta: { color: "#657287", fontSize: 13, marginTop: 4 },
  website: { color: "#946600", fontSize: 12, marginTop: 5 },
  empty: { alignItems: "center", padding: 26, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E3E8EF" },
  emptyTitle: { color: "#101827", fontSize: 17, fontWeight: "900", textAlign: "center" },
  emptyText: { color: "#657287", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 8 },
  loader: { marginTop: 36 },
  errorBox: { margin: 16, padding: 14, borderRadius: 10, backgroundColor: "#FEE2E2" },
  error: { color: "#991B1B" },
  retry: { color: "#991B1B", fontWeight: "800", marginTop: 8 },
  more: { padding: 15, borderRadius: 10, backgroundColor: "#F5B82E", alignItems: "center" },
  moreText: { color: "#101827", fontWeight: "900" },
  footer: { color: "#657287", fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 10, paddingTop: 10 },
});
