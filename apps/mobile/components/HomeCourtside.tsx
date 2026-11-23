import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, GlassCard } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { supabase } from "../src/lib/supabase";
import { visibleConnections, type PublicConnection } from "../src/native/connectionPresentation";
import { readBasketballSide, readLiveGames } from "../src/native/liveGames";
import { selectHomePreviewGames } from "../src/native/homeGamePreview";
import { readFeedPage, type FeedPost } from "../src/native/feedClient";
import { Skeleton } from "./Motion";
import { Scoreboard } from "./Scoreboard";
import { MyCourtActions } from "./MyCourtActions";
import { EntityArtwork } from "./EntityArtwork";
import { PressableScale } from "./PressableScale";
import { useMotionSetting } from "../src/motion/Provider";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
// Existing bundled court art: no real player photograph, team crest, or sponsored asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const arena = require("../assets/courtside-arena.webp");
type Games = Awaited<ReturnType<typeof readLiveGames>>;
type HomeData = { scope: string; teams: PublicConnection[] | null; games: Games | null; posts: FeedPost[] | null };
function ArenaHeading({title,cta,onPress}: {title:string;cta?:string;onPress?:()=>void}) {
  const theme=useEntryTheme();
  return <View style={{ flexDirection:"row",alignItems:"center",gap:8,minHeight:30 }}>
    <View style={{width:4,height:24,borderRadius:3,backgroundColor:"#FF7A32"}} />
    <Text accessibilityRole="header" style={{flex:1,minWidth:0,color:theme.foreground,
      fontFamily:"HoopCheckDisplay",fontSize:21,lineHeight:25,textTransform:"uppercase"}}>{title}</Text>
    {cta&&onPress?<Pressable accessibilityRole="link" onPress={onPress} style={{minHeight:44,
      justifyContent:"center",paddingHorizontal:5}}>
      <Text style={{color:theme.accent,fontSize:12,fontWeight:"700"}}>{cta} →</Text>
    </Pressable>:null}
  </View>;
}
/** A section animates on its first render only; its skeleton stays within it. */
export function HomeStagger({ index, children }: { index: number; children: ReactNode }) {
  const reduced = useMotionSetting();
  const progress = useSharedValue(reduced ? 1 : 0);
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      progress.set(reduced ? 1 : withDelay(index * 80, withTiming(1, {
        duration: 350, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
      })));
    } else if (reduced) {
      progress.set(1);
    }
  }, [index, reduced, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 12 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Both layers own the same reserved min-height. Their opacity changes on the
 * UI thread; no data-fetch or refresh behavior is touched.
 */
function HomeCrossfade({ loading, minHeight, loadingLabel, children }: {
  loading: boolean; minHeight: number; loadingLabel?: string; children: ReactNode;
}) {
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  const opacity = useSharedValue(loading ? 0 : 1);
  const [showSkeleton, setShowSkeleton] = useState(loading);
  useEffect(() => {
    if (loading) setShowSkeleton(true);
    opacity.set(reduced ? (loading ? 0 : 1) : withTiming(loading ? 0 : 1, {
      duration: 250, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
    }));
    if (!loading) {
      const timeout = setTimeout(() => setShowSkeleton(false), reduced ? 0 : 260);
      return () => clearTimeout(timeout);
    }
  }, [loading, reduced, opacity]);
  const contentStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const skeletonStyle = useAnimatedStyle(() => ({ opacity: 1 - opacity.get() }));
  return <View style={{ minHeight }}>
    <Animated.View pointerEvents={loading ? "none" : "auto"}
      accessibilityElementsHidden={loading}
      importantForAccessibility={loading ? "no-hide-descendants" : "auto"}
      style={[{ minHeight }, contentStyle]}>{children}</Animated.View>
    {showSkeleton ? <Animated.View pointerEvents="none"
      accessibilityElementsHidden={!loading} importantForAccessibility={loading ? "yes" : "no-hide-descendants"}
      style={[StyleSheet.absoluteFillObject, { minHeight, overflow: "hidden", justifyContent: "center",
        borderRadius: 14, backgroundColor: theme.surface }, skeletonStyle]}>
      <View accessible={loading} accessibilityRole="progressbar" accessibilityLabel={loadingLabel || "Loading section"}
        accessibilityState={{ busy: loading }} style={{ gap: 12, padding: 14 }}>
        {loadingLabel ? <Text style={{ color: theme.muted, fontSize: 12 }}>{loadingLabel}</Text> : null}
        <View style={{ height: 17, width: "55%", borderRadius: 7, backgroundColor: theme.border }} />
        <View style={{ height: 12, width: "85%", borderRadius: 7, backgroundColor: theme.border }} />
        <View style={{ height: 12, width: "62%", borderRadius: 7, backgroundColor: theme.border }} />
      </View>
    </Animated.View> : null}
  </View>;
}

export function HomeCourtside() {
  const t=useEntryTheme();const router=useRouter();
  const { account, loading, error, retry }=useNativeAccount();
  const [revision,setRevision]=useState(0);
  const [snapshot,setSnapshot]=useState<HomeData|null>(null);
  const [reviewPromptVisible,setReviewPromptVisible]=useState(true);
  const uid=account?.user.id;
  const role=account?.user.accountType;
  const gameAccess=Boolean(account?.features.canUseLiveGameHub || role==="player");
  const feedAccess=account?.features.canReadHoopFeed===true;
  const fullGames=account?.features.canUseLiveGameHub===true;
  const scope=`${uid}:${role}:${gameAccess}:${feedAccess}:${fullGames}`;
  useFocusEffect(useCallback(() => {
    void revision; // A user refresh starts a new focused request.
    let active = true; const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    // Preserve the verified scope-matched snapshot during refresh; do not flash loading.
    async function load() {
      if (!uid || !role) return;
      try {
        const before = await supabase.auth.getSession();
        if (before.error || before.data.session?.user.id !== uid) throw Error("Session changed");
        const token = before.data.session.access_token;
        const results = await Promise.allSettled([
          supabase.rpc("get_public_follow_list", { p_mode: "following", p_target_type: null, p_target_id: null, p_user_id: uid }).abortSignal(controller.signal).then(result => { if (result.error) throw Error("Teams unavailable"); return visibleConnections(result.data, role).filter(row => row.target_type === "team"); }),
          gameAccess ? readBasketballSide(supabase, uid).then(side => readLiveGames(supabase, side, fullGames ? null : { origin, token })) : Promise.resolve(null),
          feedAccess ? readFeedPage(supabase, uid).then(page => page.posts.slice(0, 2)) : Promise.resolve(null),
        ]);
        const after = await supabase.auth.getSession();
        if (!active) return;
        if (controller.signal.aborted || after.error || after.data.session?.user.id !== uid) throw Error("Home could not be verified");
        setSnapshot({ scope, teams: results[0].status === "fulfilled" ? results[0].value : null, games: results[1].status === "fulfilled" ? results[1].value : null, posts: results[2].status === "fulfilled" ? results[2].value : null });
      } catch { if (active) setSnapshot({ scope, teams: null, games: null, posts: null }); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [uid, role, scope, revision, gameAccess, feedAccess, fullGames]));
  const data=account&&snapshot?.scope===scope?snapshot:null;
  if(loading)return <Skeleton review />;
  if(!account)return <View style={{gap:t.spacing.sm}}>
    <Text accessibilityRole="alert" style={{color:t.muted}}>{error||"Verify your account to personalize Home."}</Text>
    <Button secondary onPress={retry}>Retry account verification</Button>
  </View>;
  const tier=account.tier==="premium"?"PREMIUM":account.tier==="pro"?"PRO":"FREE";
  const followTeams=data?.teams??[];
  const previewGames=selectHomePreviewGames(data?.games?.games??[]);
  return <View style={{ gap: 14, marginBottom: t.spacing.lg }}>
    <HomeStagger index={0}>
      <View style={{ borderRadius: 19, overflow: "hidden", borderWidth: 1,
        borderColor: t.dark ? "rgba(255,150,74,.70)" : "rgba(211,93,29,.58)",
        backgroundColor: "#101F35" }}>
        <LinearGradient colors={["#0D203B","#153A62","#351B25"]} start={{x:0,y:0}}
          end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
        <Image source={arena} resizeMode="cover" accessible={false} alt=""
          style={[StyleSheet.absoluteFill,{opacity:.14}]}/>
        <View style={{padding:14,gap:12}}>
          <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <View style={{flex:1,minWidth:0,gap:3}}>
              <Text accessibilityRole="header" numberOfLines={2} style={{color:"#FFFFFF",
                fontFamily:t.type.ui.fontFamily,fontWeight:"700",fontSize:18,lineHeight:23}}>
                {account.user.displayName?`Welcome back, ${account.user.displayName}`:"Welcome to HoopCheck"}
              </Text>
              <Text style={{color:"#C7D8ED",fontSize:12,lineHeight:17}}>Know who you're signing with.</Text>
            </View>
            <View accessible accessibilityLabel={`${tier} membership`} style={{
              backgroundColor:account.tier==="free"?"rgba(255,255,255,.12)":"#FF8E37",
              borderRadius:9,paddingHorizontal:9,paddingVertical:5,borderWidth:1,
              borderColor:account.tier==="free"?"rgba(255,255,255,.28)":"#FFD07A"}}>
              <Text style={{fontSize:10,fontWeight:"800",color:account.tier==="free"?"#FFFFFF":"#1C1B23"}}>{tier}</Text>
            </View>
          </View>
          <PressableScale accessibilityRole="link" onPress={()=>router.push("/account/edit")}
            style={{flexDirection:"row",alignItems:"center",minHeight:44,gap:8,
              borderTopWidth:1,borderColor:"rgba(255,255,255,.19)",paddingTop:8}}>
            <Ionicons name="person-circle-outline" color="#FFAD73" size={18} />
            <Text style={{flex:1,color:"#E7EFF9",fontSize:12}}>Complete your profile</Text>
            <Text style={{color:"#FFA362",fontWeight:"700",fontSize:12}}>Edit profile →</Text>
          </PressableScale>
        </View>
      </View>
    </HomeStagger>

    <HomeStagger index={1}>
      <MyCourtActions key={`${uid}:${role}`} userId={uid!} role={role!} feedEnabled={feedAccess} />
    </HomeStagger>

    <HomeStagger index={2}>
      <View style={{ gap: 8 }}>
        <ArenaHeading title="My Teams" cta="Find teams" onPress={()=>router.push("/teams")}/>
        <HomeCrossfade loading={!data} minHeight={164} loadingLabel="Loading followed teams…">
          {data?.teams===null?<Text accessibilityRole="alert" style={{color:t.muted}}>Your teams could not load.</Text>:
            followTeams.length===0?
            <PressableScale accessibilityRole="link" onPress={()=>router.push("/teams")}
              style={{minHeight:55,borderRadius:16,backgroundColor:t.surface,borderWidth:1,
                borderColor:t.border,padding:12,justifyContent:"center"}}>
              <Text style={{color:t.muted}}>Follow a team to see it here.</Text>
            </PressableScale>:
            <View style={{ gap: 8 }}>{followTeams.slice(0,2).map(team=>
              <PressableScale key={team.target_id} accessibilityRole="link"
                accessibilityLabel={team.display_name||"View team"}
                onPress={()=>router.push({pathname:"/teams/[id]",params:{id:team.target_id}})}
                style={{borderRadius:16,overflow:"hidden",borderWidth:1,
                  borderColor:t.dark?"rgba(94,171,255,.36)":t.border,
                  backgroundColor:t.elevatedSurface}}>
                <View style={{flexDirection:"row",alignItems:"center",gap:10,padding:10,minHeight:67}}>
                  <EntityArtwork name={team.display_name||"Team"} kind="teams" size={46}/>
                  <View style={{flex:1,minWidth:0}}>
                    <Text numberOfLines={1} style={{fontFamily:t.type.ui.fontFamily,color:t.foreground,
                      fontSize:15,fontWeight:"700"}}>{team.display_name||"Team"}</Text>
                    <Text style={{color:t.muted,fontSize:12}}>Following</Text>
                  </View>
                  <Ionicons name="chevron-forward" color={t.accent} size={20}/>
                </View>
              </PressableScale>
            )}</View>}
        </HomeCrossfade>
      </View>
    </HomeStagger>

    {role==="player"&&reviewPromptVisible?<HomeStagger index={3}><View style={{borderRadius:17,overflow:"hidden",
      borderWidth:1,borderColor:t.dark?"rgba(255,136,66,.65)":t.border,backgroundColor:t.surface}}>
      <LinearGradient colors={t.dark?["#252C46","#1B2C41","#34242B"]:["#FFF6EF","#FAF4FF","#F4F8FD"]}
        start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
      <View style={{padding:12,gap:9}}>
        <View style={{flexDirection:"row",gap:10,alignItems:"flex-start"}}>
          <Ionicons name="clipboard-outline" color={t.dark?"#FFA66A":"#C4501C"} size={24}/>
          <View style={{flex:1,minWidth:0,gap:4}}>
            <Text style={{color:t.foreground,fontSize:15,fontFamily:t.type.ui.fontFamily,fontWeight:"700"}}>Played for a team recently?</Text>
            <Text style={{color:t.muted,fontSize:12,lineHeight:18}}>Share your experience to help the next player.</Text>
          </View>
        </View>
        <View style={{flexDirection:"row",gap:10,alignItems:"center"}}>
          <PressableScale accessibilityRole="link" onPress={()=>router.push("/teams")}
            style={{flex:1,minHeight:44,backgroundColor:"#F66B25",borderRadius:13,
              justifyContent:"center",alignItems:"center",paddingHorizontal:8}}>
            <Text numberOfLines={1} style={{color:"#FFFFFF",fontWeight:"800",fontSize:12}}>Choose a team to review →</Text>
          </PressableScale>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss review prompt"
            onPress={()=>setReviewPromptVisible(false)} style={{minHeight:44,paddingHorizontal:7,
              justifyContent:"center"}}>
            <Text style={{color:t.muted,fontSize:12,fontWeight:"700"}}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View></HomeStagger>:null}
    <HomeStagger index={4}>
      <View style={{ gap: 8 }}>
        <ArenaHeading title="LIVE & UPCOMING" cta="All games" onPress={()=>router.push("/fan-live")}/>
        <HomeCrossfade loading={!data} minHeight={320}>
          {!gameAccess?<Text style={{color:t.muted,fontSize:12}}>Game Center requires an eligible membership.</Text>:
            data?.games===null?<Text accessibilityRole="alert" style={{color:t.muted}}>Scores could not load.</Text>:
            !previewGames.length?<Text style={{color:t.muted,fontSize:12}}>No live or upcoming games. See Game Center for past results.</Text>:
            <View style={{gap:8}}>{previewGames
              .map(game=><PressableScale key={game.id} accessibilityRole="button"
                onPress={()=>router.push({pathname:"/fan-live",params:{gameId:game.id}})}>
                <GlassCard style={{padding:t.spacing.md,gap:t.spacing.sm}}>
                  <Scoreboard game={game} teams={data.games!.teams}/>
                </GlassCard>
              </PressableScale>)}</View>}
        </HomeCrossfade>
      </View>
    </HomeStagger>

    <HomeStagger index={5}>
      <View style={{ gap: 8 }}>
        <ArenaHeading title="FROM HOOPFEED" cta="Open" onPress={()=>router.push("/feed")}/>
        <HomeCrossfade loading={!data} minHeight={260}>
          {!feedAccess?<Text style={{color:t.muted,fontSize:12}}>Community posts require an eligible membership.</Text>:
            data?.posts===null?<Text accessibilityRole="alert" style={{color:t.muted}}>HoopFeed preview could not load.</Text>:
            !data?.posts?.length?<PressableScale accessibilityRole="link" accessibilityLabel="Open HoopFeed to start a discussion"
              onPress={()=>router.push("/feed")} style={{minHeight:48,justifyContent:"center",
                borderRadius:12,borderWidth:1,borderColor:t.border,backgroundColor:t.surface,
                paddingHorizontal:12,paddingVertical:8}}>
              <Text style={{color:t.foreground,fontSize:12,fontWeight:"600"}}>
                No community posts yet. Start a discussion in HoopFeed →
              </Text>
            </PressableScale>:
            <View style={{gap:8}}>{data.posts.map(post=>
              <PressableScale key={post.id} accessibilityRole="button"
                onPress={()=>router.push({pathname:"/feed",params:{post:post.id}})}>
                <GlassCard style={{padding:t.spacing.md,gap:t.spacing.sm}}>
                  <Text style={{color:t.muted,...t.type.caption}}>{post.profiles?.display_name||"HoopCheck member"} · {new Date(post.created_at).toLocaleDateString()}</Text>
                  <Text numberOfLines={3} style={{color:t.foreground,...t.type.body}}>{post.body||(post.video_url?"Watch a community highlight":"View community media")}</Text>
                </GlassCard>
              </PressableScale>
            )}</View>}
        </HomeCrossfade>
      </View>
    </HomeStagger>
    {data ? <Button secondary onPress={()=>setRevision(v=>v+1)}>Refresh courtside</Button> : null}
  </View>;
}
