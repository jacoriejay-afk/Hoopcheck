import { useEffect, useState } from "react";
import { Linking, RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEntryTheme } from "../../src/theme";
import { Button, GlassCard } from "../../src/primitives";
import { supabase } from "../../src/lib/supabase";
import { useNetwork } from "../../src/native/network";
import { Skeleton } from "../../components/Motion";

type Coach={id:string;name:string;country:string|null;city:string|null;website:string|null;current_team_id:string|null};
type Team={id:string;name:string;basketball_type:string|null;league_name:string|null};
const safeId=/^[A-Za-z0-9_-]{1,100}$/;
function website(value:string|null){if(!value)return null;try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password?url.toString():null;}catch{return null;}}
export default function CoachProfile(){
 const params=useLocalSearchParams<{id?:string}>(); const id=typeof params.id==="string"?params.id:"";
 return <CoachDetails key={id} id={id}/>;
}
function CoachDetails({id}:{id:string}){
 const t=useEntryTheme(),router=useRouter(),{offline,revision}=useNetwork();
 const [refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true),[coach,setCoach]=useState<Coach|null>(null),[team,setTeam]=useState<Team|null>(null),[error,setError]=useState(""),[teamError,setTeamError]=useState(false),[linkError,setLinkError]=useState("");
 useEffect(()=>{
  let active=true;const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  setLoading(true);setCoach(null);setTeam(null);setError("");setTeamError(false);setLinkError("");
  async function load(){try{
   if(offline)throw Error("Reconnect to load this coach.");
   if(!safeId.test(id))throw Error("Invalid coach profile.");
   const result=await supabase.from("coaches").select("id,name,country,city,website,current_team_id").eq("id",id).eq("active",true).abortSignal(ctrl.signal).maybeSingle();
   if(result.error)throw Error("Coach profile could not load.");
   if(!result.data||result.data.id!==id)throw Error("This coach is not currently listed.");
   if(!active)return;const value=result.data as Coach;setCoach(value);
   if(value.current_team_id&&safeId.test(value.current_team_id)){
    try{const result=await supabase.from("teams").select("id,name,basketball_type,league_name").eq("id",value.current_team_id).eq("active",true).abortSignal(ctrl.signal).maybeSingle();if(active){if(result.error)setTeamError(true);else if(result.data?.id===value.current_team_id)setTeam(result.data as Team);}}
    catch{if(active)setTeamError(true);}
   }
  }catch(e){if(active)setError(e instanceof Error?e.message:"Coach profile unavailable.");}
  finally{clearTimeout(timer);if(active)setLoading(false);}}
  void load();return()=>{active=false;clearTimeout(timer);ctrl.abort();};
 },[id,offline,revision,refresh]);
 const url=website(coach?.website??null);
 return <ScrollView style={{flex:1,backgroundColor:t.background}} contentContainerStyle={{padding:16,gap:12,paddingBottom:100}} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>setRefresh(v=>v+1)}/>}>
  {loading?<Skeleton profile/>:error||!coach?<><Text accessibilityRole="alert" style={{color:t.foreground}}>{error||"Coach unavailable."}</Text><Button secondary onPress={()=>setRefresh(v=>v+1)}>Try again</Button></>:<>
   <Text style={{color:t.accent,fontWeight:"800"}}>COACH PROFILE</Text>
   <Text accessibilityRole="header" style={{color:t.foreground,fontFamily:"HoopCheckDisplay",fontSize:30}}>{coach.name}</Text>
   <Text style={{color:t.muted}}>{[coach.city,coach.country].filter(Boolean).join(", ")||"Location not listed"}</Text>
   <GlassCard style={{gap:9}}><Text style={{color:t.foreground,fontWeight:"800",fontSize:18}}>Current team</Text>
   {team?<><Text style={{color:t.foreground}}>{team.name}</Text>{team.league_name?<Text style={{color:t.muted}}>{team.league_name}</Text>:null}
   {team.basketball_type==="mens"?<Button secondary onPress={()=>router.push({pathname:"/teams/[id]",params:{id:team.id}})}>View team</Button>:null}</>:<Text style={{color:t.muted}}>{teamError?"Team details unavailable. Refresh to try again.":coach.current_team_id?"Current team details not listed.":"Current team not listed."}</Text>}
   </GlassCard>
   {url?<Button secondary onPress={()=>{setLinkError("");void Linking.openURL(url).catch(()=>setLinkError("Could not open the listed website."));}}>Open listed website</Button>:null}
   {linkError?<Text accessibilityRole="alert" style={{color:t.foreground}}>{linkError}</Text>:null}
   <GlassCard style={{gap:9}}><Text style={{color:t.foreground,fontWeight:"800",fontSize:18}}>Reviews & career history</Text><Text style={{color:t.muted}}>Full reviews and coach history remain on the authenticated website. Membership and review permissions still apply.</Text>
   <Button secondary onPress={()=>router.push({pathname:"/web",params:{path:"/coaches/"+coach.id}})}>View reviews & career history on web</Button></GlassCard>
   <Text style={{color:t.muted}}>Directory listings are not endorsements. Confirm employment and contract terms independently.</Text>
  </>}
 </ScrollView>;
}
