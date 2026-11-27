import { ModerationAppeal } from "../../components/ModerationAppeal";
import { readWithDeadline } from "../../src/native/readDeadline";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEntryTheme } from "../../src/theme";
import { Button, GlassCard, Input } from "../../src/primitives";
import { useNativeAccount } from "../../src/native/useNativeAccount";
import { useNetwork } from "../../src/native/network";
import { correctionTicket, correctionKinds, correctionFields, type CorrectionKind, type CorrectionField } from "../../src/native/dataCorrection";
import { supabase } from "../../src/lib/supabase";

type Ticket={id:string;subject:string;category:string;status:string;created_at:string};
export default function SupportPage(){
 const {account,loading,retry}=useNativeAccount(),t=useEntryTheme();
 const {topic,reportReel}=useLocalSearchParams<{topic?:string;reportReel?:string}>();
 const reel=typeof reportReel==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(reportReel)?reportReel:null;
 if(loading||!account)return <View style={{flex:1,backgroundColor:t.background,padding:20,gap:12}}><Text style={{color:t.foreground}}>{loading?"Verifying account…":"Verify your account to view private tickets."}</Text><Button secondary onPress={retry}>Verify access</Button></View>;
 return <SupportContent key={account.user.id+":"+String(topic)+":"+String(reel)} uid={account.user.id} scam={topic==="scam"} reel={reel}/>;
}
function SupportContent({uid,scam,reel}:{uid:string;scam:boolean;reel:string|null}){
 const t=useEntryTheme(),router=useRouter(),{offline,revision}=useNetwork();
 const [state,setState]=useState<{rows:Ticket[];error:string}|null>(null),[refresh,setRefresh]=useState(0),[linkError,setLinkError]=useState("");
 useEffect(()=>{
  let live=true;const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);setState(null);
  async function load(){try{
   if(offline)throw Error("Reconnect to load private tickets.");
   const before=await readWithDeadline(()=>supabase.auth.getSession());if(before.error||!before.data.session||before.data.session.user.id!==uid)throw Error("Verify your account again.");
   const result=await supabase.from("support_tickets").select("id,subject,category,status,created_at").eq("requester_id",uid).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50).setHeader("Authorization","Bearer "+before.data.session.access_token).abortSignal(ctrl.signal);
   const after=await readWithDeadline(()=>supabase.auth.getSession());if(result.error||after.error||after.data.session?.user.id!==uid)throw Error("Tickets could not load. Try again.");
   if(live)setState({rows:(result.data??[]) as Ticket[],error:""});
  }catch(e){if(live)setState({rows:[],error:e instanceof Error?e.message:"Tickets unavailable."});}
  finally{clearTimeout(timer);}}
  void load();return()=>{live=false;clearTimeout(timer);ctrl.abort();};
 },[uid,offline,revision,refresh]);
 const [correctionOpen,setCorrectionOpen]=useState(false),[kind,setKind]=useState<CorrectionKind>("teams"),[field,setField]=useState<CorrectionField>("name"),[entityId,setEntityId]=useState(""),[proposed,setProposed]=useState(""),[source,setSource]=useState(""),[correctionMessage,setCorrectionMessage]=useState(""),[submitting,setSubmitting]=useState(false);
 const submitLock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function submitCorrection(){
  if(offline||submitLock.current||process.env.EXPO_PUBLIC_HOOPCHECK_DATA_CORRECTION_ENABLED!=="true")return;
  const ticket=correctionTicket({kind,field,entityId,correction:proposed,source});
  if(!ticket){setCorrectionMessage("Check the record ID, proposed correction and optional public HTTPS evidence link.");return;}
  submitLock.current=true;setSubmitting(true);setCorrectionMessage("");
  try{const {data,error}=await supabase.auth.getSession();if(error||data.session?.user.id!==uid||!alive.current)throw Error("Session changed");
   const result=await supabase.from("support_tickets").insert({requester_id:uid,...ticket});if(result.error)throw Error("Submission unavailable");
   if(alive.current){setEntityId("");setProposed("");setSource("");setCorrectionMessage("Correction submitted for staff review. The directory has not been changed.");setRefresh(v=>v+1);}
  }catch{if(alive.current)setCorrectionMessage("Could not confirm submission. Check your existing tickets before retrying.");}
  finally{submitLock.current=false;if(alive.current)setSubmitting(false);}
 }
 const categories=["account","billing","verification","review","privacy","security","technical","team_request","general"] as const;
 const [subject,setSubject]=useState(reel?"Report a HoopFeed Reel":scam?"Report a suspicious basketball offer":"");
 const [category,setCategory]=useState<(typeof categories)[number]>(scam||reel?"security":"general");
 const [description,setDescription]=useState(reel?`Reel: https://hoopcheck.online/feed#post-${reel}\nReason: `:"");
 const [saving,setSaving]=useState(false),[feedback,setFeedback]=useState("");
 const inFlight=useRef(false);
 async function submit(){
  if(inFlight.current||offline)return;
  const cleanSubject=subject.trim(),cleanDescription=description.trim();
  if(cleanSubject.length<3||cleanSubject.length>160||cleanDescription.length<10||cleanDescription.length>5000){setFeedback("Enter a subject of 3–160 characters and an issue description of 10–5,000 characters.");return;}
  if(reel&&cleanDescription===`Reel: https://hoopcheck.online/feed#post-${reel}\nReason:`){setFeedback("Please enter the reason for reporting.");return;}
  inFlight.current=true;setSaving(true);setFeedback("");
  try{
   const before=await readWithDeadline(()=>supabase.auth.getSession());
   if(before.error||!before.data.session||before.data.session.user.id!==uid)throw Error("session");
   const result=await supabase.from("support_tickets").insert({requester_id:uid,subject:cleanSubject,description:cleanDescription,category,priority:scam||reel?"high":"normal"}).setHeader("Authorization","Bearer "+before.data.session.access_token);
   const after=await readWithDeadline(()=>supabase.auth.getSession());
   if(after.error||after.data.session?.user.id!==uid)throw Error("session changed");
   if(result.error)throw result.error;
   setSubject("");setDescription("");setCategory("general");setFeedback("Ticket submitted to HoopCheck support.");setRefresh(v=>v+1);
  }catch{setFeedback("Ticket submission could not be confirmed. Refresh your tickets before trying again.");}
  finally{inFlight.current=false;setSaving(false);}
 }

 return <ScrollView style={{flex:1,backgroundColor:t.background}} contentContainerStyle={{padding:16,gap:12,paddingBottom:100}}>
  <Text accessibilityRole="header" style={{color:t.foreground,fontFamily:"HoopCheckDisplay",fontSize:26}}>Help & Support</Text>
  <Text style={{color:t.muted}}>Get help with your account, billing, reviews, verification, security or directory records. Never include passwords or payment details.</Text>
  <GlassCard style={{gap:8}}><Text style={{color:t.foreground,fontWeight:"800",fontSize:18}}>{reel?"Report a HoopFeed Reel":scam?"Report a suspicious basketball offer":"Contact HoopCheck"}</Text>
  <Text style={{color:t.muted}}>Your ticket is sent privately to HoopCheck support. Do not include passwords, verification codes, or payment details.</Text>
  <Input accessibilityLabel="Ticket subject" placeholder="Subject" value={subject} onChangeText={setSubject} maxLength={160} editable={!saving}/>
  <Text style={{color:t.foreground,fontWeight:"700"}}>Category</Text>
  <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{categories.map(item=><Pressable key={item} accessibilityRole="button" accessibilityState={{selected:category===item,disabled:saving}} disabled={saving} onPress={()=>setCategory(item)} style={{padding:10,borderWidth:1,borderColor:category===item?t.accent:t.border,borderRadius:12}}><Text style={{color:category===item?t.accent:t.foreground}}>{item.replace("_"," ")}</Text></Pressable>)}</View>
  <Input accessibilityLabel="Describe the issue" placeholder="Describe the issue" value={description} onChangeText={setDescription} maxLength={5000} editable={!saving} multiline style={{minHeight:130,textAlignVertical:"top"}}/>
  {feedback?<Text accessibilityRole="alert" style={{color:t.foreground}}>{feedback}</Text>:null}
  <Button disabled={saving||offline} onPress={()=>void submit()}>{saving?"Submitting…":"Submit ticket"}</Button>
  {!scam&&!reel?<Button secondary onPress={()=>router.push({pathname:"/account/support",params:{topic:"scam"}})}>Report a suspicious offer</Button>:null}
  <Button secondary onPress={()=>{setLinkError("");void Linking.openURL("mailto:HoopCheck@outlook.com").catch(()=>setLinkError("Email app could not open. Contact HoopCheck@outlook.com."));}}>Email support</Button>{linkError?<Text accessibilityRole="alert" style={{color:t.foreground}}>{linkError}</Text>:null}
  </GlassCard>
  {process.env.EXPO_PUBLIC_HOOPCHECK_DATA_CORRECTION_ENABLED==="true"?<GlassCard style={{gap:8}}><Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:19}}>Data Correction Center</Text><Text style={{color:t.muted}}>Privately suggest a correction to a team or league record. Staff review submissions before making changes. Never include contracts, identity documents or private links.</Text><Button secondary onPress={()=>setCorrectionOpen(v=>!v)}>{correctionOpen?"Hide correction form":"Suggest a correction"}</Button>
    {correctionOpen?<><Text style={{color:t.foreground}}>Record type: {kind}</Text><View style={{gap:4}}>{correctionKinds.map(value=><Button key={value} secondary disabled={submitting} onPress={()=>setKind(value)}>{value===kind?"Selected: ":""}{value}</Button>)}</View><Input accessibilityLabel="Directory record ID" value={entityId} onChangeText={setEntityId} maxLength={36} placeholder="Record UUID" autoCapitalize="none"/><Text style={{color:t.foreground}}>Field: {field}</Text><View style={{gap:4}}>{correctionFields.map(value=><Button key={value} secondary disabled={submitting} onPress={()=>setField(value)}>{value===field?"Selected: ":""}{value}</Button>)}</View><Input accessibilityLabel="Proposed correction" value={proposed} onChangeText={setProposed} multiline maxLength={1000} placeholder="Describe the correction"/><Input accessibilityLabel="Public evidence URL" value={source} onChangeText={setSource} maxLength={500} autoCapitalize="none" placeholder="Optional public HTTPS link"/><Button disabled={submitting||offline} onPress={()=>void submitCorrection()}>{submitting?"Submitting…":"Submit for review"}</Button>{correctionMessage?<Text accessibilityLiveRegion="polite" style={{color:t.foreground}}>{correctionMessage}</Text>:null}</>:null}
  </GlassCard>:null}
  <ModerationAppeal uid={uid} onSubmitted={()=>setRefresh(v=>v+1)}/>
  <Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:19}}>My tickets</Text>
  <Button secondary onPress={()=>setRefresh(v=>v+1)}>Refresh tickets</Button>
  {offline?<Text style={{color:t.muted}}>Reconnect to view your tickets.</Text>:!state?<Text accessibilityRole="progressbar" style={{color:t.muted}}>Loading tickets…</Text>:state.error?<Text accessibilityRole="alert" style={{color:t.foreground}}>{state.error}</Text>:state.rows.length?<>{state.rows.map(ticket=><GlassCard key={ticket.id} style={{gap:5}}><Text style={{color:t.foreground,fontWeight:"800"}}>{ticket.subject}</Text><Text style={{color:t.muted}}>{ticket.status} · {ticket.category}</Text><Text style={{color:t.muted}}>{new Date(ticket.created_at).toLocaleString()}</Text></GlassCard>)}{state.rows.length===50?<Text style={{color:t.muted}}>Showing the latest 50. Open support on the website for full ticket history.</Text>:null}</>:<Text style={{color:t.muted}}>No support tickets yet.</Text>}
  <Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:19}}>Policies</Text>
  <Button secondary onPress={()=>router.push({pathname:"/account/policies",params:{kind:"privacy"}})}>Privacy policy</Button><Button secondary onPress={()=>router.push({pathname:"/account/policies",params:{kind:"terms"}})}>Terms of use</Button>
 </ScrollView>;
}
