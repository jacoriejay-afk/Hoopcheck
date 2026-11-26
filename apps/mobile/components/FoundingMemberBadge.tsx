import {useEffect,useState} from "react";
import {Text} from "react-native";
import {useEntryTheme} from "../src/theme";
import {supabase} from "../src/lib/supabase";
import {readFoundingMember} from "../src/native/foundingMember";
import {readWithDeadline} from "../src/native/readDeadline";
export function FoundingMemberBadge({userId,activeScreen,revision}:{userId:string;activeScreen:boolean;revision:number}){
 const theme=useEntryTheme();const [owner,setOwner]=useState<string|null>(null);
 useEffect(()=>{
  if(process.env.EXPO_PUBLIC_HOOPCHECK_FOUNDING_MEMBER_ENABLED!=="true"||!userId||!activeScreen)return;
  let active=true;const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),8000);
  void (async()=>{
   try{
    const configured=process.env.EXPO_PUBLIC_HOOPCHECK_API_URL;if(!configured)return;
    const url=new URL(configured);
    if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)return;
    url.pathname="/api/account/founding-member";
    const {data,error}=await readWithDeadline(()=>supabase.auth.getSession());const session=data.session;
    if(error||session?.user.id!==userId||!active||abort.signal.aborted)return;
    const eligible=await readFoundingMember(url.toString(),session.access_token,abort.signal);
    const current=await readWithDeadline(()=>supabase.auth.getSession());
    if(active&&!abort.signal.aborted&&!current.error&&current.data.session?.user.id===userId)setOwner(eligible?userId:null);
   }catch{}finally{clearTimeout(deadline);}
  })();
  const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user.id!==userId){active=false;abort.abort();setOwner(null);}});
  return()=>{active=false;abort.abort();clearTimeout(deadline);listener.subscription.unsubscribe();};
 },[userId,activeScreen,revision]);
 return activeScreen&&owner===userId?<Text accessibilityLabel="Founding Member. Early supporter recognition, not professional verification or paid access." style={{color:theme.accent,fontWeight:"800",fontSize:12}}>★ FOUNDING MEMBER</Text>:null;
}
