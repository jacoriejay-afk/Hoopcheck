import { useCallback,useEffect,useRef,useState } from "react";
import { AppState,Text,View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button,Input,SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNetwork } from "../src/native/network";
import { isStandingsCurrent,readNativeStandings,validStandingsSeason,type NativeStandings,type StandingsSide } from "../src/native/leagueStandings";
export function LeagueStandings({id,side,season}:{id:string;side:StandingsSide;season?:string|null}){
 const theme=useEntryTheme(),{offline}=useNetwork();
 const origin=process.env.EXPO_PUBLIC_HOOPDATA_STANDINGS_PREVIEW_ORIGIN;
 const [draft,setDraft]=useState(season&&validStandingsSeason(season)?season:"");
 const [view,setView]=useState<NativeStandings|null>(null);
 const [status,setStatus]=useState<"idle"|"loading"|"unavailable"|"error"|"expired">("idle");
 const [group,setGroup]=useState(0),[limit,setLimit]=useState(20);
 const request=useRef<AbortController|null>(null);
 const cancel=useCallback(()=>{request.current?.abort();request.current=null;},[]);
 const reset=useCallback(()=>{cancel();setView(null);setStatus("idle");},[cancel]);
 useFocusEffect(useCallback(()=>()=>{reset();},[reset]));
 useEffect(()=>{if(offline)reset();},[offline,reset]);
 useEffect(()=>{
  if(!view)return;
  const expire=()=>{if(!isStandingsCurrent(view)){setView(null);setStatus("expired");}};
  const timer=setTimeout(expire,Math.max(0,Date.parse(view.expiresAt)-Date.now()));
  const listener=AppState.addEventListener("change",state=>{if(state==="active")expire();});
  return()=>{clearTimeout(timer);listener.remove();};
 },[view]);
 async function load(){
  if(!origin||offline||request.current||!validStandingsSeason(draft.trim()))return;
  const ctl=new AbortController();request.current=ctl;
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;ctl.abort();},12000);
  setView(null);setStatus("loading");setGroup(0);setLimit(20);
  try{
   const result=await readNativeStandings(origin,id,draft.trim(),side,ctl.signal);
   if(request.current!==ctl)return;
   if(!result||!isStandingsCurrent(result)){setStatus("unavailable");return;}
   setView(result);setStatus("idle");
  }catch{if(request.current===ctl&&(!ctl.signal.aborted||timedOut))setStatus("error");}
  finally{clearTimeout(timer);if(request.current===ctl)request.current=null;}
 }
 if(!origin)return null;
 const current=!offline&&view&&isStandingsCurrent(view)?view:null;
 const selected=current?.groups[group];
 const value=(n:number|null)=>n===null?"—":String(n);
 return <View style={{gap:theme.spacing.sm,marginTop:theme.spacing.lg}}>
  <SectionHeader>Official standings</SectionHeader>
  <Text style={{color:theme.muted,...theme.type.caption}}>Licensed preview · only reviewed competitions and current data are shown.</Text>
  <Input accessibilityLabel="Standings season" value={draft} placeholder="Season, e.g. 2026-2027" maxLength={9} onChangeText={v=>{reset();setDraft(v);}} />
  <Button secondary disabled={offline||status==="loading"||!validStandingsSeason(draft.trim())} onPress={()=>void load()}>{status==="loading"?"Checking standings…":"Check standings"}</Button>
  {offline?<Text style={{color:theme.muted}}>Reconnect to check standings.</Text>:status==="unavailable"?<Text accessibilityLiveRegion="polite" style={{color:theme.muted}}>Standings are not verified or licensed for this competition. No estimated rankings are shown.</Text>:status==="expired"?<Text accessibilityLiveRegion="polite" style={{color:theme.muted}}>Standings expired. Check again for an update.</Text>:status==="error"?<Text accessibilityRole="alert" style={{color:theme.muted}}>Standings could not load. Try again.</Text>:null}
  {current&&selected?<View style={{gap:theme.spacing.sm}}>
    <Text style={{color:theme.foreground,fontWeight:"800"}}>{current.season} · {current.source}</Text>
    {current.attribution?<Text style={{color:theme.muted}}>{current.attribution}</Text>:null}
    <Text style={{color:theme.muted,...theme.type.caption}}>Observed {new Date(current.observedAt).toLocaleString()} · — means not reported</Text>
    <Text accessibilityRole="header" style={{color:theme.foreground,fontWeight:"800"}}>{[selected.stage,selected.group].filter(Boolean).join(" · ")||"Competition table"}</Text>
    {current.groups.length>1?<View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}><Button secondary disabled={group===0} onPress={()=>{setGroup(g=>g-1);setLimit(20);}}>Previous group</Button><Button secondary disabled={group===current.groups.length-1} onPress={()=>{setGroup(g=>g+1);setLimit(20);}}>Next group</Button><Text style={{color:theme.muted}}>{group+1} / {current.groups.length}</Text></View>:null}
    {selected.rows.slice(0,limit).map(r=><View key={r.teamId} style={{borderBottomWidth:1,borderColor:theme.border,paddingVertical:10,gap:4}}>
      <Text style={{color:theme.foreground,fontWeight:"800"}}>{r.position}. {r.name}</Text>
      <Text style={{color:theme.muted,...theme.type.caption}}>Played {value(r.played)} · Wins {value(r.wins)} · Losses {value(r.losses)}</Text>
      <Text style={{color:theme.muted,...theme.type.caption}}>Points for {value(r.pointsFor)} · Against {value(r.pointsAgainst)}</Text>
    </View>)}
    {limit<selected.rows.length?<Button secondary onPress={()=>setLimit(n=>n+20)}>Show more teams</Button>:null}
  </View>:null}
 </View>;
}
