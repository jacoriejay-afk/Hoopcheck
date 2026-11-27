import { useEffect,useState } from "react";
import { ScrollView,Pressable,Text,View } from "react-native";
import { Sheet } from "./Sheet";
import { Button,Input } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { readTeamFacets,EMPTY_TEAM_FACET,type TeamFacet } from "../src/native/teamDirectory";

type Options=Awaited<ReturnType<typeof readTeamFacets>>;
export function TeamDirectoryFilters({women,value,onClose,onApply}:{women:boolean;value:TeamFacet;onClose:()=>void;onApply:(facet:TeamFacet)=>void}){
 const t=useEntryTheme();
 const [chosen,setChosen]=useState(value),[options,setOptions]=useState<Options|null>(null),[search,setSearch]=useState(""),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 const [stage,setStage]=useState<"country"|"league">(value.country?"league":"country");
 useEffect(()=>{
  const controller=new AbortController();let alive=true;const deadline=setTimeout(()=>controller.abort(),15000);
  setOptions(null);setError("");
  void readTeamFacets(supabase,women,controller.signal).then(result=>{if(alive&&!controller.signal.aborted)setOptions(result);else if(alive)setError("Filters timed out. Search still works.");}).catch(()=>{if(alive)setError("Filters unavailable. Search still works.");}).finally(()=>clearTimeout(deadline));
  return()=>{alive=false;clearTimeout(deadline);controller.abort();};
 },[women,revision]);
 const needle=search.trim().toLocaleLowerCase();
 const countries=(options?.countries??[]).filter(row=>row.country.toLocaleLowerCase().includes(needle));
 const leagues=(options?.countries.find(row=>row.country===chosen.country)?.leagues??[]).filter(name=>name.toLocaleLowerCase().includes(needle));
 return <Sheet open onClose={onClose} title="Country and league">
  <View style={{gap:8}}>
   <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}><Button secondary onPress={()=>{setStage("country");setSearch("");}}>Country: {chosen.country||"All"}</Button><Button secondary disabled={!chosen.country} onPress={()=>{setStage("league");setSearch("");}}>League: {chosen.league||"All"}</Button></View>
   <Input accessibilityLabel={stage==="country"?"Search country filters":"Search league filters"} placeholder={stage==="country"?"Search countries":"Search leagues"} value={search} onChangeText={setSearch}/>
   {!options&&!error?<Text style={{color:t.muted}}>Loading directory labels…</Text>:null}
   {error?<><Text accessibilityRole="alert" style={{color:t.muted}}>{error}</Text><Button secondary onPress={()=>setRevision(n=>n+1)}>Retry filters</Button></>:null}
   {options&&!options.complete?<Text style={{color:t.muted,fontSize:12}}>Showing available labels from a bounded directory scan. Use team search for other clubs.</Text>:null}
   <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{maxHeight:260}}>
    <Pressable accessibilityRole="button" onPress={()=>{if(stage==="country"){setChosen(EMPTY_TEAM_FACET);setSearch("");}else setChosen(c=>({...c,league:""}));}} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent}}>All {stage==="country"?"countries":"leagues"}</Text></Pressable>
    {stage==="country"?countries.map(row=><Pressable key={row.country} accessibilityRole="button" accessibilityState={{selected:chosen.country===row.country}} onPress={()=>{setChosen({country:row.country,league:""});setStage("league");setSearch("");}} style={{minHeight:44,justifyContent:"center",borderBottomWidth:1,borderColor:t.border}}><Text style={{color:t.foreground}}>{row.country}</Text></Pressable>):leagues.map(name=><Pressable key={name} accessibilityRole="button" accessibilityState={{selected:chosen.league===name}} onPress={()=>setChosen(c=>({...c,league:name}))} style={{minHeight:44,justifyContent:"center",borderBottomWidth:1,borderColor:t.border}}><Text style={{color:chosen.league===name?t.accent:t.foreground}}>{name}</Text></Pressable>)}
    {options&&(stage==="country"?countries.length===0:leagues.length===0)?<Text style={{color:t.muted,paddingVertical:8}}>No matching labels.</Text>:null}
   </ScrollView>
   <Button onPress={()=>onApply(chosen)}>Apply filters</Button>
   <Button secondary onPress={()=>onApply(EMPTY_TEAM_FACET)}>Reset filters</Button>
  </View>
 </Sheet>;
}
