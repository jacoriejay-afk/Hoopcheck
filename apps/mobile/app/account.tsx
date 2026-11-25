import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MembershipPreview } from "../components/MembershipPreview";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { HoopCheckLoading } from "../components/HoopCheckLoading";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { supabase } from "../src/lib/supabase";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { readWithDeadline } from "../src/native/readDeadline";
import { visibleConnections } from "../src/native/connectionPresentation";
import { profileCovers, readOwnCover, type ProfileCover } from "../src/native/profileEditor";

type AccountGlyph = keyof typeof Ionicons.glyphMap;
function AccountRow({ icon, title, detail, onPress, last = false }: {
  icon: AccountGlyph; title: string; detail?: string; onPress: () => void; last?: boolean;
}) {
  const t = useEntryTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({pressed})=>({
      flexDirection:"row",alignItems:"center",gap:12,minHeight:55,paddingHorizontal:13,
      paddingVertical:8,backgroundColor:pressed?t.accentSurface:"transparent",
      borderBottomWidth:last?0:StyleSheet.hairlineWidth,borderBottomColor:t.border,
    })}>
    <Ionicons name={icon} size={20} color={t.accent} />
    <View style={{flex:1,minWidth:0,gap:2}}>
      <Text style={{color:t.foreground,fontSize:14,fontWeight:"700"}}>{title}</Text>
      {detail?<Text numberOfLines={1} style={{color:t.muted,fontSize:11}}>{detail}</Text>:null}
    </View>
    <Ionicons name="chevron-forward" size={17} color={t.muted} />
  </Pressable>;
}
function AccountGroup({ children }: { children: ReactNode }) {
  const t = useEntryTheme();
  return <View style={{borderBottomWidth:StyleSheet.hairlineWidth,
    borderColor:t.border,backgroundColor:"transparent",overflow:"hidden"}}>{children}</View>;
}
function GroupLabel({ children }: { children: string }) {
  const t=useEntryTheme();
  return <Text accessibilityRole="header" style={{
    color:t.muted,fontSize:15,fontFamily:"HoopCheckDisplay",letterSpacing:1.1,
    textTransform:"uppercase",marginTop:4,marginBottom:-1,marginHorizontal:3,
  }}>{children}</Text>;
}

