import {useEffect,useRef,useState} from "react";
import {Text,View} from "react-native";
import {Button} from "../src/primitives";
import {useEntryTheme} from "../src/theme";
import {supabase} from "../src/lib/supabase";
import {readWithDeadline} from "../src/native/readDeadline";
import {requestPlayerReference,referenceLabels,type ReferenceAction,type ReferenceState} from "../src/native/playerReferences";
export function PlayerReferencePanel({userId,connectionId,offline}:{userId:string;connectionId:string;offline:boolean}){
 const t=useEntryTheme();const [state,setState]=useState<ReferenceState|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const active=useRef(false),lock=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  active.current=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user.id!==userId){active.current=false;controller.current?.abort();setState(null);setMessage("");}});
  return()=>{active.current=false;controller.current?.abort();subscription.unsubscribe();};
 },[userId,connectionId]);
 async function act(action:ReferenceAction){
  if(!active.current||lock.current||offline||process.env.EXPO_PUBLIC_HOOPCHECK_PLAYER_REFERENCES_ENABLED!=="true")return;
  lock.current=true;setBusy(true);setMessage("");const abort=new AbortController();controller.current=abort;const deadline=setTimeout(()=>abort.abort(),12000);
  try{const origin=process.env.EXPO_PUBLIC_HOOPCHECK_API_URL;if(!origin)throw Error("Missing origin");const url=new URL(origin);if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw Error("Invalid origin");url.pathname="/api/player-references";
   const {data,error}=await readWithDeadline(()=>supabase.auth.getSession());if(error||data.session?.user.id!==userId||!active.current||abort.signal.aborted)throw Error("Session changed");
   const result=await requestPlayerReference(url.toString(),data.session.access_token,connectionId,action,abort.signal);
   const after=await readWithDeadline(()=>supabase.auth.getSession());if(!active.current||abort.signal.aborted||after.error||after.data.session?.user.id!==userId)return;setState(result);
  }catch{if(active.current){setState(null);setMessage("Reference state unavailable. Only eligible verified player connections can use this feature. Refresh before retrying.");}}
  finally{clearTimeout(deadline);lock.current=false;if(active.current)setBusy(false);}
 }
 if(process.env.EXPO_PUBLIC_HOOPCHECK_PLAYER_REFERENCES_ENABLED!=="true")return null;
 return <View style={{gap:6}}><Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800"}}>Player reference</Text><Text style={{color:t.muted}}>Agreement is only consent to discuss basketball experience, not an endorsement or permission to share private documents. Either participant can withdraw; requests expire after 30 days.</Text><Button secondary disabled={busy||offline} onPress={()=>void act("read")}>{busy?"Checking…":"Check reference status"}</Button>{state?<><Text accessibilityLiveRegion="polite" style={{color:t.foreground}}>{referenceLabels[state.state]}</Text>{state.canRequest?<Button disabled={busy||offline} onPress={()=>void act("request")}>Request reference consent</Button>:null}{state.canRespond?<><Button disabled={busy||offline} onPress={()=>void act("accept")}>Agree to discuss</Button><Button secondary disabled={busy||offline} onPress={()=>void act("decline")}>Decline</Button></>:null}{state.canRevoke?<Button secondary disabled={busy||offline} onPress={()=>void act("revoke")}>Withdraw consent / request</Button>:null}</>:null}{message?<Text accessibilityRole="alert" style={{color:t.muted}}>{message}</Text>:null}</View>;
}
