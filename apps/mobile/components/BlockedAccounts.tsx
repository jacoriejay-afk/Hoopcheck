import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { readWithDeadline } from "../src/native/readDeadline";
import { isFeedId } from "../src/native/feedClient";

export function BlockedAccounts() {
  const { account } = useNativeAccount();
  const active = useActiveScreen();
  return account && active ? <BlockList key={account.user.id} uid={account.user.id}/> : null;
}
function BlockList({uid}:{uid:string}) {
  const t=useEntryTheme();
  const [expanded,setExpanded]=useState(false);
  const [revision,setRevision]=useState(0);
  const [rows,setRows]=useState<{id:string;name:string}[]|null>(null);
  const [error,setError]=useState("");
  const [confirm,setConfirm]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const alive=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function bearer(){
    const result=await readWithDeadline(()=>supabase.auth.getSession());
    if(result.error||!result.data.session||result.data.session.user.id!==uid)throw Error("Verify your account again.");
    return result.data.session.access_token;
  }
  useEffect(()=>{
    if(!expanded)return;
    let live=true;const ctrl=new AbortController(),deadline=setTimeout(()=>ctrl.abort(),15000);
    setRows(null);setError("");
    async function load(){
      try{
        const token=await bearer();
        if(!live||ctrl.signal.aborted)return;
        const result=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",uid).order("blocked_id").limit(501).setHeader("Authorization","Bearer "+token).abortSignal(ctrl.signal);
        if(result.error||!Array.isArray(result.data)||result.data.length>500||result.data.some(r=>!isFeedId(r.blocked_id)))throw Error("Blocked accounts could not be verified.");
        const ids=result.data.map(r=>r.blocked_id);
        const names=new Map<string,string>();
        if(ids.length){
          const profiles=await supabase.from("profiles").select("id,display_name").in("id",ids).setHeader("Authorization","Bearer "+token).abortSignal(ctrl.signal);
          if(!profiles.error)for(const p of profiles.data??[])if(typeof p.display_name==="string"&&p.display_name.trim())names.set(p.id,p.display_name.slice(0,200));
        }
        await bearer();
        if(live&&!ctrl.signal.aborted)setRows(ids.map(id=>({id,name:names.get(id)||"Unavailable profile · "+id.slice(0,8)})));
        else if(live)setError("Blocked accounts could not load. Try again.");
      }catch{if(live)setError("Blocked accounts could not load. Try again.");}
      finally{clearTimeout(deadline);}
    }
    void load();return()=>{live=false;clearTimeout(deadline);ctrl.abort();};
  },[uid,expanded,revision]);
  async function unblock(id:string){
    if(lock.current||!rows?.some(row=>row.id===id)||!isFeedId(id)||id===uid)return;
    lock.current=true;setBusy(true);setError("");
    const ctrl=new AbortController(),deadline=setTimeout(()=>ctrl.abort(),15000);
    try{
      const token=await bearer();
      if(!alive.current||ctrl.signal.aborted)return;
      const result=await supabase.from("user_blocks").delete().eq("blocker_id",uid).eq("blocked_id",id).select("blocked_id").setHeader("Authorization","Bearer "+token).abortSignal(ctrl.signal);
      if(result.error||result.data?.length!==1||result.data[0].blocked_id!==id)throw Error("Unblock not confirmed.");
      await bearer();
      if(alive.current){setRows(current=>current?.filter(row=>row.id!==id)??null);setConfirm(null);}
    }catch{if(alive.current){setError("Unblock could not be confirmed. Refresh before retrying.");setRows(null);setConfirm(null);}}
    finally{clearTimeout(deadline);lock.current=false;if(alive.current)setBusy(false);}
  }
  return <View style={{gap:8}}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>{setExpanded(v=>!v);setConfirm(null);}} style={{minHeight:48,justifyContent:"center",borderBottomWidth:1,borderColor:t.border}}><Text style={{color:t.foreground,fontWeight:"700"}}>Blocked accounts {expanded?"−":"+"}</Text></Pressable>
    {expanded?<><Text style={{color:t.muted}}>Unblocking allows the member to interact where your other privacy settings permit.</Text>
    {error?<Text accessibilityRole="alert" style={{color:t.foreground}}>{error}</Text>:!rows?<Text accessibilityRole="progressbar" style={{color:t.muted}}>Loading blocked accounts…</Text>:rows.length===0?<Text style={{color:t.muted}}>No blocked accounts.</Text>:rows.map(row=><View key={row.id} style={{gap:5,paddingVertical:6,borderBottomWidth:1,borderColor:t.border}}><Text style={{color:t.foreground}}>{row.name}</Text>{confirm===row.id?<><Text style={{color:t.muted}}>Unblock this account?</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void unblock(row.id)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>Confirm unblock</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={()=>setConfirm(null)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.foreground}}>Cancel</Text></Pressable></>:<Pressable accessibilityRole="button" accessibilityLabel={"Unblock "+row.name} disabled={busy} onPress={()=>setConfirm(row.id)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent}}>Unblock</Text></Pressable>}</View>)}
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>{setConfirm(null);setRevision(v=>v+1);}} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent}}>Refresh blocked accounts</Text></Pressable></>:null}
  </View>;
}
