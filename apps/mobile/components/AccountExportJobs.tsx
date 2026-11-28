import {useEffect,useRef,useState} from "react";
import {AppState,Platform,Text,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import {Button,GlassCard} from "../src/primitives";
import {useEntryTheme} from "../src/theme";
import {supabase} from "../src/lib/supabase";
import {readWithDeadline} from "../src/native/readDeadline";
import {requestDurableExport,type ExportAction,type ExportJob} from "../src/native/accountExport";

const origin=process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim()||"https://hoopcheck.online";
export function AccountExportJobs({owner,offline}:{owner:string;offline:boolean}){
 const t=useEntryTheme();
 const [job,setJob]=useState<ExportJob|null>(null),[after,setAfter]=useState<number|null>(0),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const current=useRef<AbortController|null>(null),generation=useRef(0),alive=useRef(false),requestId=useRef<string|null>(null),sharing=useRef(false);
 useEffect(()=>{
  alive.current=true;
  const auth=supabase.auth.onAuthStateChange((event,session)=>{
   if(event==="SIGNED_OUT"||session?.user.id!==owner){
    generation.current++;alive.current=false;current.current?.abort();requestId.current=null;
    setJob(null);setAfter(0);setMessage("");setBusy(false);
   }
  });
  const app=AppState.addEventListener("change",state=>{if(state!=="active"&&!sharing.current)current.current?.abort();});
  return()=>{alive.current=false;generation.current++;current.current?.abort();auth.data.subscription.unsubscribe();app.remove();};
 },[owner]);
 async function action(kind:ExportAction){
  if(!alive.current||current.current||offline)return;
  const id=job?.id??requestId.current??Crypto.randomUUID();
  const cursor=kind==="download"?after:0;
  if(cursor===null)return;
  requestId.current=id;
  const rev=generation.current,c=new AbortController();current.current=c;setBusy(true);setMessage("");
  const timer=setTimeout(()=>c.abort(),30000);
  const active=()=>alive.current&&generation.current===rev&&current.current===c&&!c.signal.aborted;
  let file:File|null=null;
  try{
   const session=await readWithDeadline(()=>supabase.auth.getSession());
   if(session.error||session.data.session?.user.id!==owner||!active())throw Error("Account changed.");
   const token=session.data.session.access_token;
   const verify=async()=>{
    const identity=await readWithDeadline(()=>supabase.auth.getUser(token));
    const latest=await readWithDeadline(()=>supabase.auth.getSession());
    if(identity.error||identity.data.user?.id!==owner||latest.error||latest.data.session?.user.id!==owner||latest.data.session.access_token!==token||!active())throw Error("Account changed.");
   };
   await verify();
   const result=await requestDurableExport(origin,token,kind,id,cursor,c.signal);
   await verify();
   if(result.kind==="page"){
    if(Platform.OS==="web"||!await Sharing.isAvailableAsync())throw Error("Private sharing unavailable.");
    await verify();
    if(Date.parse(result.value.expires_at)<=Date.now())throw Error("Export expired.");
    file=new File(Paths.cache,"hoopcheck-export-"+Crypto.randomUUID()+".json");
    file.create({overwrite:false});
    file.write(JSON.stringify(result.value));
    // The user explicitly requested this page. Only a verified active owner
    // may hand the temporary file to the OS share sheet.
    await verify();
    if(Date.parse(result.value.expires_at)<=Date.now())throw Error("Export expired.");
    sharing.current=true;clearTimeout(timer);
    await Sharing.shareAsync(file.uri,{mimeType:"application/json",UTI:"public.json",dialogTitle:"Save or share your HoopCheck export page"});
    if(active()){
     setAfter(result.value.next_after);
     setMessage(result.value.next_after===null?"Final page opened for saving. This is not complete privacy fulfillment.":"Page opened for saving. Continue to the next page.");
    }
   }else{
    setJob(result.value);requestId.current=result.value.id;
    if(kind==="cancel")setAfter(0);
    setMessage(kind==="request"?"Export job located. Refresh its status.":"Export status updated.");
   }
  }catch{if(active())setMessage("Export action could not be confirmed. Refresh or retry the same job.");}
  finally{
   sharing.current=false;clearTimeout(timer);
   if(file){try{if(file.exists)file.delete();}catch{if(active())setMessage("Temporary export cleanup could not be confirmed. Do not share this device.");}}
   if(current.current===c){current.current=null;if(alive.current&&generation.current===rev)setBusy(false);}
  }
 }
 return <GlassCard style={{gap:10}}>
  <Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:18}}>Personal data export</Text>
  <Text style={{color:t.muted}}>Request or resume a copy of selected personal records. This pilot is not complete privacy fulfillment. Saved or shared files may remain outside HoopCheck.</Text>
  {!job?<Button disabled={offline||busy} onPress={()=>void action("request")}>Request or resume export</Button>:<View style={{gap:8}}>
   <Text accessibilityLiveRegion="polite" style={{color:t.foreground}}>Status: {job.state} · {job.row_count} records</Text>
   {job.expires_at?<Text style={{color:t.muted}}>Expires: {new Date(job.expires_at).toLocaleString()}</Text>:null}
   <Button secondary disabled={offline||busy} onPress={()=>void action("status")}>Refresh export status</Button>
   {job.state==="ready"?<>
    <Button disabled={offline||busy||after===null||Platform.OS==="web"} onPress={()=>void action("download")}>Save {after===0?"first":"next"} page</Button>
    <Button secondary disabled={busy} onPress={()=>setAfter(0)}>Restart page download</Button>
   </>:null}
   {["queued","ready"].includes(job.state)?<Button secondary disabled={offline||busy} onPress={()=>void action("cancel")}>Cancel export</Button>:<Button secondary disabled={busy} onPress={()=>{setJob(null);setAfter(0);requestId.current=null;}}>New export</Button>}
  </View>}
  {busy?<Text accessibilityRole="progressbar" style={{color:t.muted}}>Working…</Text>:null}
  {message?<Text accessibilityLiveRegion="polite" style={{color:t.foreground}}>{message}</Text>:null}
 </GlassCard>;
}
