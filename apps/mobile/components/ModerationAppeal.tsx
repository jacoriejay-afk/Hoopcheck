import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { readWithDeadline } from "../src/native/readDeadline";

export function ModerationAppeal({uid,onSubmitted}:{uid:string;onSubmitted:()=>void}){
  const {account}=useNativeAccount(),active=useActiveScreen(),t=useEntryTheme();
  const [open,setOpen]=useState(false),[reference,setReference]=useState(""),[reason,setReason]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const lock=useRef(false),current=useRef(false);
  useEffect(()=>{current.current=active&&account?.user.id===uid;return()=>{current.current=false;};},[active,account?.user.id,uid]);
  if(!active||account?.user.id!==uid)return null;
  async function submit(){
    const detail=reason.trim(),ref=reference.trim();
    if(lock.current||!current.current||detail.length<25||detail.length>2000||ref.length>160)return;
    lock.current=true;setBusy(true);setMessage("");
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
    try{
      const session=await readWithDeadline(()=>supabase.auth.getSession());
      if(session.error||!session.data.session||session.data.session.user.id!==uid||!current.current||ctrl.signal.aborted)throw Error("Verify account.");
      const token=session.data.session.access_token;
      const verified=await readWithDeadline(()=>supabase.auth.getUser(token));
      if(verified.error||verified.data.user?.id!==uid||!current.current||ctrl.signal.aborted)throw Error("Verify account.");
      const result=await supabase.from("support_tickets").insert({requester_id:uid,subject:"Moderation appeal",category:"security",priority:"normal",description:`Reference (self-reported): ${ref||"Not provided"}\nAppeal: ${detail}`}).setHeader("Authorization","Bearer "+token).abortSignal(ctrl.signal);
      if(result.error)throw Error("Submission not confirmed.");
      if(current.current){setOpen(false);setReference("");setReason("");setMessage("Appeal submitted for private staff review. Track it under My tickets. Submission does not reverse a moderation decision.");onSubmitted();}
    }catch{if(current.current)setMessage("Appeal could not be confirmed. Check My tickets before retrying.");}
    finally{clearTimeout(timer);lock.current=false;if(current.current)setBusy(false);}
  }
  return <View style={{gap:8}}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} disabled={busy} onPress={()=>setOpen(v=>!v)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>Appeal a moderation decision</Text></Pressable>
    {open?<><Text style={{color:t.muted}}>Explain why you believe an action on your own account or content was incorrect. Staff will independently review the request. Do not include passwords, identity documents or unrelated private information.</Text>
    <TextInput accessibilityLabel="Moderation reference (optional)" placeholder="Ticket or content reference (optional)" placeholderTextColor={t.muted} value={reference} onChangeText={setReference} maxLength={160} editable={!busy} style={{minHeight:44,padding:10,color:t.foreground,borderColor:t.border,borderWidth:1}}/>
    <TextInput accessibilityLabel="Appeal reason" placeholder="Reason (25–2,000 characters)" placeholderTextColor={t.muted} value={reason} onChangeText={setReason} maxLength={2000} multiline editable={!busy} style={{minHeight:100,padding:10,color:t.foreground,borderColor:t.border,borderWidth:1}}/>
    <Pressable accessibilityRole="button" disabled={busy||reason.trim().length<25} onPress={()=>void submit()} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>{busy?"Submitting…":"Submit private appeal"}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setOpen(false)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.foreground}}>Cancel</Text></Pressable></>:null}
    {message?<Text accessibilityRole="alert" style={{color:t.foreground}}>{message}</Text>:null}
  </View>;
}
