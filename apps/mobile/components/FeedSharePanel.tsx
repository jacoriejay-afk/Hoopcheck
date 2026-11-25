import { useEffect, useRef, useState } from "react";
import { Pressable, Share, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { visibleConnections, type PublicConnection } from "../src/native/connectionPresentation";
import { sendFeedShare } from "../src/native/feedClient";
type Props={userId:string;role:string;postId:string;author:string;preview:string;origin:string;token:()=>Promise<string>;onClose:()=>void;active:()=>boolean};
export function FeedSharePanel({userId,role,postId,author,preview,origin,token,onClose,active}:Props){
  const theme=useEntryTheme();
  const [people,setPeople]=useState<PublicConnection[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [sent,setSent]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const live=useRef(false),sending=useRef(false);
  const delivery=useRef<AbortController|null>(null);
  useEffect(()=>{
    live.current=true;
    let valid=true;
    const controller=new AbortController();
    const deadline=setTimeout(()=>controller.abort(),15000);
    setLoading(true);setError("");setPeople([]);
    async function load(){
      try{
        await token();
        const result=await supabase.rpc("get_public_follow_list",{p_mode:"following",p_target_type:null,p_target_id:null,p_user_id:userId}).abortSignal(controller.signal);
        await token();
        if(result.error||controller.signal.aborted)throw Error("Connections could not be loaded.");
        const rows=visibleConnections(result.data,role).filter(row=>row.target_type!=="team"&&row.target_id!==userId);
        if(valid&&active())setPeople([...new Map(rows.map(row=>[row.target_id,row])).values()]);
      }catch{if(valid&&active())setError("Connections could not be loaded. Try again.");}
      finally{clearTimeout(deadline);if(valid&&active())setLoading(false);}
    }
    void load();
    return()=>{valid=false;live.current=false;clearTimeout(deadline);controller.abort();delivery.current?.abort();};
    // Parent keys this panel by the current account/post, callbacks may change on renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userId,role,postId,revision]);
  async function send(recipient:string){
    if(sending.current||!active()||sent.includes(recipient)||!people.some(row=>row.target_id===recipient))return;
    sending.current=true;setBusy(true);setError("");
    const controller=new AbortController();delivery.current=controller;
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const bearer=await token();
      if(!live.current||!active())return;
      await sendFeedShare(origin,bearer,postId,recipient,controller.signal);
      if(live.current&&active())setSent(old=>[...old,recipient]);
    }catch(e){if(live.current&&active())setError(e instanceof Error?e.message:"Share could not be confirmed.");}
    finally{clearTimeout(timer);delivery.current=null;sending.current=false;if(live.current&&active())setBusy(false);}
  }
  async function shareLink(){
    if(!active())return;
    try{await Share.share({title:"HoopFeed",message:"https://hoopcheck.online/feed#post-"+postId});}
    catch{if(live.current&&active())setError("Link sharing is unavailable. Try again.");}
  }
  const matches=people.filter(row=>(row.display_name||"").toLowerCase().includes(query.trim().toLowerCase())).slice(0,30);
  return <View style={{gap:8,padding:10,borderRadius:14,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface}}>
    <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}><Text accessibilityRole="header" style={{color:theme.foreground,fontFamily:"HoopCheckDisplay",fontSize:20}}>Share post</Text><Pressable accessibilityRole="button" accessibilityLabel="Close share panel" onPress={onClose} style={{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"}}><Ionicons name="close" size={22} color={theme.muted}/></Pressable></View>
    <View style={{padding:9,borderRadius:10,backgroundColor:theme.background,gap:3}}><Text style={{color:theme.foreground,fontWeight:"800"}} numberOfLines={1}>{author}</Text><Text style={{color:theme.muted,fontSize:12}} numberOfLines={2}>{preview||"HoopFeed post"}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Share link" onPress={()=>void shareLink()} style={{minHeight:44,flexDirection:"row",alignItems:"center",gap:8}}><Ionicons name="share-outline" size={20} color={theme.accent}/><Text style={{color:theme.accent,fontWeight:"700"}}>Share link</Text></Pressable>
    <Text style={{color:theme.foreground,fontWeight:"700"}}>Send to a HoopCheck connection</Text>
    <Text style={{color:theme.muted,fontSize:12}}>Only eligible connections who can access this post can receive it.</Text>
    <TextInput accessibilityLabel="Search share connections" placeholder="Search connections" placeholderTextColor={theme.muted} value={query} maxLength={100} onChangeText={setQuery} style={{minHeight:44,color:theme.foreground,paddingHorizontal:10,borderWidth:1,borderColor:theme.border,borderRadius:10}}/>
    {loading?<Text style={{color:theme.muted}}>Loading connections…</Text>:!matches.length?<Text style={{color:theme.muted}}>{query?"No matching connections.":"No eligible connections found."}</Text>:matches.map(row=><Pressable key={row.target_id} accessibilityRole="button" accessibilityLabel={"Send post to "+(row.display_name||"HoopCheck member")} accessibilityState={{disabled:busy||sent.includes(row.target_id)}} disabled={busy||sent.includes(row.target_id)} onPress={()=>void send(row.target_id)} style={{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8}}><Text style={{color:theme.foreground,flex:1}} numberOfLines={1}>{row.display_name||"HoopCheck member"}</Text><Text style={{color:theme.accent,fontWeight:"700"}}>{sent.includes(row.target_id)?"Sent":"Send"}</Text></Pressable>)}
    {error?<><Text accessibilityRole="alert" style={{color:theme.foreground}}>{error}</Text>{!people.length?<Pressable accessibilityRole="button" onPress={()=>setRevision(v=>v+1)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:theme.accent}}>Retry connections</Text></Pressable>:null}</>:null}
  </View>;
}
