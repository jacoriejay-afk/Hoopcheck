import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { readWithDeadline } from "../src/native/readDeadline";
import { isFeedId } from "../src/native/feedClient";

const reelLink=/^Reel: https:\/\/hoopcheck\.online\/feed#post-([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?:\r?\n|$)/i;
function target(ticket:{subject:string;description:string}){
  return ticket.subject==="Report a HoopFeed Reel"?ticket.description.match(reelLink)?.[1]??null:null;
}
export function StaffReelModeration({uid,ticket,onChanged}:{uid:string;ticket:{id:string;subject:string;description:string};onChanged:()=>void}){
  const t=useEntryTheme(),router=useRouter(),active=useActiveScreen(),{account}=useNativeAccount();
  const [reason,setReason]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const lock=useRef(false),live=useRef(false);
  const postId=target(ticket);
  useEffect(()=>{live.current=active&&account?.user.id===uid;return()=>{live.current=false;};},[active,account?.user.id,uid]);
  if(!postId||!isFeedId(postId)||!isFeedId(ticket.id)||!active||account?.user.id!==uid)return null;
  async function hide(){
    const evidence=reason.trim();
    if(lock.current||!live.current||!confirmed||!postId||evidence.length<25||evidence.length>1000)return;
    lock.current=true;setBusy(true);setNotice("");
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
    try{
      const session=await readWithDeadline(()=>supabase.auth.getSession());
      if(session.error||!session.data.session||session.data.session.user.id!==uid||!live.current||ctrl.signal.aborted)throw Error("Verify session.");
      const token=session.data.session.access_token,header="Bearer "+token;
      const actual=await readWithDeadline(()=>supabase.auth.getUser(token));
      if(actual.error||actual.data.user?.id!==uid||!actual.data.user.email_confirmed_at)throw Error("Verify session.");
      const role=await supabase.rpc("is_current_user_admin_or_moderator").setHeader("Authorization",header).abortSignal(ctrl.signal);
      if(role.error||role.data!==true)throw Error("Staff access not verified.");
      const row=await supabase.from("support_tickets").select("id,subject,description").eq("id",ticket.id).eq("category","security").setHeader("Authorization",header).abortSignal(ctrl.signal).maybeSingle();
      if(row.error||!row.data||target(row.data)!==postId||!live.current||ctrl.signal.aborted)throw Error("Ticket changed.");
      const origin=new URL(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim()||"https://hoopcheck.online");
      if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash)throw Error("Invalid API origin.");
      const response=await fetch(new URL("/api/admin/reel-moderation",origin).toString(),{method:"POST",headers:{Authorization:header,"Content-Type":"application/json"},body:JSON.stringify({postId,ticketId:ticket.id,reason:evidence}),redirect:"error",cache:"no-store",signal:ctrl.signal});
      const result=await response.json();
      if(!response.ok||result.hidden!==true)throw Error("Moderation not confirmed.");
      if(live.current){setReason("");setConfirmed(false);setNotice("Video hidden and audit recorded. The ticket still requires a separate status decision.");onChanged();}
    }catch{if(live.current)setNotice("Video removal could not be confirmed. Refresh the case and check the current video state before retrying.");}
    finally{clearTimeout(timer);lock.current=false;if(live.current)setBusy(false);}
  }
  return <View style={{gap:6,borderTopWidth:1,borderColor:t.border,paddingTop:8}}>
    <Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"700"}}>Audited video moderation</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>router.push({pathname:"/feed",params:{post:postId}})} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent}}>Inspect reported post in HoopFeed</Text></Pressable>
    <Text style={{color:t.muted}}>A report is not proof. If the video cannot be inspected, do not remove it through this form.</Text>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} disabled={busy} onPress={()=>setConfirmed(v=>!v)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.foreground}}>{confirmed?"✓ ":""}I independently reviewed the video and confirmed removal is warranted.</Text></Pressable>
    <TextInput accessibilityLabel="Written moderation evidence" value={reason} onChangeText={setReason} maxLength={1000} multiline editable={!busy} placeholder="Specific evidence (25–1,000 characters)" placeholderTextColor={t.muted} style={{minHeight:80,padding:8,color:t.foreground,borderWidth:1,borderColor:t.border}}/>
    <Pressable accessibilityRole="button" disabled={busy||!confirmed||reason.trim().length<25} onPress={()=>void hide()} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>{busy?"Submitting…":"Confirm hide video"}</Text></Pressable>
    {notice?<Text accessibilityRole="alert" style={{color:t.foreground}}>{notice}</Text>:null}
  </View>;
}