export default function AccountScreen() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account, loading, error, retry } = useNativeAccount();
  const [showBenefits, setShowBenefits] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const activeScreen=useActiveScreen();
  const [appearanceRevision,setAppearanceRevision]=useState(0);
  const [cover,setCover]=useState<{owner:string;value:ProfileCover}|null>(null);
  const [stats,setStats]=useState<{owner:string;people:number|null;teams:number|null;posts:number|null;reviews:number|null}|null>(null);
  const [avatar,setAvatar] = useState<{owner:string;url:string|null}>({owner:"",url:null});
  useEffect(()=>{
    const uid=account?.user.id;
    if(!uid){setAvatar({owner:"",url:null});setCover(null);return;}
    if(!activeScreen)return;
    let active=true;
    const controller=new AbortController();
    void Promise.resolve(supabase.from("profiles").select("avatar_url,avatar_moderation_status")
      .eq("id",uid).abortSignal(controller.signal).maybeSingle())
      .then(({data,error})=>{
        if(!active)return;
        setAvatar({owner:uid,url:!error && data?.avatar_moderation_status==="approved"
          && typeof data.avatar_url==="string"?data.avatar_url:null});
      }).catch(()=>{if(active)setAvatar({owner:uid,url:null});});
    void readOwnCover(supabase,uid).then(value=>{if(active)setCover({owner:uid,value});})
      .catch(()=>{if(active)setCover(null);});
    return()=>{active=false;controller.abort();};
  },[account?.user.id,activeScreen,appearanceRevision]);
  useEffect(()=>{
    const uid=account?.user.id,role=account?.user.accountType,canRead=account?.features.canReadHoopFeed;
    if(!uid||!role||!activeScreen){setStats(null);return;}
    let live=true;const controller=new AbortController();const deadline=setTimeout(()=>controller.abort(),12000);
    setStats(null);
    async function load(){
      try{
        const session=await readWithDeadline(()=>supabase.auth.getSession());
        if(session.error||!session.data.session||session.data.session.user.id!==uid) return;
        const [connections,posts,reviews]=await Promise.allSettled([
          supabase.rpc("get_public_follow_list",{p_mode:"following",p_target_type:null,p_target_id:null,p_user_id:uid}).abortSignal(controller.signal),
          canRead?supabase.from("feed_posts").select("id",{count:"exact",head:true}).eq("author_id",uid!).eq("status","approved").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).abortSignal(controller.signal):Promise.resolve(null),
          role==="player"?supabase.from("reviews").select("id",{count:"exact",head:true}).eq("author_id",uid!).abortSignal(controller.signal):Promise.resolve(null),
        ]);
        const after=await readWithDeadline(()=>supabase.auth.getSession());
        if(!live||controller.signal.aborted||after.error||after.data.session?.user.id!==uid)return;
        let people:number|null=null,teams:number|null=null;
        if(connections.status==="fulfilled"&&!connections.value.error){try{const rows=visibleConnections(connections.value.data,role!);people=new Set(rows.filter(row=>row.target_type!=="team").map(row=>row.target_id)).size;teams=new Set(rows.filter(row=>row.target_type==="team").map(row=>row.target_id)).size;}catch{/* Unavailable is not zero. */}}
        const count=(result:typeof posts)=>result.status==="fulfilled"&&result.value&&!result.value.error&&typeof result.value.count==="number"&&Number.isSafeInteger(result.value.count)&&result.value.count>=0?result.value.count:null;
        setStats({owner:uid!,people,teams,posts:count(posts),reviews:count(reviews)});
      }catch{/* Hide unverified counts. */}finally{clearTimeout(deadline);}
    }
    void load();return()=>{live=false;controller.abort();clearTimeout(deadline);};
  },[account?.user.id,account?.user.accountType,account?.features.canReadHoopFeed,activeScreen,appearanceRevision]);
  const [signOutError, setSignOutError] = useState("");
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true); setSignOutError("");
    try {
      const result = await supabase.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      router.replace("/sign-in");
    } catch { setSignOutError("Couldn’t sign out. Please try again."); }
    finally { setSigningOut(false); }
  }
  const tier=account?.tier==="premium"?"Premium":account?.tier==="pro"?"Pro":"Free";
  const role=account?.user.accountType.replaceAll("_"," ")||"Member";
  const ownCover=cover?.owner===account?.user.id?profileCovers.find(item=>item.id===cover?.value):undefined;
  return <SafeAreaView edges={["top","left","right","bottom"]} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:15,paddingTop:9,paddingBottom:20,gap:9,maxWidth:680,width:"100%",alignSelf:"center"}}>
      <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:1}}>
        <Text accessibilityRole="header" style={{color:theme.foreground,fontSize:25,fontFamily:"HoopCheckDisplay"}}>Your account</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh account" onPress={()=>{retry();setAppearanceRevision(value=>value+1);}}
          style={{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"}}>
          <Ionicons name="refresh-outline" size={22} color={theme.muted}/>
        </Pressable>
      </View>
      {loading&&!account?<HoopCheckLoading label="Checking your HoopCheck account…" />:account?<>
        <View style={{paddingVertical:12,gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}>
          <View style={{gap:13}}>
            {ownCover?<Pressable accessibilityRole="button" accessibilityLabel={`Edit ${ownCover.label} profile appearance`} onPress={()=>router.push("/account/edit")} style={{flexDirection:"row",alignItems:"center",gap:7,minHeight:44}}><View style={{width:24,height:24,borderRadius:8,backgroundColor:ownCover.color}}/><Text style={{color:theme.muted,fontSize:12}}>Profile appearance</Text><Ionicons name="chevron-forward" size={14} color={theme.muted}/></Pressable>:null}
            <View style={{flexDirection:"row",alignItems:"center",gap:13}}>
              <ProfileAvatar size={72} name={account.user.displayName || "HoopCheck member"} url={avatar.owner===account.user.id?avatar.url:null}/>
              <View style={{flex:1,minWidth:0,gap:5}}>
                <Text numberOfLines={1} style={{color:theme.foreground,fontSize:22,fontWeight:"900"}}>{account.user.displayName || "HoopCheck member"}</Text>
                <Text style={{color:theme.muted,fontSize:13,textTransform:"capitalize"}}>{role} account</Text>
                <View style={{alignSelf:"flex-start",flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:8,paddingVertical:4,borderRadius:10,backgroundColor:theme.accentSurface}}><Ionicons name={account.hasPaidMembership?"diamond-outline":"person-outline"} size={13} color={theme.accent}/><Text style={{color:theme.accent,fontWeight:"800",fontSize:11}}>{tier.toUpperCase()} MEMBER</Text></View>
              </View>
            </View>
            {stats?.owner===account.user.id?<View accessibilityLabel="Account activity" style={{flexDirection:"row",flexWrap:"wrap",paddingVertical:6,borderTopWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}>{([{label:"Following",value:stats.people},{label:"Teams followed",value:stats.teams},{label:"Approved posts",value:stats.posts},{label:"Reviews",value:stats.reviews}]).filter(item=>item.value!==null).map(item=><View key={item.label} style={{flex:1,minWidth:65,alignItems:"center",gap:4}}><Text style={{color:theme.foreground,fontSize:17,fontWeight:"900"}}>{item.value}</Text><Text style={{color:theme.muted,fontSize:10,textAlign:"center"}}>{item.label}</Text></View>)}</View>:null}
            <View style={{flexDirection:"row",gap:9}}>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={()=>router.push("/account/edit")}
                style={({pressed})=>({flex:1,minHeight:44,borderRadius:13,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7,
                  backgroundColor:theme.button,opacity:pressed?.76:1})}>
                <Ionicons name="create-outline" size={17} color={theme.onButton}/>
                <Text style={{color:theme.onButton,fontSize:13,fontWeight:"800"}}>Edit profile</Text>
              </Pressable>
              {account.user.accountType === "player" ? <Pressable accessibilityRole="button" accessibilityLabel="View my profile" onPress={()=>router.push({pathname:"/players/[id]",params:{id:account.user.id}})}
                style={({pressed})=>({flex:1,minHeight:44,borderRadius:13,alignItems:"center",justifyContent:"center",
                  flexDirection:"row",gap:7,borderWidth:1,borderColor:theme.glassBorder,
                  opacity:pressed ? .76 : 1})}>
                <Ionicons name="person-outline" size={17} color={theme.foreground}/>
                <Text style={{color:theme.foreground,fontSize:13,fontWeight:"800"}}>My profile</Text>
              </Pressable> : null}
            </View>
          </View>
        </View>
      {account?.workspaces?.owner || account?.workspaces?.ambassador ? <>
        <GroupLabel>Private workspaces</GroupLabel>
        <AccountGroup>
          {account.workspaces.owner ? <AccountRow icon="shield-checkmark-outline" title="Owner HQ" onPress={()=>router.push("/account/owner-hq")} last={!account.workspaces.ambassador}/> : null}
          {account.workspaces.ambassador ? <AccountRow icon="megaphone-outline" title="Ambassador HQ" onPress={()=>router.push("/account/ambassador-hq")} last/> : null}
        </AccountGroup>
      </> : null}
        <GroupLabel>Personal</GroupLabel>
        <AccountGroup>
          <AccountRow icon="chatbubble-ellipses-outline" title="HoopChat · messages and requests" detail="Conversations and connections" onPress={()=>router.push({pathname:"/notifications",params:{tab:"chat"}})}/>
          <AccountRow icon="people-outline" title="Connections" onPress={()=>router.push("/connections")} last/>
        </AccountGroup>
        <GroupLabel>Membership status</GroupLabel>
        <AccountGroup>
          <View style={{padding:13,flexDirection:"row",alignItems:"center",gap:12,
            borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.border}}>
            <Ionicons name="diamond-outline" size={22} color={theme.accent}/>
            <View style={{flex:1,gap:3}}>
              <Text style={{color:theme.foreground,fontWeight:"800"}}>{tier} membership</Text>
              <Text style={{color:theme.muted,fontSize:11}}>{account.hasPaidMembership?"Active access verified by HoopCheck":"Free access"}</Text>
            </View>
            <Text style={{color:theme.accent,fontSize:12,fontWeight:"900"}}>{tier.toUpperCase()}</Text>
          </View>
          <AccountRow icon="card-outline" title="Membership and restore purchases" onPress={()=>router.push("/membership")}/>
          <AccountRow icon="list-outline" title={showBenefits?"Hide membership benefits":"See membership benefits"}
            onPress={()=>setShowBenefits(value=>!value)} last={!showBenefits}/>
          {showBenefits?<View style={{padding:10}}><MembershipPreview /></View>:null}
        </AccountGroup>
      </>:error?<View style={{gap:10,marginVertical:10}}>
        <Text accessibilityRole="alert" style={{color:theme.foreground}}>{error}</Text>
        <AccountGroup><AccountRow icon="refresh-outline" title="Try again" onPress={retry} last/></AccountGroup>
      </View>:null}
      <GroupLabel>Security & settings</GroupLabel>
      <AccountGroup>
        <AccountRow icon="lock-closed-outline" title="Two-factor authentication" onPress={()=>router.push("/account/security")}/>
        <AccountRow icon="settings-outline" title="Device settings" onPress={()=>router.push("/settings")}/>
        <AccountRow icon="help-circle-outline" title="Help & Support" onPress={()=>router.push("/account/support")}/>
        <AccountRow icon="information-circle-outline" title="About HoopCheck" onPress={()=>router.push("/about")} last/>
      </AccountGroup>
      {account?.user.accountType === "player" ? <>
        <GroupLabel>Basketball tools</GroupLabel>
        <AccountGroup>
          <AccountRow icon="document-text-outline" title="Career Passport · My Journey" onPress={()=>router.push({ pathname: "/players/[id]", params: { id: account.user.id } })}/>
          <AccountRow icon="star-outline" title="Find a team to review" onPress={()=>router.push("/teams")} last/>
        </AccountGroup>
      </> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Sign out of this device" disabled={signingOut}
        onPress={()=>void signOut()} style={{minHeight:48,alignItems:"center",justifyContent:"center",marginTop:4}}>
        <Text style={{color:theme.accent,fontWeight:"800"}}>{signingOut?"Signing out…":"Sign out of this device"}</Text>
      </Pressable>
      {signOutError?<Text accessibilityRole="alert" style={{color:theme.accent}}>{signOutError}</Text>:null}
    </ScrollView>
  </SafeAreaView>;
}
