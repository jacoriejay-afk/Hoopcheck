import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { readWithDeadline } from "../src/native/readDeadline";
import { useEntryTheme } from "../src/theme";

export function AdminSafetyCenter(){
  const {account}=useNativeAccount(),active=useActiveScreen();
  return active&&account?<StaffSafety key={account.user.id} uid={account.user.id}/>:null;
}
type Ticket={id:string;subject:string;status:string;priority:string;created_at:string};
function StaffSafety({uid}:{uid:string}){
  const t=useEntryTheme();
  const [verified,setVerified]=useState(false),[expanded,setExpanded]=useState(false);
  const [tickets,setTickets]=useState<Ticket[]|null>(null),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let live=true;const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),15000);
    setVerified(false);setTickets(null);setError("");
    async function load(){
      try{
        const session=await readWithDeadline(()=>supabase.auth.getSession());
        if(session.error||!session.data.session||session.data.session.user.id!==uid||!live||controller.signal.aborted)return;
        const token=session.data.session.access_token;
        const actual=await readWithDeadline(()=>supabase.auth.getUser(token));
        if(actual.error||actual.data.user?.id!==uid||!actual.data.user.email_confirmed_at||!live||controller.signal.aborted)return;
        const role=await supabase.rpc("is_current_user_admin_or_moderator").setHeader("Authorization","Bearer "+token).abortSignal(controller.signal);
        if(role.error||role.data!==true||!live||controller.signal.aborted)return;
        const result=expanded?await supabase.from("support_tickets").select("id,subject,status,priority,created_at").eq("category","security").order("created_at",{ascending:false}).limit(50).setHeader("Authorization","Bearer "+token).abortSignal(controller.signal):null;
        const after=await readWithDeadline(()=>supabase.auth.getSession());
        const roleAfter=await supabase.rpc("is_current_user_admin_or_moderator").setHeader("Authorization","Bearer "+token).abortSignal(controller.signal);
        if(!live||controller.signal.aborted||after.error||after.data.session?.user.id!==uid||roleAfter.error||roleAfter.data!==true)return;
        setVerified(true);
        if(result){if(result.error)setError("Safety reports could not load. Try again.");else setTickets((result.data??[]) as Ticket[]);}
      }catch{if(live){setVerified(false);setTickets(null);setError("");}}
      finally{clearTimeout(deadline);}
    }
    void load();return()=>{live=false;clearTimeout(deadline);controller.abort();};
  },[uid,expanded,revision]);
  if(!verified)return null;
  return <View style={{gap:8}}>
    <Text accessibilityRole="header" style={{color:t.foreground,fontFamily:"HoopCheckDisplay",fontSize:21}}>Administration</Text>
    <Pressable testID="settings-staff-safety" accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)} style={{minHeight:48,justifyContent:"center",borderBottomWidth:1,borderColor:t.border}}><Text style={{color:t.foreground,fontWeight:"700"}}>Admin & moderator safety center</Text></Pressable>
    {expanded?<><Text style={{color:t.muted}}>Confidential security tickets · read-only overview. Reports are allegations, not verified findings.</Text>
    {error?<Text accessibilityRole="alert" style={{color:t.foreground}}>{error}</Text>:!tickets?<Text accessibilityRole="progressbar" style={{color:t.muted}}>Checking safety reports…</Text>:tickets.length===0?<Text style={{color:t.muted}}>No security tickets returned.</Text>:tickets.map(ticket=><View key={ticket.id} style={{gap:4,borderBottomWidth:1,borderColor:t.border,paddingVertical:8}}><Text style={{color:t.foreground,fontWeight:"700"}}>{ticket.subject}</Text><Text style={{color:t.muted}}>{ticket.status} · {ticket.priority} · {new Date(ticket.created_at).toLocaleDateString()}</Text></View>)}
    {tickets?.length===50?<Text style={{color:t.muted}}>Showing the latest 50 security tickets.</Text>:null}
    <Pressable accessibilityRole="button" onPress={()=>setRevision(v=>v+1)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent}}>Refresh safety reports</Text></Pressable></>:null}
  </View>;
}
