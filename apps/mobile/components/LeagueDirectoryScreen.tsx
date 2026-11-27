import { publicDirectoryShare } from "../src/native/directoryQuickActions";
import { Sheet } from "./Sheet";
import { DirectoryCrest, CountryChip } from "./DirectoryIdentity";
import { Input, Button } from "../src/primitives";
import { useCachedRead, useNetwork } from "../src/native/network";
import { OfflineBanner } from "./OfflineBanner";
import { Reveal, Skeleton } from "./Motion";
import { RecentSearches, useRecentSearches } from "./RecentSearches";
import { motion } from "../src/motion/config";
import { useEntryTheme, type EntryTheme } from "../src/theme";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { cleanTeamSearch, mergeTeamDirectoryRows, TEAM_PAGE_SIZE } from "../src/native/teamDirectory";
import { leagueDirectoryQuery, leagueDirectoryScope, readLeagueCountries } from "../src/native/leagueDirectory";

type League = { id: string; name: string; country: string | null; level: string | null; season?: string | null; logo_url?: string | null };
const PAGE_SIZE = TEAM_PAGE_SIZE;

export function LeagueDirectoryScreen({ women = false }: { women?: boolean }) {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { read, savedAt } = useCachedRead();
  const { revision } = useNetwork();
  const profileRoute = women ? "/womens/leagues/[id]" : "/leagues/[id]";
  const { recents, remember } = useRecentSearches(women ? "womens-leagues" : "leagues");
  const requestId = useRef(0);
  const [preview, setPreview] = useState<League | null>(null);
  const loadingRequest = useRef<number | null>(null);
  const appliedScope = useRef<string | null>(null);
  const pageOffset = useRef(0);
  const [items, setItems] = useState<League[]>([]);
  const [term, setTerm] = useState("");
  const [appliedTerm, setAppliedTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [country, setCountry] = useState("");
  const [countryOpen,setCountryOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (search: string, start = 0, append = false) => {
    const currentRequest = ++requestId.current;
    loadingRequest.current=currentRequest;
    setLoading(true);
    setError("");
    const clean = cleanTeamSearch(search);
    const scope = leagueDirectoryScope(women, clean, country);
    const {data,error:queryError}=await Promise.resolve().then(()=>read(`leagues:${scope}:${start}`,()=>leagueDirectoryQuery(supabase,clean,start,country,women))).catch(()=>({data:null,error:true}));
    if (currentRequest !== requestId.current) return;
    loadingRequest.current=null;
    if (queryError) {
      setError("We couldn’t load leagues. Check your connection and try again.");
      setLoading(false); setRefreshing(false); return;
    }
    const rows = (data ?? []) as League[];
    setHasMore(rows.length > PAGE_SIZE);
    const page = rows.slice(0, PAGE_SIZE);
    setItems(current=>mergeTeamDirectoryRows(append?current:[],page));
    pageOffset.current=start;appliedScope.current=scope;
    setLoading(false); setRefreshing(false);
  }, [read,country,women]);


  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedTerm(term.trim());
      void load(term, 0, false);
    }, motion.searchDelay);
    return () => { clearTimeout(timer); requestId.current += 1; loadingRequest.current=null; appliedScope.current=null; };
  }, [term, revision, load]);

  async function nextPage() { if (loadingRequest.current!==null || loading || refreshing || !hasMore || cleanTeamSearch(term)!==cleanTeamSearch(appliedTerm) || appliedScope.current!==leagueDirectoryScope(women,appliedTerm,country)) return; await load(appliedTerm,pageOffset.current+PAGE_SIZE,true); }
  const refresh=()=>{if(loadingRequest.current!==null||cleanTeamSearch(term)!==cleanTeamSearch(appliedTerm))return;setRefreshing(true);void load(appliedTerm,0,false);};
  function invalidate(){requestId.current++;loadingRequest.current=null;appliedScope.current=null;pageOffset.current=0;setLoading(true);setRefreshing(false);setItems([]);setHasMore(false);setError("");}
  function updateTerm(value:string){if(value===term)return;invalidate();setTerm(value);}
  function updateCountry(value:string){setCountryOpen(false);if(value===country)return;invalidate();setCountry(value);}

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <OfflineBanner savedAt={savedAt} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.kicker}>DIRECTORY</Text>
        <Text style={styles.title}>{women ? "Women’s leagues" : "Find a league"}</Text>
        <Text style={styles.subtitle}>{women ? "Explore women’s basketball leagues and competition levels." : "Explore men’s professional basketball leagues and competition levels."}</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate(women ? "/leagues" : "/womens/leagues")}
          style={styles.womensLink}
        >
          <Text style={styles.openProfile}>{women ? "Browse men’s leagues →" : "Browse women’s leagues →"}</Text>
        </Pressable>
        <View style={styles.searchRow}>
          <Input onBlur={() => remember(term)} onSubmitEditing={() => remember(term)} value={term} onChangeText={updateTerm} returnKeyType="search" placeholder="League, country or level" placeholderTextColor={theme.muted} style={styles.input} />
        </View>
        <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Pressable accessibilityRole="button" accessibilityLabel="Filter leagues by country" onPress={()=>setCountryOpen(true)} style={{flex:1,minHeight:44,justifyContent:"center"}}><Text style={{color:theme.accent,fontWeight:"700"}}>{country||"All countries"} ▾</Text></Pressable>{country?<Button secondary onPress={()=>updateCountry("")}>Clear</Button>:null}</View>
        {!term ? <RecentSearches items={recents} onSelect={updateTerm} /> : null}
        <Text style={styles.count}>{loading ? "Loading leagues…" : error && !items.length ? "League results unavailable" : `${items.length}${hasMore ? "+" : ""} ${items.length === 1 && !hasMore ? "result" : "results"} shown`}</Text>
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
            <Pressable accessibilityRole="link" accessibilityHint="Hold or use actions to preview and share this league" accessibilityActions={[{name:"leagueActions",label:"League actions"}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==="leagueActions")setPreview(item);}} onLongPress={()=>setPreview(item)} onPress={() => router.push({ pathname: profileRoute, params: { id: item.id } })} style={styles.card}>
              <DirectoryCrest name={item.name} kind="leagues" logoUrl={item.logo_url} />
              <View style={styles.cardBody}>
                <Text style={styles.leagueName}>{item.name}</Text>
                {!item.logo_url && <Text style={styles.meta}>Official crest pending · showing league badge</Text>}
                <CountryChip country={item.country} />
                <Text style={styles.meta}>{item.country || "Country not listed"}{item.level ? ` · ${item.level}` : ""}</Text>
                {item.season ? <Text style={styles.season}>Season: {item.season}</Text> : null}
                <Text style={styles.openProfile}>View profile →</Text>
              </View>
            </Pressable>
            </Reveal>
          )}
          ListEmptyComponent={error ? null : <View style={styles.empty}><Text style={styles.emptyTitle}>No leagues found</Text><Text style={styles.emptyText}>Try a shorter name or another country.</Text></View>}
          ListFooterComponent={hasMore ? <Button onPress={() => void nextPage()} style={styles.more}>{loading ? <ActivityIndicator color={theme.onButton} /> : <Text style={styles.moreText}>Load more leagues</Text>}</Button> : <Text style={styles.footer}>Confirm league rules, payment terms and contract details independently before signing.</Text>}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) void nextPage(); }}
        />
      )}
      <Sheet open={Boolean(preview)} onClose={()=>setPreview(null)} title={preview?.name ?? "League actions"}>
        <Text style={{color:theme.muted}}>{[preview?.country,preview?.level,preview?.season].filter(Boolean).join(" · ") || "League details not listed"}</Text>
        {preview ? <><Pressable accessibilityRole="button" onPress={()=>{const id=preview.id;setPreview(null);router.push({pathname:profileRoute,params:{id}});}} style={{minHeight:48,justifyContent:"center"}}><Text style={{color:theme.accent}}>Open league profile</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={()=>{const payload=publicDirectoryShare(women ? "womens/leagues" : "leagues",preview.id,preview.name);if(!payload){Alert.alert("Link unavailable");return;}void Share.share(payload).catch(()=>Alert.alert("Unable to share","Try again."));}} style={{minHeight:48,justifyContent:"center"}}><Text style={{color:theme.accent}}>Share league profile</Text></Pressable></> : null}
      </Sheet>
      {countryOpen?<LeagueCountryPicker women={women} selected={country} onSelect={updateCountry} onClose={()=>setCountryOpen(false)}/>:null}
    </SafeAreaView>
  );
}

