import { Input, GlassCard, Button } from "../src/primitives";
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

type Coach = { id: string; name: string; country: string | null; city: string | null; website: string | null };
const PAGE_SIZE = 30;

export default function CoachesScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { read, savedAt } = useCachedRead();
  const { revision } = useNetwork();
  const { recents, remember } = useRecentSearches("coaches");
  const requestId = useRef(0);
  const [items, setItems] = useState<Coach[]>([]);
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
    let query = supabase.from("coaches")
      .select("id,name,country,city,website")
      .eq("active", true)
      .order("name", { ascending: true }).order("id", { ascending: true })
      .range(start, start + PAGE_SIZE);
    if (clean) query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%,city.ilike.%${clean}%`);
    const { data, error: queryError } = await read(`coaches:${clean}:${start}`, () => query);
    if (currentRequest !== requestId.current) return;
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
  }, [read]);


  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedTerm(term.trim());
      void load(term, 0, false);
    }, motion.searchDelay);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [term, revision, load]);

  async function nextPage() {
    if (loading || !hasMore) return;
    setLoading(true);
    await load(appliedTerm, offset + PAGE_SIZE, true);
  }
  const refresh = () => { setRefreshing(true); void load(appliedTerm, 0, false); };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <OfflineBanner savedAt={savedAt} />
      <View style={styles.header}>
        <Text style={styles.kicker}>COACH DIRECTORY</Text>
        <Text style={styles.title}>Find a coach</Text>
        <Text style={styles.subtitle}>Search available coach records by name or location. Verify a coach’s current role and contract details independently.</Text>
        <View style={styles.searchRow}>
          <Input onBlur={() => remember(term)} onSubmitEditing={() => remember(term)} value={term} onChangeText={value => { requestId.current++; setTerm(value); setLoading(true); setItems([]); setHasMore(false); }} returnKeyType="search" placeholder="Coach name, country or city" placeholderTextColor={theme.muted} style={styles.input} />
        </View>
        {!term ? <RecentSearches items={recents} onSelect={setTerm} /> : null}
        <Text style={styles.count}>{loading ? "Loading coaches…" : `${items.length}${hasMore ? "+" : ""} ${items.length === 1 && !hasMore ? "result" : "results"} shown`}</Text>
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
            <Pressable accessibilityRole="link" accessibilityLabel={`View ${item.name}`} onPress={()=>router.push({pathname:"/coaches/[id]",params:{id:item.id}})}><GlassCard style={styles.card}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.cardBody}>
                <Text style={styles.coachName}>{item.name}</Text>
                <Text style={styles.meta}>{[item.city, item.country].filter(Boolean).join(", ") || "Location not listed"}</Text>
                {item.website && /^https?:\/\//i.test(item.website) ? <Text style={styles.website}>{item.website}</Text> : null}
              </View>
            </GlassCard></Pressable>
            </Reveal>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{error?"Coach directory unavailable":appliedTerm?"No matching coaches":"No coach records available yet"}</Text><Text style={styles.emptyText}>{error?"Retry when you are connected.":appliedTerm?"Try another name or location.":"No sample or invented coaches are shown."}</Text></View>}
          ListFooterComponent={hasMore ? <Button onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color={theme.onButton} /> : <Text style={styles.moreText}>Load more coaches</Text>}</Button> : <Text style={styles.footer}>Directory listings are not endorsements. Confirm current employment, references, and contract terms before making a decision.</Text>}
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
  list: { padding: 10, paddingBottom: 100, gap: 2 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "transparent", borderRadius: 0, padding: 9, borderBottomWidth: 1, borderColor: theme.border, gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.chip, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.onChip, fontSize: 19, fontWeight: "900" },
  cardBody: { flex: 1 },
  coachName: { color: theme.foreground, fontSize: 16, fontWeight: "900" },
  meta: { color: theme.muted, fontSize: 13, marginTop: 4 },
  website: { color: theme.accent, fontSize: 12, marginTop: 5 },
  empty: { alignItems: "center", padding: 26, backgroundColor: theme.surface, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.border },
  emptyTitle: { color: theme.foreground, fontSize: 17, fontWeight: "900", textAlign: "center" },
  emptyText: { color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 8 },
  loader: { marginTop: 36 },
  errorBox: { margin: 16, padding: 14, borderRadius: 10, backgroundColor: theme.errorSurface },
  error: { color: theme.error },
  retry: { color: theme.accent, fontWeight: "800", marginTop: 8 },
  more: { padding: 15, borderRadius: theme.radius.control, backgroundColor: theme.button, alignItems: "center" },
  moreText: { color: theme.onButton, fontWeight: "900" },
  footer: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 10, paddingTop: 10 },
});
