import { Reveal } from "../../components/Motion";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, GlassCard, Input } from "../../src/primitives";
import { useEntryTheme } from "../../src/theme";
import { useNativeAccount } from "../../src/native/useNativeAccount";
import { useNetwork } from "../../src/native/network";
import { supabase } from "../../src/lib/supabase";
import { readWithDeadline } from "../../src/native/readDeadline";
import { privacyRequestLabels, privacyRequestPayload, privacyRequestRows, type PrivacyRequest, type PrivacyRequestType } from "../../src/native/privacyRequests";

async function privacyRequestToken(owner: string) {
  const {data, error} = await readWithDeadline(() => supabase.auth.getSession());
  if (error || data.session?.user.id !== owner) throw Error("Account changed.");
  const token = data.session.access_token;
  const verified = await readWithDeadline(() => supabase.auth.getUser(token));
  if (verified.error || verified.data.user?.id !== owner) throw Error("Account changed.");
  return token;
}

export default function PrivacyCenter() {
  const t = useEntryTheme(), { account, loading, retry } = useNativeAccount();
  if (!account) return <View style={{flex:1,backgroundColor:t.background,padding:20,gap:12}}>
    <Text style={{color:t.foreground}}>{loading?"Verifying account…":"Verify your account to access private requests."}</Text>
    <Button secondary onPress={retry}>Verify access</Button>
  </View>;
  return <Requests key={account.user.id} owner={account.user.id}/>;
}
function Requests({owner}:{owner:string}) {
  const t=useEntryTheme(),router=useRouter(),{offline,revision}=useNetwork();
  const [type,setType]=useState<PrivacyRequestType>("access"),[details,setDetails]=useState("");
  const [rows,setRows]=useState<PrivacyRequest[]|null>(null),[loadError,setLoadError]=useState("");
  const [limit,setLimit]=useState(50),[more,setMore]=useState(false),[refresh,setRefresh]=useState(0);
  const [saving,setSaving]=useState(false),[feedback,setFeedback]=useState(""),[uncertain,setUncertain]=useState(false);
  const inFlight=useRef(false),authGeneration=useRef(0),mounted=useRef(true),activeRead=useRef<AbortController|null>(null);
  useEffect(()=>{
    mounted.current=true;
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"||session?.user.id!==owner){
        authGeneration.current++;
        activeRead.current?.abort();
        setRows(null);setDetails("");setFeedback("");setRefresh(v=>v+1);
      }
    });
    return ()=>{mounted.current=false;authGeneration.current++;data.subscription.unsubscribe();};
  },[owner]);
  useEffect(()=>{
    let live=true;const generation=authGeneration.current,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    setRows(null);setMore(false);setLoadError("");
    if(offline){clearTimeout(timer);return;}
    activeRead.current=controller;
    void(async()=>{try{
      const token=await privacyRequestToken(owner);
      if(!live||generation!==authGeneration.current)return;
      if(controller.signal.aborted)throw Error("read");
      const result=await supabase.from("privacy_requests").select("id,request_type,status,details,created_at").eq("requester_id",owner).order("created_at",{ascending:false}).order("id",{ascending:false}).range(0,limit).setHeader("Authorization", "Bearer "+token).abortSignal(controller.signal);
      if(result.error||controller.signal.aborted)throw Error("read");
      await privacyRequestToken(owner);
      if(controller.signal.aborted)throw Error("read");
      const values=privacyRequestRows(result.data??[]);
      if(live&&generation===authGeneration.current){setRows(values.slice(0,limit));setMore(values.length>limit);setUncertain(false);}
    }catch{if(live&&generation===authGeneration.current)setLoadError("Privacy requests could not load. Try again.");}finally{clearTimeout(timer);}})();
    return()=>{live=false;clearTimeout(timer);controller.abort();if(activeRead.current===controller)activeRead.current=null;};
  },[owner,offline,revision,refresh,limit]);
  async function submit(){
    if(inFlight.current||offline||uncertain)return;
    let payload;try{payload=privacyRequestPayload(owner,type,details);}catch(e){setFeedback(e instanceof Error?e.message:"Check your request.");return;}
    inFlight.current=true;setSaving(true);setFeedback("");
    const generation=authGeneration.current;
    const current=()=>mounted.current&&generation===authGeneration.current;
    try{
      const token=await privacyRequestToken(owner);
      if(!current())return;
      const result=await supabase.from("privacy_requests").insert(payload).setHeader("Authorization", "Bearer "+token);
      if(result.error)throw result.error;
      await privacyRequestToken(owner);
      if(!current())return;
      setDetails("");setFeedback("Your privacy request was submitted. HoopCheck will review it.");setRefresh(v=>v+1);
    }catch{if(current()){setUncertain(true);setFeedback("Submission could not be confirmed. Refresh your requests before trying again.");}}
    finally{inFlight.current=false;if(mounted.current)setSaving(false);}
  }
  return <ScrollView style={{flex:1,backgroundColor:t.background}} contentContainerStyle={{padding:16,gap:12,paddingBottom:100}} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={{color:t.foreground,fontFamily:"HoopCheckDisplay",fontSize:26}}>Privacy Request Center</Text>
    <Text style={{color:t.muted}}>Request access, correction, deletion or a copy of personal information associated with your account. HoopCheck may need to verify your identity.</Text>
    <GlassCard style={{gap:10}}>
      <Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:18}}>Make a request</Text>
      {(Object.keys(privacyRequestLabels) as PrivacyRequestType[]).map(key=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:type===key,disabled:saving}} disabled={saving} onPress={()=>setType(key)} style={{padding:12,borderWidth:1,borderColor:type===key?t.accent:t.border,borderRadius:12}}><Text style={{color:type===key?t.accent:t.foreground}}>{privacyRequestLabels[key]}{type===key?" · Selected":""}</Text></Pressable>)}
      {type==="deletion"?<Text style={{color:t.muted}}>This submits a data-deletion request for review; it does not immediately delete your account.</Text>:null}
      <Input accessibilityLabel="Privacy request details" placeholder="Describe the information or action requested" multiline value={details} onChangeText={setDetails} maxLength={5000} editable={!saving} style={{minHeight:130,textAlignVertical:"top"}}/>
      <Text style={{color:t.muted}}>Never include passwords, verification codes or payment details.</Text>
      {feedback?<Reveal><Text accessibilityRole="alert" style={{color:t.foreground}}>{feedback}</Text></Reveal>:null}
      <Button disabled={offline||saving||uncertain} onPress={()=>void submit()}>{saving?"Submitting…":"Submit privacy request"}</Button>
    </GlassCard>
    <Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:19}}>My requests</Text>
    <Button secondary disabled={saving||offline} onPress={()=>setRefresh(v=>v+1)}>Refresh requests</Button>
    {offline?<Text style={{color:t.muted}}>Reconnect to access your private requests.</Text>:loadError?<Text accessibilityRole="alert" style={{color:t.foreground}}>{loadError}</Text>:rows===null?<Text accessibilityRole="progressbar" style={{color:t.muted}}>Loading requests…</Text>:rows.length?rows.map(row=><GlassCard key={row.id} style={{gap:6}}><Text style={{color:t.foreground,fontWeight:"800"}}>{privacyRequestLabels[row.request_type]}</Text><Text style={{color:t.muted}}>{row.status.replaceAll("_"," ")} · {new Date(row.created_at).toLocaleString()}</Text><Text style={{color:t.foreground}}>{row.details}</Text></GlassCard>):<Text style={{color:t.muted}}>No privacy requests submitted.</Text>}
    {more&&!offline?<Button secondary onPress={()=>setLimit(v=>v+50)}>Load more</Button>:null}
    <Button secondary onPress={()=>router.push({pathname:"/legal",params:{document:"privacy"}})}>Privacy policy</Button>
    <Button secondary onPress={()=>router.push("/account/support")}>Help & Support</Button>
  </ScrollView>;
}
