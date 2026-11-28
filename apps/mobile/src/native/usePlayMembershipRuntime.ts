import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {AppState,Platform} from "react-native";
import {supabase} from "../lib/supabase";
import {useMfaSession} from "./mfa";
import {useNativeAccount} from "./useNativeAccount";
import {useNetwork} from "./network";
import {createPlayNativeRuntime} from "./playNativeRuntime";
import {createPlaySandboxTransport} from "./playSandboxTransport";

export function usePlayMembershipRuntime(){
 const security=useMfaSession(),{account}=useNativeAccount(),{offline}=useNetwork();
 const snapshot=useRef({security,account,offline});
 const [runtime]=useState(()=>{
  const enabled=()=>Platform.OS==="android"&&__DEV__&&process.env.EXPO_PUBLIC_HOOPCHECK_PLAY_SIGNED_SANDBOX==="true";
  const available=()=>{const s=snapshot.current;return !s.offline&&s.security.phase==="ready"&&s.security.owner!==null&&s.account?.user.id===s.security.owner&&AppState.currentState==="active";};
  return createPlayNativeRuntime({enabled,available,now:Date.now,request:createPlaySandboxTransport(process.env.EXPO_PUBLIC_HOOPCHECK_PLAY_SANDBOX_API_URL??"",enabled),
   session:async()=>{
    const s=snapshot.current;
    if(!available())return null;
    const {data,error}=await supabase.auth.getSession();
    if(error||!data.session||data.session.user.id!==s.security.owner||snapshot.current!==s||!available()||!s.account)return null;
    return {owner:data.session.user.id,token:data.session.access_token,role:s.account.user.accountType};
   }
  });
 });
 useLayoutEffect(()=>{
  const previous=snapshot.current;snapshot.current={security,account,offline};
  const owner=security.phase==="ready"&&account?.user.id===security.owner&&!offline?security.owner:null;
  if(previous.security.owner!==security.owner||previous.security.phase!==security.phase||previous.security.verifiedRevision!==security.verifiedRevision||previous.account?.user.accountType!==account?.user.accountType||offline)runtime.invalidate();
  runtime.setOwner(owner);
 },[runtime,security,account,offline]);
 useEffect(()=>{
  const {data}=supabase.auth.onAuthStateChange(()=>runtime.setOwner(null));
  return ()=>{data.subscription.unsubscribe();runtime.setOwner(null);};
 },[runtime]);
 return runtime;
}
