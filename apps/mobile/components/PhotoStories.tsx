import { useCallback,useEffect,useRef,useState } from "react";
import { Alert,AppState,Image,Modal,Platform,ScrollView,Text,TextInput,View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { choosePhoto,capturePhoto,photoBody,type Photo } from "../src/native/mediaSelection";
import { deleteOwnedFeedPost } from "../src/native/feedClient";
import { PublicationUnconfirmed } from "../src/native/mediaClient";
import { readPhotoStories,publishPhotoStory,storyVisible,adjacentStoryId,communityPhotoStoriesEnabled,type StoryAudience,type Story,type StoryCursor } from "../src/native/photoStories";
import { FeedMedia } from "./FeedMedia";
import { FeedReport } from "./FeedReport";
const origin=process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim()||"https://hoopcheck.online";
type Props={uid:string;canWrite:boolean;blockedIds:string[];onClose:()=>void;onBlock:(author:string)=>Promise<void>};
export function PhotoStories({uid,canWrite,blockedIds,onClose,onBlock}:Props){
 const t=useEntryTheme();
 const [rows,setRows]=useState<Story[]>([]),[next,setNext]=useState<StoryCursor|null>(null),[selected,setSelected]=useState<string|null>(null);
 const [photo,setPhoto]=useState<Photo|null>(null),[caption,setCaption]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false),[now,setNow]=useState(()=>Date.now());
 const [audience,setAudience]=useState<StoryAudience>("followers");
 const alive=useRef(false),locked=useRef(false),controller=useRef<AbortController|null>(null),closeRef=useRef(onClose);
 useEffect(()=>{closeRef.current=onClose;},[onClose]);
 const close=useCallback(()=>{alive.current=false;controller.current?.abort();closeRef.current();},[]);
 const refresh=useCallback(async(cursor?:StoryCursor)=>{
  if(!alive.current||locked.current)return;
  locked.current=true;setBusy(true);setMessage("");
  if(!cursor){setRows([]);setSelected(null);setNext(null);}
  const abort=new AbortController();controller.current=abort;const deadline=setTimeout(()=>abort.abort(),12000);
  try{
   const page=await readPhotoStories(supabase,uid,abort.signal,cursor);
   if(alive.current&&!abort.signal.aborted){setRows(previous=>cursor?[...new Map([...previous,...page.stories].map(row=>[row.id,row])).values()]:page.stories);setNext(page.next);setNow(Date.now());}
  }catch(error){if(alive.current){setRows([]);setSelected(null);setNext(null);setMessage(error instanceof Error?error.message:"Stories unavailable.");}}
  finally{clearTimeout(deadline);locked.current=false;if(alive.current)setBusy(false);}
 },[uid]);
 useEffect(()=>{
  alive.current=true;void refresh();
  const timer=setInterval(()=>setNow(Date.now()),1000);
  const sub=AppState.addEventListener("change",state=>{if(state==="background")close();});
  return()=>{alive.current=false;controller.current?.abort();clearInterval(timer);sub.remove();};
 },[refresh,close]);
 async function pick(camera:boolean){
  if(!alive.current||locked.current||!canWrite||uncertain)return;
  locked.current=true;setBusy(true);setMessage("");
  try{const result=await(camera?capturePhoto():choosePhoto());if(alive.current&&result)setPhoto(result);}
  catch(error){if(alive.current)setMessage(error instanceof Error?error.message:"Photo unavailable.");}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 async function publish(){
  if(!alive.current||locked.current||!canWrite||!photo||uncertain)return;
  locked.current=true;setBusy(true);setMessage("");
  const abort=new AbortController();controller.current=abort;const deadline=setTimeout(()=>abort.abort(),30000);let success=false;
  try{
   const {data,error}=await supabase.auth.getSession();
   if(error||data.session?.user.id!==uid||!alive.current||abort.signal.aborted)throw Error("Verify your account.");
   const verified=await supabase.auth.getUser(data.session.access_token);
   if(verified.error||verified.data.user?.id!==uid||!alive.current||abort.signal.aborted)throw Error("Verify your account.");
   const currentSession=await supabase.auth.getSession();
   if(currentSession.error||currentSession.data.session?.user.id!==uid||currentSession.data.session.access_token!==data.session.access_token||!alive.current||abort.signal.aborted)throw Error("Account changed.");
   await publishPhotoStory(origin,uid,data.session.access_token,caption,photo,abort.signal,photoBody,fetch,audience);
   if(alive.current&&!abort.signal.aborted){setPhoto(null);setCaption("");setUncertain(false);success=true;}
  }catch(error){if(alive.current){setMessage(error instanceof Error?error.message:"Story unavailable.");setUncertain(error instanceof PublicationUnconfirmed);}}
  finally{clearTimeout(deadline);locked.current=false;if(alive.current)setBusy(false);}
  if(success&&alive.current){await refresh();if(alive.current)setMessage("Story published for the selected audience for 24 hours.");}
 }
 async function remove(post:Story){
  if(locked.current||post.author_id!==uid||!alive.current)return;
  locked.current=true;setBusy(true);
  try{const {data,error}=await supabase.auth.getSession();if(error||data.session?.user.id!==uid||!alive.current)throw Error("Verify your account.");await deleteOwnedFeedPost(supabase,uid,post.id);if(alive.current){setRows(previous=>previous.filter(row=>row.id!==post.id));setSelected(null);setMessage("Story removed.");}}
  catch{if(alive.current)setMessage("Removal could not be confirmed. Refresh before retrying.");}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 const visible=rows.filter(row=>storyVisible(row,now)&&!blockedIds.includes(row.author_id));
 const current=visible.find(row=>row.id===selected);
 return <Modal visible animationType="slide" onRequestClose={close}><SafeAreaView style={{flex:1,backgroundColor:t.background}}>
  <View style={{padding:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><Text accessibilityRole="header" style={{color:t.foreground,fontSize:22,fontWeight:"800"}}>Photo Stories</Text><Button secondary onPress={close}>Close</Button></View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:14,gap:12}}>
   <Text style={{color:t.muted}}>Photos are visible to the selected eligible audience for 24 hours. Expiration is not a promise that downloaded copies are erased.</Text>
   {canWrite?<View style={{gap:8}}>
    <Text style={{color:t.foreground,fontWeight:"700"}}>Create a Story</Text>
    {photo?<Image accessibilityLabel="Selected Story photo" source={{uri:photo.uri}} resizeMode="contain" style={{height:220,width:"100%"}}/>:null}
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:6}}><Button secondary disabled={busy||uncertain} onPress={()=>void pick(false)}>{photo?"Replace photo":"Choose photo"}</Button>{Platform.OS!=="web"?<Button secondary disabled={busy||uncertain} onPress={()=>void pick(true)}>{photo?"Retake":"Take photo"}</Button>:null}{photo&&!uncertain?<Button secondary disabled={busy} onPress={()=>setPhoto(null)}>Remove photo</Button>:null}</View>
    <TextInput accessibilityLabel="Story caption" value={caption} maxLength={2000} editable={!busy&&!uncertain} onChangeText={setCaption} placeholder="Add a caption (optional)" placeholderTextColor={t.muted} style={{color:t.foreground,borderWidth:1,borderColor:t.border,minHeight:48,padding:12,borderRadius:12}}/>
    {communityPhotoStoriesEnabled?<View style={{gap:6}}><Text style={{color:t.foreground}}>Story audience</Text><Button secondary disabled={busy||uncertain} onPress={()=>setAudience("followers")}>{audience==="followers"?"✓ ":""}Followers</Button><Button secondary disabled={busy||uncertain} onPress={()=>setAudience("community")}>{audience==="community"?"✓ ":""}Eligible HoopCheck community</Button></View>:null}
    <Button disabled={!photo||busy||uncertain} onPress={()=>void publish()}>{audience==="community"?"Post to eligible community":"Post to followers"} · 24h</Button>
    {uncertain?<Text style={{color:t.muted}}>Publication was uncertain. Refresh and review before closing this draft. Do not repost automatically.</Text>:null}
   </View>:null}
   <Button secondary disabled={busy} onPress={()=>void refresh()}>{busy?"Working…":"Refresh Stories"}</Button>
   {message?<Text accessibilityLiveRegion="polite" style={{color:t.foreground}}>{message}</Text>:null}
   {current?<View style={{gap:8}}><Text style={{color:t.foreground,fontWeight:"700"}}>{current.profiles?.display_name||"HoopCheck member"}</Text><Text style={{color:t.muted}}>{current.audience==="community"?"Community":"Followers"} · Expires {new Date(current.expires_at).toLocaleString()}</Text>
    <FeedMedia key={current.id} userId={uid} postId={current.id} reference={current.image_url} enabled={true}/>
    {current.body?<Text style={{color:t.foreground}}>{current.body}</Text>:null}
    {current.author_id===uid?<Button secondary disabled={busy} onPress={()=>Alert.alert("Remove your Story?","This removes the Story from HoopCheck.",[{text:"Cancel",style:"cancel"},{text:"Remove",style:"destructive",onPress:()=>void remove(current)}])}>Remove Story</Button>:<><FeedReport uid={uid} postId={current.id} authorId={current.author_id} active={()=>alive.current&&storyVisible(current)}/><Button secondary disabled={busy} onPress={()=>{setSelected(null);void onBlock(current.author_id);}}>Block account</Button></>}
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:6}}>
     <Button secondary disabled={busy||!adjacentStoryId(visible,current.id,-1,now)} onPress={()=>setSelected(adjacentStoryId(visible,current.id,-1))}>Previous Story</Button>
     <Button secondary disabled={busy||!adjacentStoryId(visible,current.id,1,now)} onPress={()=>setSelected(adjacentStoryId(visible,current.id,1))}>Next Story</Button>
    </View>
    <Button secondary onPress={()=>setSelected(null)}>Back to Stories</Button>
   </View>:visible.length?visible.map(row=><Button key={row.id} secondary onPress={()=>setSelected(row.id)}>{row.profiles?.display_name||"HoopCheck member"} · View Story</Button>):<Text style={{color:t.muted}}>No accessible photo Stories on this page.</Text>}
   {next?<Button secondary disabled={busy} onPress={()=>void refresh(next)}>Load more Stories</Button>:null}
  </ScrollView>
 </SafeAreaView></Modal>;
}
