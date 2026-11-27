import { useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEntryTheme } from "../../src/theme";
import { Button, GlassCard } from "../../src/primitives";
import { supabase } from "../../src/lib/supabase";
import { useNetwork } from "../../src/native/network";
import { Skeleton } from "../../components/Motion";
import { readReviewAccess, type ReviewAccess } from "../../src/native/reviewAccess";
type Assignment={id:string;team_id:string;role:string|null;season:string|null;start_date:string|null;end_date:string|null};
type History=Assignment & {teamName:string|null};
const apiOrigin=process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";

type Coach={id:string;name:string;country:string|null;city:string|null;current_team_id:string|null};
type Team={id:string;name:string;basketball_type:string|null;league_name:string|null};
const safeId=/^[A-Za-z0-9_-]{1,100}$/;
export default function CoachProfile(){
 const params=useLocalSearchParams<{id?:string}>(); const id=typeof params.id==="string"?params.id:"";
 return <CoachDetails key={id} id={id}/>;
}
function CoachDetails({id}:{id:string}){
 const t=useEntryTheme(),router=useRouter(),{offline,revision}=useNetwork();
 const [refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true),[coach,setCoach]=useState<Coach|null>(null),[team,setTeam]=useState<Team|null>(null),[error,setError]=useState(""),[teamError,setTeamError]=useState(false);
 useEffect(()=>{
  let active=true;const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  setLoading(true);setCoach(null);setTeam(null);setError("");setTeamError(false);
  async function load(){try{
   if(offline)throw Error("Reconnect to load this coach.");
   if(!safeId.test(id))throw Error("Invalid coach profile.");
   const result=await supabase.from("coaches").select("id,name,country,city,current_team_id").eq("id",id).eq("active",true).abortSignal(ctrl.signal).maybeSingle();
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
 const [history,setHistory]=useState<History[]|null>(null),[historyError,setHistoryError]=useState(false);
 const [reviewAccess,setReviewAccess]=useState<ReviewAccess|null>(null),[reviewError,setReviewError]=useState(false),[authRevision,setAuthRevision]=useState(0);
 const generation=useRef(0);
 useEffect(()=>{
   const {data}=supabase.auth.onAuthStateChange(()=>{generation.current++;setReviewAccess(null);setAuthRevision(n=>n+1);});
   return ()=>data.subscription.unsubscribe();
 },[]);
 useEffect(()=>{
   let live=true;const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),15000);
   setHistory(null);setHistoryError(false);
   if(!coach||offline){clearTimeout(timeout);return;}
   void (async()=>{try{
     const rows=await supabase.from("coach_team_assignments").select("id,team_id,role,season,start_date,end_date").eq("coach_id",id).eq("active",true).order("season",{ascending:false}).limit(100).abortSignal(ctrl.signal);
     if(rows.error)throw rows.error;
     const assignments=(rows.data??[]) as Assignment[];
     const ids=[...new Set(assignments.map(row=>row.team_id).filter(value=>typeof value==="string"&&safeId.test(value)))];
     const names=ids.length?await supabase.from("teams").select("id,name").in("id",ids).abortSignal(ctrl.signal):{data:[],error:null};
     if(names.error)throw names.error;
     const lookup=new Map((names.data??[]).map(row=>[row.id,row.name]));
     if(live)setHistory(assignments.map(row=>({...row,teamName:lookup.get(row.team_id)??null})));
   }catch{if(live)setHistoryError(true);}finally{clearTimeout(timeout);}})();
   return ()=>{live=false;clearTimeout(timeout);ctrl.abort();};
 },[coach,id,offline,refresh,revision]);
 useEffect(()=>{
   let live=true;const current=generation.current,ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),15000);
   setReviewAccess(null);setReviewError(false);
   if(!coach||offline){clearTimeout(timeout);return;}
   void(async()=>{try{
     const before=await supabase.auth.getSession();
     if(before.error||!before.data.session)throw Error("Sign in required");
     const result=await readReviewAccess(apiOrigin,before.data.session.access_token,id,ctrl.signal,fetch,"coach");
     const after=await supabase.auth.getSession();
     if(after.error||after.data.session?.user.id!==before.data.session.user.id)throw Error("Account changed");
     if(live&&current===generation.current)setReviewAccess(result);
   }catch{if(live&&current===generation.current)setReviewError(true);}finally{clearTimeout(timeout);}})();
   return ()=>{live=false;clearTimeout(timeout);ctrl.abort();};
 },[coach,id,offline,refresh,revision,authRevision]);
 return <ScrollView style={{flex:1,backgroundColor:t.background}} contentContainerStyle={{padding:16,gap:12,paddingBottom:100}} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>setRefresh(v=>v+1)}/>}>
  {loading?<Skeleton profile/>:error||!coach?<><Text accessibilityRole="alert" style={{color:t.foreground}}>{error||"Coach unavailable."}</Text><Button secondary onPress={()=>setRefresh(v=>v+1)}>Try again</Button></>:<>
   <Text style={{color:t.accent,fontWeight:"800"}}>COACH PROFILE</Text>
   <Text accessibilityRole="header" style={{color:t.foreground,fontFamily:"HoopCheckDisplay",fontSize:30}}>{coach.name}</Text>
   <Text style={{color:t.muted}}>{[coach.city,coach.country].filter(Boolean).join(", ")||"Location not listed"}</Text>
   <GlassCard style={{gap:9}}><Text style={{color:t.foreground,fontWeight:"800",fontSize:18}}>Current team</Text>
   {team?<><Text style={{color:t.foreground}}>{team.name}</Text>{team.league_name?<Text style={{color:t.muted}}>{team.league_name}</Text>:null}
   {team.basketball_type==="mens"?<Button secondary onPress={()=>router.push({pathname:"/teams/[id]",params:{id:team.id}})}>View team</Button>:null}</>:<Text style={{color:t.muted}}>{teamError?"Team details unavailable. Refresh to try again.":coach.current_team_id?"Current team details not listed.":"Current team not listed."}</Text>}
   </GlassCard>
   <GlassCard style={{gap:9}}><Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:18}}>Career history</Text>
   {offline?<Text style={{color:t.muted}}>Reconnect to load coaching history.</Text>:historyError?<Text accessibilityRole="alert" style={{color:t.muted}}>Career history unavailable. Pull to retry.</Text>:history===null?<Skeleton review/>:history.length?history.map(row=><View key={row.id} style={{gap:4,paddingVertical:8}}><Text style={{color:t.foreground,fontWeight:"700"}}>{row.teamName||"Team not listed"}</Text><Text style={{color:t.muted}}>{[row.season,row.role].filter(Boolean).join(" · ")||"Season and role not listed"}</Text>{row.start_date||row.end_date?<Text style={{color:t.muted}}>{row.start_date||"Not listed"} — {row.end_date||"Not listed"}</Text>:null}{row.teamName&&safeId.test(row.team_id)?<Button secondary onPress={()=>router.push({pathname:"/teams/[id]",params:{id:row.team_id}})}>View team</Button>:null}</View>):<Text style={{color:t.muted}}>No historical assignments listed.</Text>}
   </GlassCard>
   <GlassCard style={{gap:9}}><Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:18}}>Approved reviews</Text>
   {offline?<Text style={{color:t.muted}}>Reconnect to verify review access. Reviews are not available offline.</Text>:reviewError?<Text accessibilityRole="alert" style={{color:t.muted}}>Review access unavailable. Pull to retry.</Text>:reviewAccess===null?<Skeleton review/>:!reviewAccess.canReadFull?<Text style={{color:t.muted}}>Full reviews require an eligible membership.</Text>:reviewAccess.reviews.length?reviewAccess.reviews.map(review=><View key={review.id} style={{gap:6,paddingVertical:8}}><Text style={{color:t.accent}}>{review.overall_rating==null?"Rating not listed":review.overall_rating+"/5 overall"}</Text>{review.title?<Text style={{color:t.foreground,fontWeight:"700"}}>{review.title}</Text>:null}{review.body?<Text style={{color:t.foreground}}>{review.body}</Text>:null}<Text style={{color:t.muted}}>{new Date(review.created_at).toLocaleDateString()}</Text></View>):<Text style={{color:t.muted}}>No approved reviews available.</Text>}
   </GlassCard>
   <Text style={{color:t.muted}}>Directory listings are not endorsements. Confirm employment and contract terms independently.</Text>
  </>}
 </ScrollView>;
}
