import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { supabase } from "../src/lib/supabase";
import { visibleConnections, type PublicConnection } from "../src/native/connectionPresentation";
import { readBasketballSide, readLiveGames } from "../src/native/liveGames";
import { selectHomePreviewGames } from "../src/native/homeGamePreview";
import { readFeedPage, type FeedPost } from "../src/native/feedClient";
import { HoopCheckLoading } from "./HoopCheckLoading";
import { Scoreboard } from "./Scoreboard";
import { MyCourtActions } from "./MyCourtActions";
import { EntityArtwork } from "./EntityArtwork";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type Games = Awaited<ReturnType<typeof readLiveGames>>;
type HomeData = { scope: string; teams: PublicConnection[] | null; games: Games | null; posts: FeedPost[] | null;
  logos: Record<string, { url: string | null; bg: string | null }>; };
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
    // Keep the last verified snapshot while refreshing this same user and tier.
    // The scope check below prevents old account or membership data from leaking.
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
        const teams = results[0].status === "fulfilled" ? results[0].value : null;
        const after = await supabase.auth.getSession();
        if (!active) return;
        if (controller.signal.aborted || after.error || after.data.session?.user.id !== uid) throw Error("Home could not be verified");
        // Show the trusted page before fetching optional artwork. A slow or
        // missing logo may never block the rest of Home content.
        setSnapshot({ scope, teams, logos: {}, games: results[1].status === "fulfilled" ? results[1].value : null, posts: results[2].status === "fulfilled" ? results[2].value : null });
        const ids = teams?.slice(0, 2).map(item => item.target_id) ?? [];
        if (ids.length) {
          try {
            const [men, women] = await Promise.all([
              supabase.from("teams").select("id,logo_url,logo_bg").in("id", ids).abortSignal(controller.signal),
              supabase.from("womens_teams").select("id,logo_url,logo_bg").in("id", ids).abortSignal(controller.signal),
            ]);
            if (!active || controller.signal.aborted) return;
            const logos: HomeData["logos"] = {};
            for (const response of [men, women]) if (!response.error) {
              for (const team of response.data ?? []) if (ids.includes(team.id)) {
                logos[team.id] = { url: team.logo_url, bg: team.logo_bg };
              }
            }
            setSnapshot(current => current?.scope === scope ? { ...current, logos } : current);
          } catch { /* Optional logo lookup never downgrades verified Home. */ }
        }
      } catch { if (active) setSnapshot({ scope, teams: null, logos: {}, games: null, posts: null }); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [uid, role, scope, revision, gameAccess, feedAccess, fullGames]));
  const data=account&&snapshot?.scope===scope?snapshot:null;
  if(loading)return <HoopCheckLoading compact label="Loading your court…" />;
  if(!account)return <View style={{gap:t.spacing.sm}}>
    <Text accessibilityRole="alert" style={{color:t.muted}}>{error||"Verify your account to personalize Home."}</Text>
    <Button secondary onPress={retry}>Retry account verification</Button>
  </View>;
  const tier=account.tier==="premium"?"PREMIUM":account.tier==="pro"?"PRO":"FREE";
  const followTeams=data?.teams??[];
  const previewGames=selectHomePreviewGames(data?.games?.games??[]);
  return <View style={{gap:9,marginBottom:t.spacing.md}}>
    <View style={{borderBottomWidth:1,borderColor:t.border}}>
        <View style={{paddingVertical:8,gap:5}}>
          <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <View style={{flex:1,minWidth:0,gap:3}}>
              <Text accessibilityRole="header" numberOfLines={2} style={{color:t.foreground,
                fontFamily:"HoopCheckDisplay",fontWeight:"700",fontSize:18,lineHeight:23}}>
                {account.user.displayName?`Welcome back, ${account.user.displayName}`:"Welcome to HoopCheck"}
              </Text>
              <Text style={{color:t.muted,fontSize:12,lineHeight:17}}>Know who you're signing with.</Text>
            </View>
            <View accessible accessibilityLabel={`${tier} membership`} style={{backgroundColor:account.tier==="free"?t.chip:"#FF8E37",
              borderRadius:9,paddingHorizontal:9,paddingVertical:5,borderWidth:1,
              borderColor:account.tier==="free"?t.border:"#FFD07A"}}>
              <Text style={{fontSize:10,fontWeight:"800",color:account.tier==="free"?t.foreground:"#1C1B23"}}>{tier}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="link" onPress={()=>router.push("/account/edit")}
            style={{flexDirection:"row",alignItems:"center",minHeight:44,gap:8,
              borderTopWidth:1,borderColor:t.border,paddingTop:8}}>
            <Ionicons name="person-circle-outline" color="#FFAD73" size={18} />
            <Text style={{flex:1,color:t.foreground,fontSize:12}}>Complete your profile</Text>
            <Text style={{color:t.accent,fontWeight:"700",fontSize:12}}>Edit profile →</Text>
          </Pressable>
        </View>
    </View>
    <MyCourtActions key={`${uid}:${role}`} userId={uid!} role={role!} feedEnabled={feedAccess} />
    <ArenaHeading title="My Teams" cta="Find teams" onPress={()=>router.push("/teams")}/>
    {!data?<HoopCheckLoading compact label="Loading your teams…" />:data.teams===null?<Text accessibilityRole="alert"
      style={{color:t.muted}}>Your teams could not load.</Text>:followTeams.length===0?
      <Pressable accessibilityRole="link" onPress={()=>router.push("/teams")} style={{minHeight:55,
        borderRadius:16,backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
        padding:12,justifyContent:"center"}}>
        <Text style={{color:t.muted}}>Follow a team to see it here.</Text>
      </Pressable>:
      followTeams.slice(0,2).map(team=><Pressable key={team.target_id}
        accessibilityRole="link" accessibilityLabel={team.display_name||"View team"}
        onPress={()=>router.push({pathname:"/teams/[id]",params:{id:team.target_id}})}
        style={({pressed})=>({opacity:pressed?.8:1,borderRadius:0,overflow:"hidden",borderBottomWidth:1,
          borderColor:t.border,backgroundColor:"transparent"})}>
        <View style={{flexDirection:"row",alignItems:"center",gap:8,padding:6,minHeight:55}}>
          <EntityArtwork name={team.display_name||"Team"} kind="teams" size={46} logoUrl={data.logos[team.target_id]?.url} logoBg={data.logos[team.target_id]?.bg}/>
          <View style={{flex:1,minWidth:0}}>
            <Text numberOfLines={1} style={{fontFamily:t.type.ui.fontFamily,color:t.foreground,
              fontSize:15,fontWeight:"700"}}>{team.display_name||"Team"}</Text>
            <Text style={{color:t.muted,fontSize:12}}>Following</Text>
          </View>
          <Ionicons name="chevron-forward" color={t.accent} size={20}/>
        </View>
      </Pressable>)}
    {role==="player"&&reviewPromptVisible?<View style={{borderRadius:17,overflow:"hidden",
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
          <Pressable accessibilityRole="link" onPress={()=>router.push("/teams")}
            style={{flex:1,minHeight:44,backgroundColor:"#F66B25",borderRadius:13,
              justifyContent:"center",alignItems:"center",paddingHorizontal:8}}>
            <Text numberOfLines={1} style={{color:"#FFFFFF",fontWeight:"800",fontSize:12}}>Choose a team to review →</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss review prompt"
            onPress={()=>setReviewPromptVisible(false)} style={{minHeight:44,paddingHorizontal:7,
              justifyContent:"center"}}>
            <Text style={{color:t.muted,fontSize:12,fontWeight:"700"}}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View>:null}
    {!data?null:<>
      <ArenaHeading title="LIVE & UPCOMING" cta="All games" onPress={()=>router.push("/fan-live")}/>
      {!gameAccess?<Text style={{color:t.muted,fontSize:12}}>Game Center requires an eligible membership.</Text>:
        data.games===null?<Text accessibilityRole="alert" style={{color:t.muted}}>Scores could not load.</Text>:
        !previewGames.length?<Text style={{color:t.muted,fontSize:12}}>No live or upcoming games. See Game Center for past results.</Text>:
        previewGames.map(game=><Pressable accessibilityRole="button" key={game.id} style={({pressed})=>({minHeight:44,paddingVertical:8,borderBottomWidth:1,borderColor:t.border,opacity:pressed?.72:1})} onPress={()=>router.push({pathname:"/fan-live",params:{gameId:game.id}})}>
          <Scoreboard game={game} teams={data.games!.teams}/>
        </Pressable>)}
      <ArenaHeading title="FROM HOOPFEED" cta="Open" onPress={()=>router.push("/feed")}/>
      {!feedAccess?<Text style={{color:t.muted,fontSize:12}}>Community posts require an eligible membership.</Text>:
        data.posts===null?<Text accessibilityRole="alert" style={{color:t.muted}}>HoopFeed preview could not load.</Text>:
        !data.posts.length?<Pressable accessibilityRole="link" accessibilityLabel="Open HoopFeed to start a discussion"
          onPress={()=>router.push("/feed")} style={{minHeight:48,justifyContent:"center",
            borderRadius:12,borderWidth:1,borderColor:t.border,backgroundColor:t.surface,
            paddingHorizontal:12,paddingVertical:8}}>
          <Text style={{color:t.foreground,fontSize:12,fontWeight:"600"}}>
            No community posts yet. Start a discussion in HoopFeed →
          </Text>
        </Pressable>:
        data.posts.map(post=><Pressable accessibilityRole="button" key={post.id} style={({pressed})=>({minHeight:44,paddingVertical:8,borderBottomWidth:1,borderColor:t.border,opacity:pressed?.72:1,gap:4})} onPress={()=>router.push({pathname:"/feed",params:{post:post.id}})}>
          <Text style={{color:t.muted,...t.type.caption}}>{post.profiles?.display_name||"HoopCheck member"} · {new Date(post.created_at).toLocaleDateString()}</Text>
          <Text numberOfLines={3} style={{color:t.foreground,...t.type.body}}>{post.body||(post.video_url?"Watch a community highlight":"View community media")}</Text>
        </Pressable>)}
      <Button secondary onPress={()=>setRevision(v=>v+1)}>Refresh courtside</Button>
    </>}
  </View>;
}
