import {useEffect,useLayoutEffect,useState} from "react";
import {AppState,Platform} from "react-native";
import {supabase} from "../lib/supabase";
import {useMfaSession} from "./mfa";
import {useNativeAccount} from "./useNativeAccount";
import {useNetwork} from "./network";
import {createPlayNativeRuntime} from "./playNativeRuntime";
import {createPlaySandboxTransport} from "./playSandboxTransport";

type Snapshot={security:ReturnType<typeof useMfaSession>;account:ReturnType<typeof useNativeAccount>["account"];offline:boolean};
function createRuntime(initial:Snapshot){
 let snapshot=initial;
 const enabled=()=>Platform.OS==="android"&&__DEV__&&process.env.EXPO_PUBLIC_HOOPCHECK_PLAY_SIGNED_SANDBOX==="true";
 const available=()=>!snapshot.offline&&snapshot.security.phase==="ready"&&snapshot.security.owner!==null&&snapshot.account?.user.id===snapshot.security.owner&&AppState.currentState==="active";
 const client=createPlayNativeRuntime({enabled,available,now:Date.now,request:createPlaySandboxTransport(process.env.EXPO_PUBLIC_HOOPCHECK_PLAY_SANDBOX_API_URL??"",enabled),
  session:async()=>{
   const s=snapshot;
   if(!available())return null;
   const {data,error}=await supabase.auth.getSession();
   if(error||!data.session||data.session.user.id!==s.security.owner||!available()||!s.account||
    snapshot.security.owner!==s.security.owner||snapshot.security.verifiedRevision!==s.security.verifiedRevision||snapshot.account?.user.accountType!==s.account.user.accountType)return null;
   return {owner:data.session.user.id,token:data.session.access_token,role:s.account.user.accountType};
  }
 });
 return {client,update(next:Snapshot){
  const previous=snapshot;snapshot=next;
  const {security,account,offline}=next;
  const owner=security.phase==="ready"&&account?.user.id===security.owner&&!offline?security.owner:null;
  if(previous.security.owner!==security.owner||previous.security.phase!==security.phase||previous.security.verifiedRevision!==security.verifiedRevision||previous.account?.user.accountType!==account?.user.accountType||offline)client.invalidate();
  client.setOwner(owner);
 }};
}
export function usePlayMembershipRuntime(){
 const security=useMfaSession(),{account}=useNativeAccount(),{offline}=useNetwork();
 const [runtime]=useState(()=>createRuntime({security,account,offline}));
 useLayoutEffect(()=>runtime.update({security,account,offline}),[runtime,security,account,offline]);
 useEffect(()=>{
  if(Platform.OS!=="android")return;
  const {data}=supabase.auth.onAuthStateChange(()=>runtime.client.setOwner(null));
  return ()=>{data.subscription.unsubscribe();runtime.client.setOwner(null);};
 },[runtime]);
 return runtime.client;
}
