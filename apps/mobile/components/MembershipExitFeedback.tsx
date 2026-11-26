import {useEffect,useRef,useState} from "react";
import {View,Text,Pressable} from "react-native";
import {Button,GlassCard} from "../src/primitives";
import {useEntryTheme} from "../src/theme";
import {supabase} from "../src/lib/supabase";
import {exitReasons,membershipExitTicket,type ExitReason} from "../src/native/membershipExitFeedback";
export function MembershipExitFeedback({uid}:{uid:string}){
 const t=useEntryTheme();
 const [open,setOpen]=useState(false),[reason,setReason]=useState<ExitReason|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[done,setDone]=useState(false);
 const live=useRef(true),locked=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 async function submit(){
  const ticket=membershipExitTicket(reason);
  if(!consent||!ticket||locked.current||done||process.env.EXPO_PUBLIC_HOOPCHECK_EXIT_FEEDBACK_ENABLED!=="true")return;
  locked.current=true;setBusy(true);setMessage("");
  try{const {data,error}=await supabase.auth.getUser();if(error||data.user?.id!==uid||!live.current)throw Error("Account changed");
   const result=await supabase.from("support_tickets").insert({requester_id:uid,...ticket});if(result.error)throw Error("Unavailable");
   if(live.current){setDone(true);setMessage("Thank you. Feedback submitted; membership and renewal have not changed.");}
  }catch{if(live.current)setMessage("Could not confirm submission. Check your existing tickets before retrying.");}
  finally{locked.current=false;if(live.current)setBusy(false);}
 }
 return <GlassCard style={{gap:10}}><Text accessibilityRole="header" style={{color:t.foreground,fontSize:18,fontWeight:"800"}}>Help us improve</Text><Text style={{color:t.muted}}>Thinking about leaving? You can manage or cancel your subscription without answering.</Text><Button secondary onPress={()=>setOpen(v=>!v)}>{open?"Hide feedback":"Give optional feedback"}</Button>
 {open?<View style={{gap:8}}>{!done?<>{exitReasons.map(r=><Pressable key={r.id} accessibilityRole="radio" accessibilityState={{checked:reason===r.id,disabled:busy}} disabled={busy} onPress={()=>setReason(r.id)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:reason===r.id?t.accent:t.foreground}}>{reason===r.id?"Selected: ":""}{r.label}</Text></Pressable>)}<Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent,disabled:busy}} disabled={busy} onPress={()=>setConsent(v=>!v)} style={{minHeight:44}}><Text style={{color:t.foreground}}>{consent?"Checked: ":"Unchecked: "}Send this reason to authorized support staff with my account. This is not anonymous.</Text></Pressable><Button disabled={!reason||!consent||busy} onPress={()=>void submit()}>{busy?"Submitting…":"Submit feedback"}</Button></>:null}{message?<Text accessibilityLiveRegion="polite" style={{color:t.foreground}}>{message}</Text>:null}</View>:null}</GlassCard>;
}
