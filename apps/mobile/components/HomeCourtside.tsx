import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, PressableCard } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { supabase } from "../src/lib/supabase";
import { visibleConnections, type PublicConnection } from "../src/native/connectionPresentation";
import { readBasketballSide, readLiveGames } from "../src/native/liveGames";
import { readFeedPage, type FeedPost } from "../src/native/feedClient";
import { Skeleton } from "./Motion";
import { Scoreboard } from "./Scoreboard";
import { EntityArtwork } from "./EntityArtwork";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
// Existing bundled court art: no real player photograph, team crest, or sponsored asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const arena = require("../assets/courtside-arena.webp");
type Games = Awaited<ReturnType<typeof readLiveGames>>;
type HomeData = { scope: string; teams: PublicConnection[] | null; games: Games | null; posts: FeedPost[] | null };
type HomeRoute = "/teams" | "/fan-live" | "/team-hub/groups" | "/reels";
const palette = {
  orange: { colors: ["#A33C16", "#602715", "#2A1928"] as [string,string,string], accent: "#FF973D" },
  violet: { colors: ["#6833BA", "#422478", "#201B40"] as [string,string,string], accent: "#D5A7FF" },
  blue: { colors: ["#0F65BD", "#123D7F", "#13243B"] as [string,string,string], accent: "#6CCBFF" },
  green: { colors: ["#167A51", "#165438", "#102E2C"] as [string,string,string], accent: "#75F5B6" },
};
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
function ArenaAction({ title, route, icon, tone }: {
  title:string; route:HomeRoute; icon:"shield-checkmark-outline"|"create-outline"|"radio-outline"|"people-outline"; tone:keyof typeof palette;
}) {
  const t=useEntryTheme();const router=useRouter();const paint=palette[tone];
  return <Pressable accessibilityRole="link" accessibilityLabel={title} onPress={()=>router.push(route)}
    style={({pressed})=>({flex:1,minWidth:0,opacity:pressed?.82:1,transform:[{scale:pressed?.97:1}]})}>
    <View style={{minHeight:99,borderRadius:17,overflow:"hidden",borderWidth:1,
      borderColor:t.dark?paint.accent:paint.colors[0],backgroundColor:paint.colors[1]}}>
      <LinearGradient colors={paint.colors} start={{x:0,y:0}} end={{x:1,y:1}}
        style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={{position:"absolute",bottom:-22,right:-18,width:58,height:58,
        borderRadius:30,borderWidth:1,borderColor:"rgba(255,255,255,.20)"}}/>
      <View style={{minHeight:99,paddingHorizontal:5,paddingVertical:11,alignItems:"center",
        justifyContent:"center",gap:6}}>
        <Ionicons name={icon} size={25} color="#FFFFFF" />
        <Text numberOfLines={2} style={{textAlign:"center",fontFamily:t.type.ui.fontFamily,
          color:"#FFFFFF",fontSize:12,lineHeight:16,fontWeight:"700"}}>{title}</Text>
      </View>
      <View pointerEvents="none" style={{position:"absolute",height:2,bottom:0,left:18,right:18,
        borderRadius:3,backgroundColor:paint.accent}}/>
    </View>
  </Pressable>;
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
    setSnapshot(null);
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
  const actions = [
    {route:"/teams",title:"Check a Team",icon:"shield-checkmark-outline",tone:"orange"},
    {route:"/teams",title:role==="player"?"Review a Team":"Explore Teams",icon:"create-outline",tone:"violet"},
    {route:"/fan-live",title:"Live Games",icon:"radio-outline",tone:"blue"},
    {route:"/team-hub/groups",title:"Fan Groups",icon:"people-outline",tone:"green"},
  ] as const;
  return <View style={{gap:14,marginBottom:t.spacing.lg}}>
    <View style={{borderRadius:19,overflow:"hidden",borderWidth:1,
        borderColor:t.dark?"rgba(255,150,74,.70)":"rgba(211,93,29,.58)",
        backgroundColor:"#101F35"}}>
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
            <View accessible accessibilityLabel={`${tier} membership`} style={{backgroundColor:account.tier==="free"?"rgba(255,255,255,.12)":"#FF8E37",
              borderRadius:9,paddingHorizontal:9,paddingVertical:5,borderWidth:1,
              borderColor:account.tier==="free"?"rgba(255,255,255,.28)":"#FFD07A"}}>
              <Text style={{fontSize:10,fontWeight:"800",color:account.tier==="free"?"#FFFFFF":"#1C1B23"}}>{tier}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="link" onPress={()=>router.push("/account/edit")}
            style={{flexDirection:"row",alignItems:"center",minHeight:44,gap:8,
              borderTopWidth:1,borderColor:"rgba(255,255,255,.19)",paddingTop:8}}>
            <Ionicons name="person-circle-outline" color="#FFAD73" size={18} />
            <Text style={{flex:1,color:"#E7EFF9",fontSize:12}}>Complete your profile</Text>
            <Text style={{color:"#FFA362",fontWeight:"700",fontSize:12}}>Edit profile →</Text>
          </Pressable>
        </View>
    </View>
    <ArenaHeading title="QUICK ACTIONS"/>
    <View style={{flexDirection:"row",gap:6}}>
      {actions.map(item=><ArenaAction key={item.title} route={item.route as HomeRoute} title={item.title}
        icon={item.icon} tone={item.tone}/>)}
    </View>
    <ArenaHeading title="TEAMS YOU FOLLOW" cta="Explore teams" onPress={()=>router.push("/teams")}/>
    {!data?<Skeleton review/>:data.teams===null?<Text accessibilityRole="alert"
      style={{color:t.muted}}>Your teams could not load.</Text>:followTeams.length===0?
      <Pressable accessibilityRole="link" onPress={()=>router.push("/teams")} style={{minHeight:55,
        borderRadius:16,backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
        padding:12,justifyContent:"center"}}>
        <Text style={{color:t.muted}}>Follow a team to see it here.</Text>
      </Pressable>:
      followTeams.slice(0,2).map(team=><Pressable key={team.target_id}
        accessibilityRole="link" accessibilityLabel={team.display_name||"View team"}
        onPress={()=>router.push({pathname:"/teams/[id]",params:{id:team.target_id}})}
        style={({pressed})=>({opacity:pressed?.8:1,borderRadius:16,overflow:"hidden",borderWidth:1,
          borderColor:t.dark?"rgba(94,171,255,.36)":t.border,backgroundColor:t.elevatedSurface})}>
        <View style={{flexDirection:"row",alignItems:"center",gap:10,padding:10,minHeight:67}}>
          <EntityArtwork name={team.display_name||"Team"} kind="teams" size={46}/>
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
    <ArenaHeading title="My Teams" cta="See all" onPress={()=>router.push("/teams")}/>
    <View style={{borderRadius:16,backgroundColor:t.elevatedSurface,borderWidth:1,
      borderColor:t.dark?"rgba(74,147,234,.35)":t.border,padding:10,flexDirection:"row",
      alignItems:"center",gap:10,minHeight:66}}>
      {followTeams.length?followTeams.slice(0,3).map(team=><Pressable key={team.target_id}
        accessibilityRole="link" accessibilityLabel={team.display_name||"Open team"} 
        onPress={()=>router.push({pathname:"/teams/[id]",params:{id:team.target_id}})}
        style={{minHeight:46,minWidth:46,alignItems:"center",justifyContent:"center",
          borderRadius:23,borderWidth:1,borderColor:t.accent}}>
        <EntityArtwork name={team.display_name||"Team"} kind="teams" size={38}/>
      </Pressable>):
        <Text style={{flex:1,color:t.muted,fontSize:13}}>Your followed clubs appear here.</Text>}
      <Pressable accessibilityRole="link" accessibilityLabel="Find more teams"
        onPress={()=>router.push("/teams")} style={{marginLeft:"auto",width:44,height:44,
        borderRadius:22,alignItems:"center",justifyContent:"center",
        backgroundColor:t.accentSurface}}>
        <Ionicons name="add" size={23} color={t.accent}/>
      </Pressable>
    </View>
    {!data?null:<>
      <ArenaHeading title="LIVE GAMES" cta="All games" onPress={()=>router.push("/fan-live")}/>
      {!gameAccess?<Text style={{color:t.muted,fontSize:12}}>Game Center requires an eligible membership.</Text>:
        data.games===null?<Text accessibilityRole="alert" style={{color:t.muted}}>Scores could not load.</Text>:
        !data.games.games.length?<Text style={{color:t.muted,fontSize:12}}>No current games. Check upcoming tip-offs.</Text>:
        [...data.games.games].sort((a,b)=>Number(b.status==="live")-Number(a.status==="live")).slice(0,2)
        .map(game=><PressableCard key={game.id} onPress={()=>router.push({pathname:"/fan-live",params:{gameId:game.id}})}>
          <Scoreboard game={game} teams={data.games!.teams}/>
        </PressableCard>)}
      <ArenaHeading title="FROM HOOPFEED" cta="Open" onPress={()=>router.push("/feed")}/>
      {!feedAccess?<Text style={{color:t.muted,fontSize:12}}>Community posts require an eligible membership.</Text>:
        data.posts===null?<Text accessibilityRole="alert" style={{color:t.muted}}>HoopFeed preview could not load.</Text>:
        !data.posts.length?<Text style={{color:t.muted,fontSize:12}}>No community posts yet.</Text>:
        data.posts.map(post=><PressableCard key={post.id} onPress={()=>router.push({pathname:"/feed",params:{post:post.id}})}>
          <Text style={{color:t.muted,...t.type.caption}}>{post.profiles?.display_name||"HoopCheck member"} · {new Date(post.created_at).toLocaleDateString()}</Text>
          <Text numberOfLines={3} style={{color:t.foreground,...t.type.body}}>{post.body||(post.video_url?"Watch a community highlight":"View community media")}</Text>
        </PressableCard>)}
      <Button secondary onPress={()=>setRevision(v=>v+1)}>Refresh courtside</Button>
    </>}
  </View>;
}
