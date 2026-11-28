import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { reportVisibleFeedContent, validFeedReportTarget } from "../src/native/feedReport";

export function FeedReport({uid,postId,authorId,commentId,active}:{uid:string;postId:string;authorId:string;commentId?:string;active:()=>boolean}){
  const t=useEntryTheme();
  const [open,setOpen]=useState(false),[reason,setReason]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
  const locked=useRef(false),mounted=useRef(false),currentActive=useRef(active);
  useEffect(()=>{currentActive.current=active;},[active]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const current=()=>mounted.current&&currentActive.current();
  const target={uid,postId,authorId,commentId};
  if(!validFeedReportTarget(target))return null;
  async function submit(){
    const clean=reason.trim();
    if(locked.current||sent||!current()||clean.length<10||clean.length>500)return;
    locked.current=true;setBusy(true);setMessage("");
    const ctrl=new AbortController(),deadline=setTimeout(()=>ctrl.abort(),15000);
    try{
      await reportVisibleFeedContent(supabase,target,clean,ctrl.signal,current);
      if(current()){setSent(true);setReason("");setOpen(false);setMessage("Confidential report submitted to HoopCheck staff.");}
    }catch{if(current())setMessage("Report could not be confirmed. Check your support tickets before retrying.");}
    finally{clearTimeout(deadline);locked.current=false;if(current())setBusy(false);}
  }
  return <View style={{gap:5,alignSelf:"stretch"}}>
    <Pressable accessibilityRole="button" accessibilityLabel={commentId?"Report this comment":"Report this post"} accessibilityState={{expanded:open,disabled:sent}} disabled={sent} onPress={()=>setOpen(v=>!v)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontSize:12,fontWeight:"700"}}>{sent?"Reported":"Report"}</Text></Pressable>
    {open?<><Text style={{color:t.muted}}>Tell HoopCheck staff why you are reporting this content. This is private. Do not include passwords or payment details.</Text><TextInput accessibilityLabel="Report reason" multiline maxLength={500} editable={!busy} value={reason} onChangeText={setReason} placeholder="Reason (10–500 characters)" placeholderTextColor={t.muted} style={{color:t.foreground,minHeight:64,borderColor:t.border,borderWidth:1,borderRadius:8,padding:8}}/><Pressable accessibilityRole="button" disabled={busy||reason.trim().length<10} onPress={()=>void submit()} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>{busy?"Submitting…":"Submit confidential report"}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={()=>{setOpen(false);setReason("");}} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.muted}}>Cancel</Text></Pressable></>:null}
    {message?<Text accessibilityRole="alert" style={{color:t.foreground,fontSize:12}}>{message}</Text>:null}
  </View>;
}
