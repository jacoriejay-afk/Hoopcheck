import {useEffect,useRef,useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {readGroupAccess,mutateGroupAccess,readGroupMemberPage,readGroupInvitation,groupAlertPreference,groupAccessDeadline,type GroupAccessAction,type GroupAccessSnapshot} from "./groupAccess";
export function useGroupAccess(client:SupabaseClient,uid:string,space:string|null,onChanged:()=>void,invitationHint:string|null=null,channel:string|null=null,alertsEnabled=false){
 const [snapshot,setSnapshot]=useState<GroupAccessSnapshot|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [alertPrefs,setAlertPrefs]=useState<{community:boolean;channel:boolean|null}|null>(null);
 const [rosterNext,setRosterNext]=useState<string|null>(null),[rosterPage,setRosterPage]=useState(1);
 const rosterQuery=useRef(""),rosterStack=useRef<(string|null)[]>([null]);
 const controller=useRef<AbortController|null>(null),generation=useRef(0),alive=useRef(false);
 useEffect(()=>{
  alive.current=true;generation.current++;setSnapshot(null);setAlertPrefs(null);rosterQuery.current="";rosterStack.current=[null];setRosterNext(null);setRosterPage(1);setBusy(false);setNotice("");
  const subscription=client.auth.onAuthStateChange((event,session)=>{
   if(event==="SIGNED_OUT"||session?.user.id!==uid){alive.current=false;generation.current++;controller.current?.abort();setSnapshot(null);setAlertPrefs(null);setRosterNext(null);setNotice("");setBusy(false);}
  });
  return()=>{alive.current=false;generation.current++;controller.current?.abort();controller.current=null;subscription.data.subscription.unsubscribe();};
 },[client,uid,space,invitationHint,channel,alertsEnabled]);
 async function run(action?:GroupAccessAction){
  if(!alive.current||controller.current||!uid)return false;
  const rev=generation.current,c=new AbortController();controller.current=c;setBusy(true);setNotice("");
  const current=()=>alive.current&&rev===generation.current&&controller.current===c;
  try{
   if(action){
    await groupAccessDeadline(signal=>mutateGroupAccess(client,uid,space,action,signal),c);
    if(!current())return false;
    setSnapshot(null);setNotice("Group action confirmed.");
    // Refresh the catalog and moderation/permission snapshots from the server.
    onChanged();return true;
   }
   const value=await groupAccessDeadline(async signal=>{
    let initial=await readGroupAccess(client,uid,space,signal);
    if(alertsEnabled&&invitationHint&&!initial.invitations.some(i=>i.id===invitationHint)){
     const linked=await readGroupInvitation(client,uid,invitationHint,signal);
     if(linked)initial={...initial,invitations:[linked,...initial.invitations]};
    }
    if(alertsEnabled&&space){
     try{
      const community=await groupAlertPreference(client,uid,space,null,null,signal);
      const channelValue=channel?await groupAlertPreference(client,uid,space,channel,null,signal):null;
      if(current())setAlertPrefs({community,channel:channelValue});
     }catch{if(current())setAlertPrefs(null);}
    }

    if(initial.is_owner&&space){
     const page=await readGroupMemberPage(client,uid,space,rosterStack.current.at(-1)??null,rosterQuery.current,signal);
     if(current()){setRosterNext(page.next);setRosterPage(rosterStack.current.length);}
     return {...initial,members:page.members};
    }
    if(current()){setRosterNext(null);setRosterPage(1);}
    return initial;
   },c);
   if(current())setSnapshot(value);
   return current();
  }catch{if(current()){setSnapshot(null);setNotice("Group action could not be verified. Refresh before retrying.");}return false;}
  finally{if(controller.current===c){controller.current=null;if(current()||alive.current&&rev===generation.current)setBusy(false);}}
 }
 async function pageRoster(direction:"search"|"next"|"previous",query=""){
  if(!snapshot?.is_owner||!space||controller.current||!alive.current)return;
  if(direction==="next"){if(!rosterNext)return;rosterStack.current.push(rosterNext);}
  else if(direction==="previous"){if(rosterStack.current.length<=1)return;rosterStack.current.pop();}
  else {rosterStack.current=[null];rosterQuery.current=query.trim().slice(0,80);}
  setRosterNext(null);await run();
 }
 async function toggleAlert(scope:"community"|"channel"){
  if(!alertsEnabled||!space||!alertPrefs||controller.current||!alive.current||scope==="channel"&&(!channel||alertPrefs.channel===null))return;
  const rev=generation.current,c=new AbortController();controller.current=c;setBusy(true);setNotice("");
  const current=()=>alive.current&&rev===generation.current&&controller.current===c;
  try{
   const enabled=scope==="community"?!alertPrefs.community:!alertPrefs.channel;
   const value=await groupAccessDeadline(signal=>groupAlertPreference(client,uid,space,scope==="channel"?channel:null,enabled,signal),c);
   if(current()){setAlertPrefs(previous=>previous?{...previous,[scope]:value}:null);setNotice("Notification preference saved.");}
  }catch{if(current()){setAlertPrefs(null);setNotice("Notification preference could not be verified.");}}
  finally{if(controller.current===c){controller.current=null;if(alive.current&&rev===generation.current)setBusy(false);}}
 }
 return {snapshot,busy,notice,run,rosterNext,rosterPage,pageRoster,alertPrefs,toggleAlert};
}
