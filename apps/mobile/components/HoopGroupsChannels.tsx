import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, GlassCard } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { requireOnline, useNetwork } from "../src/native/network";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { HoopCheckLoading } from "./HoopCheckLoading";

type Space = { id:string;slug:string;name:string;category:string;description:string;owner_id:string|null;accent_color:string;icon_key:string };
type Channel = { id:string;space_id:string;name:string;slug:string;sort_index:number };
type Post = { id:string;author_id:string;body:string;moderation_status:string;created_at:string };
export default function HoopGroupsChannels() {
  const theme=useEntryTheme();
  const { offline } = useNetwork();
  const {account}=useNativeAccount();
  const userId=account?.user.id||"";
  const [spaces,setSpaces]=useState<Space[]>([]);
  const [channels,setChannels]=useState<Channel[]>([]);
  const [joined,setJoined]=useState<string[]>([]);
  const [spaceId,setSpaceId]=useState("");
  const [channelId,setChannelId]=useState("");
  const [posts,setPosts]=useState<Post[]>([]);
  const [draft,setDraft]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<"discover"|"joined"|"mine">("discover");
  const [creating,setCreating]=useState(false);
  const [newName,setNewName]=useState("");
  const [newDescription,setNewDescription]=useState("");
  const [newCategory,setNewCategory]=useState("global");
  const [newChannel,setNewChannel]=useState("");
  const role=account?.user.accountType||"";

  useFocusEffect(useCallback(()=> {
    if(!userId || offline) {setSpaces([]);setPosts([]);setLoading(false);return;}
    let alive=true;
    async function load() {
      setLoading(true);setError("");
      try{
        await requireOnline();
        const {data:{user}}=await supabase.auth.getUser();
        if(user?.id!==userId)throw Error("Revalidate your session.");
        const [a,b,c]=await Promise.all([
          supabase.from("hoop_group_spaces").select("id,slug,name,category,description,owner_id,accent_color,icon_key").order("name"),
          supabase.from("hoop_group_channels").select("id,space_id,name,slug,sort_index").order("sort_index"),
          supabase.from("hoop_group_members").select("space_id").eq("user_id",userId),
        ]);
        if(a.error||b.error||c.error)throw Error("HoopGroups channels are not available yet.");
        if(!alive)return;
        setSpaces((a.data||[]) as Space[]);setChannels((b.data||[]) as Channel[]);
        setJoined((c.data||[]).map(row=>row.space_id));
        setSpaceId(current=>(a.data||[]).some(row=>row.id===current)?current:"");
      }catch(failure){if(alive)setError(failure instanceof Error?failure.message:"Could not open HoopGroups.");}
      finally{if(alive)setLoading(false);}
    }
    void load();
    return ()=>{alive=false;setPosts([]);setJoined([]);};
  },[userId,offline,revision]));

  const ordered=useMemo(()=>spaces.slice().sort((a,b)=>{
    const priority=(s:Space)=>Number(s.category===role || (role==="scout"&&s.category==="agents"));
    return priority(b)-priority(a)||a.name.localeCompare(b.name);
  }),[spaces,role]);
  const filtered=ordered.filter(space=>{
    if(filter==="joined" && !joined.includes(space.id))return false;
    if(filter==="mine" && space.owner_id!==userId)return false;
    const needle=query.trim().toLocaleLowerCase();
    return !needle || [space.name,space.description,space.category].some(value=>value.toLocaleLowerCase().includes(needle));
  });
  const selected=filtered.find(item=>item.id===spaceId)||filtered[0];
  const availableChannels=channels.filter(item=>item.space_id===selected?.id);
  const channel=availableChannels.find(item=>item.id===channelId)||availableChannels[0];
  const member=Boolean(selected&&joined.includes(selected.id));
  useEffect(()=>{
    if(!userId||offline||!member||!channel?.id){setPosts([]);return;}
    let alive=true;
    void supabase.from("hoop_group_posts")
      .select("id,author_id,body,moderation_status,created_at")
      .eq("channel_id",channel.id).order("created_at",{ascending:false}).limit(100)
      .then(({data,error:readError})=>{
        if(!alive)return;
        if(readError){setError("Channel messages could not be loaded.");setPosts([]);}
        else setPosts(((data||[]) as Post[]).reverse());
      });
    return()=>{alive=false;};
  },[userId,offline,member,channel?.id,revision]);

  async function join() {
    if(!selected||!userId||offline||busy)return;
    setBusy(true);setError("");
    try{
      await requireOnline();
      const {error:joinError}=await supabase.from("hoop_group_members").insert({space_id:selected.id,user_id:userId});
      if(joinError)throw Error("Could not join community.");
      setJoined(current=>[...new Set([...current,selected.id])]);
    }catch(failure){setError(failure instanceof Error?failure.message:"Join failed.");}
    finally{setBusy(false);}
  }
  async function send() {
    if(!channel||!member||!userId||offline||busy||!draft.trim())return;
    setBusy(true);setError("");
    try{
      await requireOnline();
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw Error("Sign in again.");
      const {error:sendError}=await supabase.from("hoop_group_posts")
        .insert({channel_id:channel.id,author_id:userId,body:draft.trim().slice(0,1200),moderation_status:"pending"});
      if(sendError)throw Error("Could not submit this post. Slow mode allows one post per 20 seconds.");
      setDraft("");setRevision(value=>value+1);
    }catch(failure){setError(failure instanceof Error?failure.message:"Message was not submitted.");}
    finally{setBusy(false);}
  }
  async function report(item:Post,reason:string) {
    if(!userId||offline||busy)return;
    setBusy(true);setError("");
    const {error:reportError}=await supabase.from("hoop_group_reports")
      .insert({post_id:item.id,reporter_id:userId,reason});
    setError(reportError?"This message could not be reported or was already reported.":"Report submitted to HoopCheck moderators.");
    setBusy(false);
  }
  async function block(item:Post) {
    if(!userId||offline||busy||item.author_id===userId)return;
    setBusy(true);setError("");
    const {error:blockError}=await supabase.from("hoop_group_blocks")
      .insert({blocker_id:userId,blocked_id:item.author_id});
    if(blockError)setError("Could not block this account.");
    else setPosts(current=>current.filter(post=>post.author_id!==item.author_id));
    setBusy(false);
  }
  function actions(item:Post) {
    Alert.alert("Community safety","Choose an action for this member.",[
      {text:"Cancel",style:"cancel"},
      {text:"Report spam",onPress:()=>void report(item,"Spam or unwanted messages")},
      {text:"Report harassment",onPress:()=>void report(item,"Harassment or hateful content")},
      {text:"Block member",style:"destructive",onPress:()=>void block(item)},
    ]);
  }

  return <View style={{gap:12}}>
    <Text style={{color:theme.muted,fontSize:13}}>Moderated basketball servers: messages remain pending until approved. Team Fan Groups are separate.</Text>
    {loading?<Text style={{color:theme.muted}}>Loading community servers…</Text>:null}
    {error?<Text accessibilityRole="alert" style={{color:theme.accent}}>{error}</Text>:null}
    {offline?<Text style={{color:theme.muted}}>Reconnect to see your channels.</Text>:null}
    {!userId&&!loading?<Text style={{color:theme.muted}}>Sign in to join HoopGroups.</Text>:null}
    {Boolean(ordered.length)&&<><Text style={{color:theme.foreground,fontSize:17,fontWeight:"800"}}>Your community servers</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
        {ordered.map(space=><Pressable key={space.id} accessibilityRole="button" accessibilityState={{selected:selected?.id===space.id}}
          onPress={()=>{setSpaceId(space.id);setChannelId("");setDraft("");}}
          style={{minHeight:62,width:150,borderWidth:1,borderColor:selected?.id===space.id?theme.accent:theme.border,borderRadius:16,backgroundColor:selected?.id===space.id?theme.accentSurface:theme.surface,padding:10,justifyContent:"center"}}>
          <Text numberOfLines={2} style={{color:theme.foreground,fontWeight:"800"}}>{space.name}</Text>
          <Text style={{color:theme.muted,fontSize:11,marginTop:4}}>{joined.includes(space.id)?"Joined":"Browse server"}</Text>
        </Pressable>)}
      </ScrollView>
      <GlassCard><Text style={{color:theme.foreground,fontSize:19,fontWeight:"900"}}>{selected?.name}</Text>
        <Text style={{color:theme.muted,marginTop:5}}>{selected?.description}</Text>
        {!member?<Button disabled={busy||offline} onPress={()=>void join()}>Join community</Button>:null}
        {member?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,marginTop:12}}>
          {availableChannels.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityState={{selected:channel?.id===item.id}}
            onPress={()=>{setChannelId(item.id);setDraft("");}}
            style={{minHeight:44,justifyContent:"center",paddingHorizontal:12,borderRadius:12,backgroundColor:channel?.id===item.id?theme.accentSurface:theme.chip}}>
            <Text style={{color:theme.foreground,fontWeight:"700"}}># {item.name}</Text>
          </Pressable>)}
        </ScrollView>:null}
      </GlassCard>
      {member&&channel?<GlassCard>
        <Text style={{color:theme.foreground,fontSize:18,fontWeight:"900"}}># {channel.name}</Text>
        <Text style={{color:theme.muted,fontSize:12}}>Members only · moderated posts · 20-second slow mode</Text>
        {posts.length?posts.map(post=><View key={post.id} style={{borderBottomWidth:1,borderColor:theme.border,paddingVertical:10,gap:5}}>
          <Text style={{color:theme.foreground,fontWeight:"700"}}>{post.author_id===userId?"You":"Community member"}</Text>
          <Text style={{color:theme.foreground}}>{post.body}</Text>
          <Text style={{color:theme.muted,fontSize:11}}>{post.moderation_status==="approved"?"Approved":"Pending review · visible only to you"} · {new Date(post.created_at).toLocaleString()}</Text>
          {post.author_id!==userId&&post.moderation_status==="approved"?<Pressable accessibilityRole="button" style={{minHeight:40,justifyContent:"center"}} onPress={()=>actions(post)}><Text style={{color:theme.accent}}>Report or block</Text></Pressable>:null}
        </View>):<Text style={{color:theme.muted,marginVertical:14}}>No approved messages yet.</Text>}
        <TextInput accessibilityLabel={"Message in "+channel.name} multiline maxLength={1200} value={draft} onChangeText={setDraft} placeholder="Share a basketball discussion…" placeholderTextColor={theme.muted}
          style={{backgroundColor:theme.input,color:theme.foreground,borderWidth:1,borderColor:theme.border,padding:12,minHeight:75,textAlignVertical:"top",borderRadius:14}} />
        <Button disabled={busy||offline||!draft.trim()} onPress={()=>void send()}>{busy?"Submitting…":"Submit for moderation"}</Button>
      </GlassCard>:null}
    </>}
    {!loading&&!ordered.length&&!error?<Text style={{color:theme.muted}}>No community servers available.</Text>:null}
  </View>;
}
