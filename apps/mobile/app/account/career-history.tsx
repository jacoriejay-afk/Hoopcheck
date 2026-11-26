import {useEffect,useRef,useState} from "react";
import {ScrollView,Text,TextInput,View} from "react-native";
import {Stack} from "expo-router";
import {SafeAreaView} from "react-native-safe-area-context";
import {Button} from "../../src/primitives";
import {useEntryTheme} from "../../src/theme";
import {useNativeAccount} from "../../src/native/useNativeAccount";
import {supabase} from "../../src/lib/supabase";
import {nativeCareerClaimsEnabled,requestCareer,type Club,type History} from "../../src/native/careerClaims";
const origin=process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim()||"https://hoopcheck.online";
export default function CareerClaimsScreen(){
 const t=useEntryTheme(),{account,loading}=useNativeAccount();
 return <SafeAreaView edges={["left","right","bottom"]} style={{flex:1,backgroundColor:t.background}}>
  <Stack.Screen options={{title:"Career history"}}/>
  {!nativeCareerClaimsEnabled?<Text style={{color:t.muted,padding:16}}>Career claims are not available yet.</Text>:loading&&!account?<Text style={{color:t.muted,padding:16}}>Checking account…</Text>:account?.user.accountType==="player"?<Intake key={account.user.id} userId={account.user.id}/>:<Text style={{color:t.muted,padding:16}}>Career history is available to signed-in players.</Text>}
 </SafeAreaView>;
}
function Intake({userId}:{userId:string}){
 const t=useEntryTheme();
 const [name,setName]=useState(""),[season,setSeason]=useState(""),[category,setCategory]=useState<"mens"|"womens">("mens");
 const [country,setCountry]=useState(""),[city,setCity]=useState(""),[league,setLeague]=useState(""),[division,setDivision]=useState("");
 const [results,setResults]=useState<Club[]>([]),[searched,setSearched]=useState(false),[more,setMore]=useState(false),[missing,setMissing]=useState(false);
 const [history,setHistory]=useState<History|null>(null),[historyError,setHistoryError]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const active=useRef(false),lock=useRef(false),version=useRef(0);
 const [sessionInvalidated,setSessionInvalidated]=useState(false);
 async function api<T>(path:"claims"|"historical-clubs",options:{query?:URLSearchParams;body?:object}={}){
  const epoch=version.current,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!active.current||epoch!==version.current||session?.user.id!==userId)throw Error("Your session changed.");
   const data=await requestCareer<T>(origin,session.access_token,path,{...options,signal:controller.signal});
   const after=await supabase.auth.getSession();
   if(!active.current||epoch!==version.current||after.data.session?.user.id!==userId)throw Error("Your session changed.");
   return data;
  }finally{clearTimeout(timer);}
 }
 async function refresh(){
  try{const data=await api<History>("claims");if(active.current){setHistory(data);setHistoryError("");}}
  catch{if(active.current){setHistory(null);setHistoryError("Saved claims could not load.");}}
 }
 useEffect(()=>{
  active.current=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
   if(session?.user.id!==userId){active.current=false;version.current++;setSessionInvalidated(true);setHistory(null);setResults([]);setSearched(false);setMore(false);setMissing(false);setName("");setSeason("");setCountry("");setCity("");setLeague("");setDivision("");setCategory("mens");setMessage("");setError("");setHistoryError("");setBusy(false);}
  });
  void refresh();return()=>{active.current=false;version.current++;subscription.unsubscribe();};
 // The parent remounts this component on account changes.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[userId]);
 async function perform(action:()=>Promise<void>){
  if(lock.current)return;if(!active.current)return;lock.current=true;setBusy(true);setError("");setMessage("");
  try{await action();}catch(e){if(active.current)setError(e instanceof Error?e.message:"Unable to complete the request.");}finally{lock.current=false;if(active.current)setBusy(false);}
 }
 function reset(){setResults([]);setSearched(false);setMore(false);setMessage("");setError("");}
 async function search(){await perform(async()=>{setResults([]);setSearched(false);const data=await api<{results:Club[];hasMore:boolean}>("historical-clubs",{query:new URLSearchParams({q:name,season,basketballType:category})});setResults(data.results);setMore(data.hasMore);setSearched(true);});}
 async function save(body:object){await perform(async()=>{await api("claims",{body});setMessage("Saved privately. Verification is pending; reviews are not unlocked.");await refresh();});}
 const label=(row:{season_start_year:number;season_end_year:number})=>row.season_start_year===row.season_end_year?String(row.season_start_year):row.season_start_year+"–"+row.season_end_year;
 const field=(title:string,value:string,change:(v:string)=>void,maxLength=100,placeholder="")=><View style={{gap:5}}><Text style={{color:t.foreground,fontWeight:"600"}}>{title}</Text><TextInput accessibilityLabel={title} value={value} onChangeText={change} editable={!busy} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={t.muted} style={{minHeight:48,borderWidth:1,borderColor:t.border,borderRadius:12,padding:12,color:t.foreground,backgroundColor:t.input}}/></View>;
 if(sessionInvalidated)return <Text accessibilityRole="alert" style={{color:t.muted,padding:16}}>Your session changed. Reopen career history.</Text>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,paddingBottom:110,gap:14,maxWidth:680,width:"100%",alignSelf:"center"}}>
  <Text accessibilityRole="header" style={{color:t.foreground,fontSize:26,fontWeight:"900"}}>Your playing history</Text>
  <Text style={{color:t.muted}}>Search by the club name and season you played, including renamed, relegated or archived clubs. Claims are private and require separate verification.</Text>
  <View style={{flexDirection:"row",gap:8}}><Button secondary={category!=="mens"} disabled={busy} onPress={()=>{setCategory("mens");reset();}}>Men’s</Button><Button secondary={category!=="womens"} disabled={busy} onPress={()=>{setCategory("womens");reset();}}>Women’s</Button></View>
  {field("Team name at the time",name,v=>{setName(v);reset();},160)}
  {field("Season",season,v=>{setSeason(v);reset();},24,"2023-24")}
  <Button disabled={busy||name.trim().length<2||!season.trim()} onPress={()=>void search()}>Search historical teams</Button>
  {searched?<View style={{gap:10}}>{results.length?results.map(row=><View key={row.id} style={{gap:5,paddingVertical:8,borderBottomWidth:1,borderColor:t.border}}><Text style={{color:t.foreground,fontWeight:"800"}}>{row.historical_name}</Text><Text style={{color:t.muted}}>{[row.historical_league,row.historical_division,row.historical_country,row.club_state==="archived"?"Archived":row.club_state==="renamed"?"Renamed":""].filter(Boolean).join(" · ")}</Text><Button secondary disabled={busy} onPress={()=>void save({kind:"claim",id:row.team_id||row.womens_team_id,source:row.team_id?"teams":"womens_teams",season})}>Add pending claim</Button></View>):<Text style={{color:t.muted}}>No historical match. Request your club below.</Text>}{more?<Text style={{color:t.muted}}>More matches exist. Refine the name.</Text>:null}</View>:null}
  <Button secondary disabled={busy} onPress={()=>setMissing(v=>!v)}>{missing?"Hide club request":"Team not listed? Request a club"}</Button>
  {missing?<View style={{gap:10}}>{field("Country",country,setCountry)}{field("City (optional)",city,setCity)}{field("League at the time",league,setLeague,160)}{field("Division (optional)",division,setDivision)}<Button disabled={busy||!name.trim()||!country.trim()||!league.trim()||!season.trim()} onPress={()=>void save({kind:"missing_club",name,country,city,league,division,basketballType:category,season})}>Request historical club</Button></View>:null}
  {busy?<Text accessibilityLiveRegion="polite" style={{color:t.muted}}>Working…</Text>:null}{error?<Text accessibilityRole="alert" style={{color:t.foreground}}>{error}</Text>:null}{message?<Text accessibilityLiveRegion="polite" style={{color:t.foreground}}>{message}</Text>:null}
  <Text accessibilityRole="header" style={{color:t.foreground,fontSize:19,fontWeight:"800"}}>Saved career claims</Text>
  {historyError?<><Text style={{color:t.muted}}>{historyError}</Text><Button secondary disabled={busy} onPress={()=>void refresh()}>Retry history</Button></>:null}
  {history?<>{!history.claims.length&&!history.missingClubs.length?<Text style={{color:t.muted}}>No claims yet.</Text>:null}{history.claims.map(row=><Text key={row.id} style={{color:t.foreground}}>{label(row)} · {row.womens_team_id?"Women’s":"Men’s"} team · {row.verification_status}</Text>)}{history.missingClubs.map(row=><Text key={row.id} style={{color:t.foreground}}>{row.historical_name} · {label(row)} · {row.status}</Text>)}{history.hasMore?<Text style={{color:t.muted}}>Showing the most recent claims.</Text>:null}</>:null}
 </ScrollView>;
}
