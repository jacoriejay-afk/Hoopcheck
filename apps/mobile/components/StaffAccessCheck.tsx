import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useEntryTheme } from "../src/theme";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { readWithDeadline } from "../src/native/readDeadline";

export function StaffAccessCheck(){
  const {account}=useNativeAccount(),active=useActiveScreen();
  return active&&account?<Check key={account.user.id} uid={account.user.id}/>:null;
}
function Check({uid}:{uid:string}){
  const theme=useEntryTheme(),{retry}=useNativeAccount();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const lock=useRef(false),live=useRef(false);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  async function check(){
    if(lock.current)return;
    lock.current=true;setBusy(true);setMessage("");
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
    try{
      const session=await readWithDeadline(()=>supabase.auth.getSession());
      if(session.error||!session.data.session||session.data.session.user.id!==uid||!live.current||ctrl.signal.aborted)throw Error("Session unavailable.");
      const token=session.data.session.access_token,header="Bearer "+token;
      const user=await readWithDeadline(()=>supabase.auth.getUser(token));
      if(user.error||user.data.user?.id!==uid||!user.data.user.email_confirmed_at||!live.current||ctrl.signal.aborted)throw Error("Session unavailable.");
      const [role,staff,owner]=await Promise.all([
        supabase.rpc("get_current_user_admin_role").setHeader("Authorization",header).abortSignal(ctrl.signal),
        supabase.rpc("is_current_user_admin_or_moderator").setHeader("Authorization",header).abortSignal(ctrl.signal),
        supabase.rpc("is_approved_claim_owner").setHeader("Authorization",header).abortSignal(ctrl.signal),
      ]);
      const after=await readWithDeadline(()=>supabase.auth.getSession());
      if(!live.current||ctrl.signal.aborted||after.error||after.data.session?.user.id!==uid)return;
      if(role.error||staff.error||owner.error||typeof staff.data!=="boolean"||typeof owner.data!=="boolean")throw Error("Role unavailable.");
      const label=staff.data===true?(role.data==="admin"?"Administrator":role.data==="moderator"?"Moderator":"Staff"):"Not granted";
      setMessage("Staff access: "+label+"\nOwner HQ approval: "+(owner.data===true?"Granted":"Not granted")+"\nNo permissions were changed. If access should be granted, contact authorized HoopCheck support.");
    }catch{if(live.current)setMessage("Access could not be verified. Complete sign-in/security verification and try again.");}
    finally{clearTimeout(timer);lock.current=false;if(live.current)setBusy(false);}
  }
  return <View style={{gap:6}}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void check()} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:theme.accent,fontWeight:"700"}}>{busy?"Verifying access…":"Check administration access"}</Text></Pressable>
    {message?<><Text accessibilityRole="alert" style={{color:theme.foreground}}>{message}</Text><Pressable accessibilityRole="button" onPress={retry} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:theme.accent}}>Refresh account access</Text></Pressable></>:null}
  </View>;
}