function LeagueCountryPicker({women,selected,onSelect,onClose}:{women:boolean;selected:string;onSelect:(value:string)=>void;onClose:()=>void}){
  const theme=useEntryTheme();
  const [options,setOptions]=useState<Awaited<ReturnType<typeof readLeagueCountries>>|null>(null),[error,setError]=useState(""),[search,setSearch]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{let alive=true;const ctrl=new AbortController(),deadline=setTimeout(()=>ctrl.abort(),15000);
    setOptions(null);setError("");void readLeagueCountries(supabase,ctrl.signal,women).then(value=>{if(alive&&!ctrl.signal.aborted)setOptions(value);else if(alive)setError("Country filters timed out.");}).catch(()=>{if(alive)setError("Country filters unavailable. League search still works.");}).finally(()=>clearTimeout(deadline));
    return()=>{alive=false;clearTimeout(deadline);ctrl.abort();};
  },[retry,women]);
  const countries=(options?.countries??[]).filter(value=>value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <Sheet open title="League country" onClose={onClose}>
    <Input accessibilityLabel="Search league countries" placeholder="Search countries" value={search} onChangeText={setSearch}/>
    <Button secondary onPress={()=>onSelect("")}>All countries</Button>
    {!options&&!error?<Text style={{color:theme.muted}}>Loading countries…</Text>:null}
    {error?<><Text accessibilityRole="alert" style={{color:theme.muted}}>{error}</Text><Button secondary onPress={()=>setRetry(n=>n+1)}>Retry</Button></>:null}
    {options&&!options.complete?<Text style={{color:theme.muted}}>Showing available labels from a bounded directory scan.</Text>:null}
    {countries.map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:value===selected}} onPress={()=>onSelect(value)} style={{minHeight:44,justifyContent:"center",borderBottomWidth:1,borderColor:theme.border}}><Text style={{color:value===selected?theme.accent:theme.foreground}}>{value}</Text></Pressable>)}
    {options&&countries.length===0?<Text style={{color:theme.muted}}>No matching countries.</Text>:null}
  </Sheet>;
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
  list: { padding: 10, paddingBottom: 100, gap: 2 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "transparent", borderRadius: 0, padding: 9, borderBottomWidth: 1, borderColor: theme.border, gap: 10 },
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
