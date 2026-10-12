import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";

type Player = { id: string; display_name: string | null; username: string | null; country: string | null; current_country: string | null; current_team: string | null; position: string | null; years_pro: number | null; free_agent: boolean };
const PAGE_SIZE = 30;

export default function PlayersScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Player[]>([]);
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
    let query = supabase.from("profiles")
      .select("id,display_name,username,country,current_country,current_team,position,years_pro,free_agent")
      .eq("account_type", "player")
      .eq("profile_visibility", "public")
      .eq("moderation_status", "normal")
      .eq("basketball_type", "mens")
      .eq("professional_experience", true)
      .order("display_name", { ascending: true })
      .range(start, start + PAGE_SIZE);
    if (clean) query = query.or(`display_name.ilike.%${clean}%,username.ilike.%${clean}%,country.ilike.%${clean}%,current_country.ilike.%${clean}%,current_team.ilike.%${clean}%`);
    const { data, error: queryError } = await query;
    if (queryError) {
      setError("We couldn’t load player profiles. Check your connection and try again.");
      if (!append) setItems([]);
      setLoading(false); setRefreshing(false); return;
    }
    const rows = (data ?? []) as Player[];
    setHasMore(rows.length > PAGE_SIZE);
    const page = rows.slice(0, PAGE_SIZE);
    setItems(append ? current => [...current, ...page] : page);
    setOffset(start);
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { void load("", 0, false); }, [load]);
  function search() { setAppliedTerm(term.trim()); void load(term, 0, false); }
  async function nextPage() { if (loading || !hasMore) return; setLoading(true); await load(appliedTerm, offset + PAGE_SIZE, true); }
  const refresh = () => { setRefreshing(true); void load(appliedTerm, 0, false); };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>PLAYER DIRECTORY</Text>
        <Text style={styles.title}>Find players</Text>
        <Text style={styles.subtitle}>Explore public profiles of professional men’s basketball players.</Text>
        <View style={styles.searchRow}>
          <TextInput value={term} onChangeText={setTerm} onSubmitEditing={search} returnKeyType="search" placeholder="Name, team or country" placeholderTextColor="#7B8797" style={styles.input} />
          <Pressable onPress={search} style={styles.searchButton}><Text style={styles.searchButtonText}>Search</Text></Pressable>
        </View>
        <Text style={styles.count}>{loading ? "Loading players…" : `${items.length}${hasMore ? "+" : ""} results shown`}</Text>
      </View>
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(appliedTerm)}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {loading && items.length === 0 ? <ActivityIndicator style={styles.loader} size="large" color="#D69E18" /> : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/players/${item.id}`)} style={styles.card}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(item.display_name || item.username || "P").slice(0,1).toUpperCase()}</Text></View>
              <View style={styles.cardBody}>
                <Text style={styles.playerName}>{item.display_name || (item.username ? `@${item.username}` : "Player profile")}</Text>
                {item.display_name && item.username ? <Text style={styles.handle}>@{item.username}</Text> : null}
                <Text style={styles.meta}>{[item.current_team, item.current_country || item.country].filter(Boolean).join(" · ") || "Team and location not listed"}</Text>
                <Text style={styles.detail}>{[item.position, item.years_pro === null ? null : `${item.years_pro} pro ${item.years_pro === 1 ? "year" : "years"}`].filter(Boolean).join(" · ") || "Professional experience"}</Text>
                {item.free_agent ? <Text style={styles.freeAgent}>Free agent</Text> : null}
              </View>
              <Text style={styles.openArrow}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No public player profiles found</Text><Text style={styles.emptyText}>Profiles appear here only when they are public, marked as professional, and visible under current privacy and moderation settings.</Text></View>}
          ListFooterComponent={hasMore ? <Pressable onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color="#101827" /> : <Text style={styles.moreText}>Load more players</Text>}</Pressable> : <Text style={styles.footer}>Only public, non-suspended men’s professional profiles are shown. Profile details depend on each player’s settings.</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) void nextPage(); }}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F4F6F9"},header:{paddingHorizontal:20,paddingTop:12,paddingBottom:12,backgroundColor:"#101827"},back:{color:"#F5B82E",fontSize:15,fontWeight:"700",marginBottom:18},kicker:{color:"#F5B82E",fontSize:11,fontWeight:"900",letterSpacing:1.5},title:{color:"#FFFFFF",fontSize:29,fontWeight:"900",marginTop:5},subtitle:{color:"#C7D0DE",fontSize:14,lineHeight:20,marginTop:7},searchRow:{flexDirection:"row",gap:8,marginTop:18},input:{flex:1,minWidth:0,height:48,backgroundColor:"#FFFFFF",borderRadius:10,paddingHorizontal:12,color:"#101827",fontSize:14},searchButton:{backgroundColor:"#F5B82E",borderRadius:10,alignItems:"center",justifyContent:"center",paddingHorizontal:15},searchButtonText:{color:"#101827",fontWeight:"900"},count:{color:"#AAB5C5",fontSize:12,marginTop:12},list:{padding:16,paddingBottom:30,gap:10},card:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF",borderRadius:12,padding:14,borderWidth:1,borderColor:"#E3E8EF",gap:12},avatar:{width:44,height:44,borderRadius:22,backgroundColor:"#FFF3CD",alignItems:"center",justifyContent:"center"},avatarText:{color:"#101827",fontSize:19,fontWeight:"900"},cardBody:{flex:1},playerName:{color:"#101827",fontSize:15,fontWeight:"800"},handle:{color:"#657287",fontSize:12,marginTop:3},meta:{color:"#59677A",fontSize:12,marginTop:5},detail:{color:"#657287",fontSize:12,marginTop:5},freeAgent:{color:"#176B46",fontSize:12,fontWeight:"900",marginTop:6},openArrow:{fontSize:24,color:"#946600",fontWeight:"800"},loader:{marginTop:45},errorBox:{margin:16,padding:14,backgroundColor:"#FDECEC",borderRadius:10},error:{color:"#8C2525"},retry:{color:"#8C2525",fontWeight:"800",marginTop:8},empty:{padding:30,alignItems:"center"},emptyTitle:{color:"#101827",fontWeight:"900",fontSize:17},emptyText:{color:"#657287",textAlign:"center",marginTop:7,lineHeight:20},more:{minHeight:46,alignItems:"center",justifyContent:"center",backgroundColor:"#E8EDF3",borderRadius:10,marginTop:4},moreText:{color:"#101827",fontWeight:"800"},footer:{color:"#6B7788",fontSize:12,lineHeight:18,paddingHorizontal:8,paddingTop:14,textAlign:"center"}
});
