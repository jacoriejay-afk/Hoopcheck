import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { readWithDeadline } from "../src/native/readDeadline";
import { isFeedId } from "../src/native/feedClient";

export function ConversationSafety({uid,requestId,peerId,onBlocked}:{uid:string;requestId:string;peerId:string;onBlocked:()=>void}){
  const t=useEntryTheme(),{account}=useNativeAccount(),active=useActiveScreen();
  const [mode,setMode]=useState<"report"|"block"|null>(null),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const lock=useRef(false),current=useRef(false);
  useEffect(()=>{current.current=active&&account?.user.id===uid;return()=>{current.current=false;};},[active,account?.user.id,uid]);
  if(!active||account?.user.id!==uid||!isFeedId(uid)||!isFeedId(requestId)||!isFeedId(peerId)||uid===peerId)return null;
  async function submit(){
    const action=mode,clean=reason.trim();
    if(!current.current||lock.current||!action||(action==="report"&&(clean.length<10||clean.length>500)))return;
    lock.current=true;setBusy(true);setNotice("");
    const ctrl=new AbortController(),deadline=setTimeout(()=>ctrl.abort(),15000);
    try{
      const session=await readWithDeadline(()=>supabase.auth.getSession());
      if(session.error||!session.data.session||session.data.session.user.id!==uid||!current.current||ctrl.signal.aborted)throw Error("Verify account.");
      const header="Bearer "+session.data.session.access_token;
      const target=await supabase.from("player_contact_requests").select("id,requester_id,player_id").eq("id",requestId).setHeader("Authorization",header).abortSignal(ctrl.signal).maybeSingle();
      if(target.error||!target.data||!((target.data.requester_id===uid&&target.data.player_id===peerId)||(target.data.player_id===uid&&target.data.requester_id===peerId))||!current.current||ctrl.signal.aborted)throw Error("Conversation unavailable.");
      if(action==="report"){
        const result=await supabase.from("support_tickets").insert({requester_id:uid,subject:"Report a private HoopChat conversation",category:"security",priority:"normal",description:`Conversation ID: ${requestId}\nReported account ID: ${peerId}\nReason: ${clean}`}).setHeader("Authorization",header).abortSignal(ctrl.signal);
        if(result.error)throw Error("Report unconfirmed.");
      }else{
        const result=await supabase.from("user_blocks").insert({blocker_id:uid,blocked_id:peerId}).setHeader("Authorization",header).abortSignal(ctrl.signal);
        if(result.error&&result.error.code!=="23505")throw Error("Block unconfirmed.");
        const row=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",uid).eq("blocked_id",peerId).setHeader("Authorization",header).abortSignal(ctrl.signal).maybeSingle();
        if(row.error||row.data?.blocked_id!==peerId)throw Error("Block unconfirmed.");
      }
      const after=await readWithDeadline(()=>supabase.auth.getSession());
      if(!current.current||after.error||after.data.session?.user.id!==uid||ctrl.signal.aborted)return;
      setMode(null);setReason("");
      if(action==="block")onBlocked();else setNotice("Confidential report submitted. Staff will review the details you provided.");
    }catch{if(current.current)setNotice("Action could not be confirmed. Check your Settings or support tickets before retrying.");}
    finally{clearTimeout(deadline);lock.current=false;if(current.current)setBusy(false);}
  }
  return <View style={{gap:6}}>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:12}}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={()=>{setMode("report");setNotice("");}} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>Report conversation</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={()=>{setMode("block");setNotice("");}} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>Block account</Text></Pressable>
    </View>
    {mode?<><Text style={{color:t.muted}}>{mode==="block"?"Block this member? You can manage blocked accounts in Settings.":"Report a safety concern privately. Only include necessary information; do not include passwords, payment details or unrelated private messages."}</Text>{mode==="report"?<TextInput accessibilityLabel="Conversation report reason" multiline maxLength={500} editable={!busy} value={reason} onChangeText={setReason} placeholder="Reason (10–500 characters)" placeholderTextColor={t.muted} style={{minHeight:64,color:t.foreground,borderWidth:1,borderColor:t.border,padding:8}}/>:null}<Pressable accessibilityRole="button" disabled={busy||(mode==="report"&&reason.trim().length<10)} onPress={()=>void submit()} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>{busy?"Submitting…":mode==="block"?"Confirm block":"Submit confidential report"}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={()=>setMode(null)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.foreground}}>Cancel</Text></Pressable></>:null}
    {notice?<Text accessibilityRole="alert" style={{color:t.foreground}}>{notice}</Text>:null}
  </View>;
}
