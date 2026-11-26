import { useEffect, useRef, useState } from "react";
import { AppState, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useEntryTheme } from "../src/theme";
import { publicSystemLinks, publicSystemPath } from "../src/native/publicSystemLinks";
import { rememberDestination } from "../src/native/pendingDestination";

/** Navigation only; all existing session, onboarding and lock gates remain intact. */
export function PublicSystemNavigation({ ready, blocked, signedIn }: { ready:boolean; blocked:boolean; signedIn:boolean }) {
 const router=useRouter();
 useEffect(()=>{
  const links=publicSystemLinks;
  if(!links||!ready||blocked)return;
  let alive=true, busy=false;
  const consume=async()=>{
   if(!alive||busy||AppState.currentState!=="active")return;
   busy=true;
   try{
    const route=publicSystemPath(await links.takePending());
    if(!alive||!route)return;
    if(signedIn)router.push(route);
    else{rememberDestination(route);router.replace("/sign-in");}
   }catch{}finally{busy=false;}
  };
  const link=links.addListener("onPublicLink",()=>void consume());
  const foreground=AppState.addEventListener("change",state=>{if(state==="active")void consume();});
  void consume();
  return()=>{alive=false;link.remove();foreground.remove();};
 },[ready,blocked,signedIn,router]);
 return null;
}
export function PublicSystemLinksSetting(){
 const theme=useEntryTheme();
 const [enabled,setEnabled]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const alive=useRef(false),busy=useRef(false);
 useEffect(()=>{
  alive.current=true;
  if(publicSystemLinks)void publicSystemLinks.isEnabled().then(value=>{if(alive.current)setEnabled(value===true);}).catch(()=>{if(alive.current)setMessage("System links unavailable.");}).finally(()=>{if(alive.current)setLoading(false);});
  return()=>{alive.current=false;};
 },[]);
 async function toggle(next:boolean){
  if(!publicSystemLinks||busy.current)return;
  busy.current=true;setLoading(true);setMessage("");
  try{const actual=await publicSystemLinks.setEnabled(next);if(alive.current){setEnabled(actual===true);setMessage(actual?"Public system links enabled.":"Public system links disabled.");}}
  catch{if(alive.current){setEnabled(false);setMessage("Could not confirm indexing or cleanup. Links remain disabled; try again.");}}
  finally{busy.current=false;if(alive.current)setLoading(false);}
 }
 if(!publicSystemLinks)return null;
 return <View style={{gap:8}}><Text accessibilityRole="header" style={{color:theme.foreground,fontSize:19,fontWeight:"800"}}>Siri, Shortcuts &amp; Spotlight</Text><View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12}}><Text style={{color:theme.foreground,flex:1}}>Public basketball directory links</Text><Switch accessibilityLabel="Enable public system links" value={enabled} disabled={loading} onValueChange={value=>void toggle(value)}/></View><Text style={{color:theme.muted}}>Only the teams, women’s teams and leagues categories can appear in system search. No profiles, personal activity or account data are indexed. Turn off to remove the index. Siri shortcuts are available on compatible iOS versions.</Text>{message?<Text accessibilityLiveRegion="polite" style={{color:theme.foreground}}>{message}</Text>:null}</View>;
}
