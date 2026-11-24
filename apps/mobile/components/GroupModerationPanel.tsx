import {useState,useRef,useEffect} from "react";
import {Text,View} from "react-native";
import {Button} from "../src/primitives";
import {useEntryTheme} from "../src/theme";
import {supabase} from "../src/lib/supabase";
import {readWithDeadline} from "../src/native/readDeadline";
import {groupModeration,type PendingGroupPost} from "../src/native/groupModeration";
const origin=process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim()||"https://hoopcheck.online";
export function GroupModerationPanel({userId,spaceId,onChanged}:{userId:string;spaceId:string;onChanged:()=>void}){
 const theme=useEntryTheme();
 const [posts,setPosts]=useState<PendingGroupPost[]>([]);
 const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[notice,setNotice]=useState("");
 const active=useRef(false),pending=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function run(action?:{id:string;status:"approved"|"rejected"}){
  if(pending.current||!active.current||action&&!posts.some(p=>p.id===action.id))return;
  pending.current=true;setBusy(true);setNotice("");
  try{
   const session=await readWithDeadline(()=>supabase.auth.getSession());
   const token=session.data.session?.access_token;
   if(session.error||!token||session.data.session?.user.id!==userId)throw Error("Sign in again.");
   const verified=await readWithDeadline(()=>supabase.auth.getUser(token));
   if(verified.error||verified.data.user?.id!==userId||!active.current)throw Error("Your account changed.");
   const next=await groupModeration(origin,token,spaceId,action);
   const current=await readWithDeadline(()=>supabase.auth.getSession());
   if(!active.current||current.error||current.data.session?.user.id!==userId||current.data.session.access_token!==token)return;
   if(action){setPosts(prev=>prev.filter(p=>p.id!==action.id));setNotice("Moderation action confirmed.");onChanged();}
   else {setPosts(next);setLoaded(true);}
  }catch(e){if(active.current){setPosts([]);setLoaded(false);setNotice(e instanceof Error?e.message:"Moderation unavailable.");}}
  finally{pending.current=false;if(active.current)setBusy(false);}
 }
 return <View style={{gap:8,paddingVertical:8,borderTopWidth:1,borderColor:theme.border}}>
  <Text accessibilityRole="header" style={{fontWeight:"800",color:theme.foreground}}>Review pending messages</Text>
  <Text style={{color:theme.muted,fontSize:12}}>Only approved messages become visible to other group members.</Text>
  <Button secondary disabled={busy} onPress={()=>void run()}>{busy?"Checking…":"Refresh moderation queue"}</Button>
  {notice?<Text accessibilityLiveRegion="polite" style={{color:theme.muted}}>{notice}</Text>:null}
  {loaded&&!posts.length?<Text style={{color:theme.muted}}>No pending messages.</Text>:null}
  {posts.map(post=><View key={post.id} style={{gap:6,paddingVertical:8,borderBottomWidth:1,borderColor:theme.border}}>
   <Text style={{color:theme.foreground}}>{post.body}</Text>
   <Button disabled={busy} onPress={()=>void run({id:post.id,status:"approved"})}>Approve message</Button>
   <Button secondary disabled={busy} onPress={()=>void run({id:post.id,status:"rejected"})}>Reject message</Button>
  </View>)}
 </View>;
}
