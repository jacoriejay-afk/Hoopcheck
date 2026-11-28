import {useEffect,useRef,useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {readGroupAccess,mutateGroupAccess,groupAccessDeadline,type GroupAccessAction,type GroupAccessSnapshot} from "./groupAccess";
export function useGroupAccess(client:SupabaseClient,uid:string,space:string|null,onChanged:()=>void){
 const [snapshot,setSnapshot]=useState<GroupAccessSnapshot|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const controller=useRef<AbortController|null>(null),generation=useRef(0),alive=useRef(false);
 useEffect(()=>{
  alive.current=true;generation.current++;setSnapshot(null);setBusy(false);setNotice("");
  const subscription=client.auth.onAuthStateChange((event,session)=>{
   if(event==="SIGNED_OUT"||session?.user.id!==uid){alive.current=false;generation.current++;controller.current?.abort();setSnapshot(null);setNotice("");setBusy(false);}
  });
  return()=>{alive.current=false;generation.current++;controller.current?.abort();controller.current=null;subscription.data.subscription.unsubscribe();};
 },[client,uid,space]);
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
   const value=await groupAccessDeadline(signal=>readGroupAccess(client,uid,space,signal),c);
   if(current())setSnapshot(value);
   return current();
  }catch{if(current()){setSnapshot(null);setNotice("Group action could not be verified. Refresh before retrying.");}return false;}
  finally{if(controller.current===c){controller.current=null;if(current()||alive.current&&rev===generation.current)setBusy(false);}}
 }
 return {snapshot,busy,notice,run};
}
