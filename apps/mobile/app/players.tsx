import { ProfileAvatar } from "../components/ProfileAvatar";
import { readPlayerDirectory, type PlayerCard } from "../src/native/playerDirectory";
import { PlayerAccess } from "../components/PlayerAccess";
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


const PAGE_SIZE = 30;

export default function PlayersScreen() { return <PlayerAccess>{() => <PlayerDirectory />}</PlayerAccess>; }

function PlayerDirectory() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { read, savedAt } = useCachedRead();
  const { revision } = useNetwork();
  const { recents, remember } = useRecentSearches("players");
  const [items, setItems] = useState<PlayerCard[]>([]);
  const [term, setTerm] = useState("");
  const [appliedTerm, setAppliedTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (search: string, start = 0, append = false) => {
    const currentRequest = ++requestId.current;
    if (start === 0) setLoading(true);
    setError("");
    const clean = search.trim().replace(/^@+/, "").replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase();
    if (clean.length < 2) {
      setItems([]);
      setHasMore(false);
      setOffset(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data, error: queryError } = await read(`players:privacy-v2:${clean}:${start}`, () => readPlayerDirectory(supabase, clean, start, PAGE_SIZE));
    if (currentRequest !== requestId.current) return;
    if (queryError) {
      setError("We couldn’t load player profiles. Check your connection and try again.");
      if (!append) setItems([]);
      setLoading(false); setRefreshing(false); return;
    }
    const rows = (data ?? []) as PlayerCard[];
    setHasMore(rows.length > PAGE_SIZE);
    const page = rows.slice(0, PAGE_SIZE);
    setItems(append ? current => [...current, ...page] : page);
    setOffset(start);
    setLoading(false); setRefreshing(false);
  }, [read]);

  function updateTerm(value: string) {
    setTerm(value); setLoading(true);
    const normalized = value.trim().replace(/^@+/, "").toLowerCase();
    if (normalized !== appliedTerm.toLowerCase()) {
      requestId.current += 1;
      setAppliedTerm("");
      setItems([]);
      setHasMore(false);
      setOffset(0);
      setLoading(false);
      setRefreshing(false);
      setError("");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedTerm(term.trim());
      void load(term, 0, false);
    }, motion.searchDelay);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [term, revision, load]);

  async function nextPage() { if (loading || !hasMore || !appliedTerm) return; setLoading(true); await load(appliedTerm, offset + PAGE_SIZE, true); }
  const refresh = () => { if (!appliedTerm) return; setRefreshing(true); void load(appliedTerm, 0, false); };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <OfflineBanner savedAt={savedAt} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>PLAYER DIRECTORY</Text>
        <Text style={styles.title}>Find players</Text>
        <Text style={styles.subtitle}>Explore public profiles of professional basketball players.</Text>
        <View style={styles.searchRow}>
          <Input onBlur={() => remember(term)} onSubmitEditing={() => remember(term)} value={term} onChangeText={updateTerm} returnKeyType="search" placeholder="Enter a username (e.g. @player)" placeholderTextColor={theme.muted} style={styles.input} />
        </View>
        {!term ? <RecentSearches items={recents} onSelect={setTerm} /> : null}
        <Text style={styles.count}>{!appliedTerm ? "Search by username to view profiles" : loading ? "Searching usernames…" : items.length + (hasMore ? "+" : "") + " results shown"}</Text>
      </View>
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(appliedTerm)}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {!appliedTerm ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Search by username</Text>
          <Text style={styles.emptyText}>Player profiles stay hidden until you enter a username. Search requires at least two characters.</Text>
        </View>
      ) : loading && items.length === 0 ? <Skeleton /> : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} colors={[theme.accent]} progressBackgroundColor={theme.surface} />}
          renderItem={({ item, index }) => (
            <Reveal key={`${appliedTerm}:${item.id}`} index={index}>
            <Pressable onPress={() => router.push(`/players/${item.id}`)} style={styles.card}>
              <ProfileAvatar url={item.avatar_url} name={item.display_name || item.username || "Player"} size={44} />
              <View style={styles.cardBody}>
                <Text style={styles.playerName}>{item.display_name || (item.username ? `@${item.username}` : "Player profile")}</Text>
                {item.display_name && item.username ? <Text style={styles.handle}>@{item.username}</Text> : null}
                <Text style={styles.meta}>{[item.current_team, item.current_country || item.country].filter(Boolean).join(" · ") || "Team and location not listed"}</Text>
                <Text style={styles.detail}>{[item.position, item.years_pro === null ? null : `${item.years_pro} pro ${item.years_pro === 1 ? "year" : "years"}`].filter(Boolean).join(" · ") || "Professional experience"}</Text>
                {item.free_agent ? <Text style={styles.freeAgent}>Free agent</Text> : null}
              </View>
              <Text style={styles.openArrow}>›</Text>
            </Pressable>
            </Reveal>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No public player profiles found</Text><Text style={styles.emptyText}>Profiles appear here only when they are public, marked as professional, and visible under current privacy and moderation settings.</Text></View>}
          ListFooterComponent={hasMore ? <Button onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color={theme.onButton} /> : <Text style={styles.moreText}>Load more players</Text>}</Button> : <Text style={styles.footer}>Only public, non-suspended professional player profiles are shown. Profile details depend on each player’s settings.</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) void nextPage(); }}
        />
      )}
    </SafeAreaView>
  );
}
const createStyles = (theme: EntryTheme) => StyleSheet.create({
  safe: {flex:1,backgroundColor: theme.background},header: {paddingHorizontal:20,paddingTop:12,paddingBottom:12,backgroundColor: theme.background},back: {color: theme.accent,fontSize:15,fontWeight:"700",marginBottom:18},kicker: {color: theme.accent,fontSize:11,fontWeight:"900",letterSpacing:1.5},title: {color: theme.foreground,fontSize:28,fontWeight: "400", fontFamily: "HoopCheckDisplay",marginTop:5},subtitle: {color: theme.muted,fontSize:14,lineHeight:20,marginTop:7},searchRow: {flexDirection:"row",gap:8,marginTop:18},input: {flex:1,minWidth:0,height:48,backgroundColor: theme.input,borderRadius: theme.radius.control,paddingHorizontal:12,color: theme.foreground,fontSize:14},searchButton: {backgroundColor: theme.surface,borderRadius:10,alignItems:"center",justifyContent:"center",paddingHorizontal:15},searchButtonText: {color: theme.foreground,fontWeight:"900"},count: {color: theme.muted,fontSize:12,marginTop:12},list: {padding:10,paddingBottom:100,gap:2},card: {flexDirection:"row",alignItems:"center",backgroundColor: "transparent",borderRadius:0,padding:9,borderBottomWidth:1,borderColor: theme.border,gap:10},avatar: {width:44,height:44,borderRadius:22,backgroundColor: theme.chip,alignItems:"center",justifyContent:"center"},avatarText: {color: theme.onChip,fontSize:19,fontWeight:"900"},cardBody: {flex:1},playerName: {color: theme.foreground,fontSize:15,fontWeight:"800"},handle: {color: theme.muted,fontSize:12,marginTop:3},meta: {color: theme.muted,fontSize:12,marginTop:5},detail: {color: theme.muted,fontSize:12,marginTop:5},freeAgent: {color: theme.foreground,fontSize:12,fontWeight:"900",marginTop:6},openArrow: {fontSize:24,color: theme.accent,fontWeight:"800"},loader: {marginTop:45},errorBox: {margin:16,padding:14,backgroundColor: theme.errorSurface,borderRadius:10},error: {color: theme.error},retry: {color: theme.accent,fontWeight:"800",marginTop:8},empty: {padding:30,alignItems:"center"},emptyTitle: {color: theme.foreground,fontWeight:"900",fontSize:17},emptyText: {color: theme.muted,textAlign:"center",marginTop:7,lineHeight:20},more: {minHeight:46,alignItems:"center",justifyContent:"center",backgroundColor: theme.button,borderRadius: theme.radius.control,marginTop:4},moreText: {color: theme.onButton,fontWeight:"800"},footer: {color: theme.muted,fontSize:12,lineHeight:18,paddingHorizontal:8,paddingTop:14,textAlign:"center"}
});
