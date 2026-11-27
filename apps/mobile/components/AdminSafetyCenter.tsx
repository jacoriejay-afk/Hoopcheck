import { StaffReelModeration } from "./StaffReelModeration";
import { useEffect, useRef, useState } from "react";
import { isFeedId } from "../src/native/feedClient";
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
type Ticket={id:string;subject:string;status:string;priority:string;created_at:string;description:string};
function StaffSafety({uid}:{uid:string}){
  const t=useEntryTheme();
  const [verified,setVerified]=useState(false),[expanded,setExpanded]=useState(false);
  const [tickets,setTickets]=useState<Ticket[]|null>(null),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<string|null>(null),[nextStatus,setNextStatus]=useState<string|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const lock=useRef(false),alive=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
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
        const result=expanded?await supabase.from("support_tickets").select("id,subject,status,priority,created_at,description").eq("category","security").order("created_at",{ascending:false}).limit(50).setHeader("Authorization","Bearer "+token).abortSignal(controller.signal):null;
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
  async function updateStatus(ticket:Ticket,status:string){
    if(lock.current||!verified||!expanded||!tickets?.some(row=>row.id===ticket.id)||!isFeedId(ticket.id)||!["open","in_progress","waiting_on_user","resolved","closed"].includes(status))return;
    lock.current=true;setBusy(true);setNotice("");setError("");
    const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),15000);
    try{
      const before=await readWithDeadline(()=>supabase.auth.getSession());
      if(before.error||!before.data.session||before.data.session.user.id!==uid||!alive.current||controller.signal.aborted)throw Error("Verify access.");
      const token=before.data.session.access_token,header="Bearer "+token;
      const actual=await readWithDeadline(()=>supabase.auth.getUser(token));
      if(actual.error||actual.data.user?.id!==uid||!actual.data.user.email_confirmed_at)throw Error("Verify access.");
      const role=await supabase.rpc("is_current_user_admin_or_moderator").setHeader("Authorization",header).abortSignal(controller.signal);
      if(role.error||role.data!==true)throw Error("Staff access not verified.");
      const target=await supabase.from("support_tickets").select("id,status").eq("id",ticket.id).eq("category","security").setHeader("Authorization",header).abortSignal(controller.signal).maybeSingle();
      if(target.error||target.data?.id!==ticket.id||target.data.status!==ticket.status||!alive.current||controller.signal.aborted)throw Error("Ticket changed.");
      const result=await supabase.rpc("admin_update_support_ticket",{p_ticket_id:ticket.id,p_status:status}).setHeader("Authorization",header).abortSignal(controller.signal);
      if(result.error||result.data!==true)throw Error("Update unconfirmed.");
      const after=await readWithDeadline(()=>supabase.auth.getSession());
      const staff=await supabase.rpc("is_current_user_admin_or_moderator").setHeader("Authorization",header).abortSignal(controller.signal);
      if(after.error||after.data.session?.user.id!==uid||staff.error||staff.data!==true||!alive.current||controller.signal.aborted)throw Error("Verify access.");
      setNotice("Ticket status updated. This is not a content removal or a finding of misconduct.");setSelected(null);setNextStatus(null);setRevision(v=>v+1);
    }catch{if(alive.current){setTickets(null);setSelected(null);setNextStatus(null);setNotice("Ticket update could not be confirmed. Refresh and verify access before retrying.");setRevision(v=>v+1);}}
    finally{clearTimeout(deadline);lock.current=false;if(alive.current)setBusy(false);}
  }
  if(!verified)return null;
  return <View style={{gap:8}}>
    <Text accessibilityRole="header" style={{color:t.foreground,fontFamily:"HoopCheckDisplay",fontSize:21}}>Administration</Text>
    <Pressable testID="settings-staff-safety" accessibilityRole="button" accessibilityState={{expanded}} disabled={busy} onPress={()=>setExpanded(v=>!v)} style={{minHeight:48,justifyContent:"center",borderBottomWidth:1,borderColor:t.border}}><Text style={{color:t.foreground,fontWeight:"700"}}>Admin & moderator safety center</Text></Pressable>
    {expanded?<><Text style={{color:t.muted}}>Confidential security tickets. Reports are allegations, not verified findings. Status changes do not remove content or suspend accounts.</Text>
    {error?<Text accessibilityRole="alert" style={{color:t.foreground}}>{error}</Text>:!tickets?<Text accessibilityRole="progressbar" style={{color:t.muted}}>Checking safety reports…</Text>:tickets.length===0?<Text style={{color:t.muted}}>No security tickets returned.</Text>:tickets.map(ticket=><View key={ticket.id} style={{gap:4,borderBottomWidth:1,borderColor:t.border,paddingVertical:8}}><Text style={{color:t.foreground,fontWeight:"700"}}>{ticket.subject}</Text><Text style={{color:t.muted}}>{ticket.status} · {ticket.priority} · {new Date(ticket.created_at).toLocaleDateString()}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>{setSelected(v=>v===ticket.id?null:ticket.id);setNextStatus(null);}} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent}}>Review ticket</Text></Pressable>{selected===ticket.id?<><Text selectable style={{color:t.foreground}}>{ticket.description}</Text><StaffReelModeration key={ticket.id} uid={uid} ticket={ticket} onChanged={()=>setNotice("Video removal confirmed. Review ticket status separately.")}/><Text style={{color:t.muted}}>Change private ticket status</Text>{["open","in_progress","waiting_on_user","resolved","closed"].filter(status=>status!==ticket.status).map(status=><Pressable key={status} accessibilityRole="button" disabled={busy} onPress={()=>setNextStatus(status)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.foreground}}>{status.replaceAll("_"," ")}{nextStatus===status?" ✓":""}</Text></Pressable>)}{nextStatus?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>void updateStatus(ticket,nextStatus)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent,fontWeight:"700"}}>Confirm status change</Text></Pressable>:null}</>:null}</View>)}
    {notice?<Text accessibilityRole="alert" style={{color:t.foreground}}>{notice}</Text>:null}
    {tickets?.length===50?<Text style={{color:t.muted}}>Showing the latest 50 security tickets.</Text>:null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>{setSelected(null);setNextStatus(null);setRevision(v=>v+1);}} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:t.accent}}>Refresh safety reports</Text></Pressable></>:null}
  </View>;
}
