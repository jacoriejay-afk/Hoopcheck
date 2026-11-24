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
const colorOptions = { orange:"#FF873C", blue:"#60A5FA", purple:"#A78BFA", green:"#4ADE80", pink:"#F472B6", gold:"#FBBF24" } as const;
const iconOptions = { basketball:"🏀", flame:"🔥", globe:"🌐", star:"⭐", trophy:"🏆", users:"👥" } as const;
const accent = (name:string) => colorOptions[name as keyof typeof colorOptions] ?? colorOptions.orange;
const emblem = (name:string) => iconOptions[name as keyof typeof iconOptions] ?? iconOptions.basketball;
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
  const [editing,setEditing]=useState(false);
  const [editName,setEditName]=useState("");
  const [editDescription,setEditDescription]=useState("");
  const [editColor,setEditColor]=useState<keyof typeof colorOptions>("orange");
  const [editIcon,setEditIcon]=useState<keyof typeof iconOptions>("basketball");
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
  async function createGroup() {
    const name=newName.trim();
    const description=newDescription.trim();
    if(!userId || offline || busy || name.length<3 || name.length>80 || description.length>300)return;
    if(!["global","players","fans","coaches","agents","womens"].includes(newCategory))return;
    setBusy(true);setError("");
    try{
      await requireOnline();
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw Error("Your account changed. Sign in again.");
      const base=name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40).replace(/-+$/g,"")||"court";
      const slug=(base+"-"+Math.random().toString(36).slice(2,10)).slice(0,60);
      const {data,error:createError}=await supabase.from("hoop_group_spaces")
        .insert({slug,name,description,category:newCategory,owner_id:userId,accent_color:"orange",icon_key:"basketball"})
        .select("id,slug,name,category,description,owner_id,accent_color,icon_key").single();
      if(createError||!data)throw Error("Group creation was not confirmed. You can own up to three groups.");
      setSpaces(current=>[...current,data as Space]);setSpaceId(data.id);
      setFilter("discover");setQuery("");setCreating(false);setNewName("");setNewDescription("");
      setRevision(value=>value+1);
    }catch(failure){setError(failure instanceof Error?failure.message:"Could not create group.");}
    finally{setBusy(false);}
  }
  function beginManage() {
    if (!selected || selected.owner_id !== userId) return;
    setEditName(selected.name);setEditDescription(selected.description);
    setEditColor(selected.accent_color in colorOptions
      ? selected.accent_color as keyof typeof colorOptions : "orange");
    setEditIcon(selected.icon_key in iconOptions
      ? selected.icon_key as keyof typeof iconOptions : "basketball");
    setEditing(true);
  }
  async function saveGroup() {
    const name=editName.trim();
    const description=editDescription.trim();
    if(!selected || !userId || selected.owner_id!==userId || offline || busy
      || name.length<3 || name.length>80 || description.length>300
      || !(editColor in colorOptions) || !(editIcon in iconOptions))return;
    const id=selected.id;
    setBusy(true);setError("");
    try{
      await requireOnline();
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw Error("Your account changed. Sign in again.");
      const {data,error:updateError}=await supabase.from("hoop_group_spaces")
        .update({name,description,accent_color:editColor,icon_key:editIcon})
        .eq("id",id).eq("owner_id",userId)
        .select("id,slug,name,category,description,owner_id,accent_color,icon_key").single();
      if(updateError || !data || data.id!==id || data.owner_id!==userId)
        throw Error("Group settings could not be saved.");
      setSpaces(current=>current.map(space=>space.id===id?data as Space:space));
      setEditing(false);
    }catch(failure){setError(failure instanceof Error?failure.message:"Could not update community.");}
    finally{setBusy(false);}
  }

  async function leaveGroup() {
    if(!selected||!userId||offline||busy||!member)return;
    setBusy(true);setError("");
    try{
      await requireOnline();
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw Error("Sign in again.");
      const {error:leaveError}=await supabase.from("hoop_group_members")
        .delete().eq("space_id",selected.id).eq("user_id",userId);
      if(leaveError)throw Error("Could not leave this group.");
      setJoined(current=>current.filter(id=>id!==selected.id));setPosts([]);setDraft("");
    }catch(failure){setError(failure instanceof Error?failure.message:"Could not leave group.");}
    finally{setBusy(false);}
  }
  async function createChannel() {
    const name=newChannel.trim();
    if(!selected||selected.owner_id!==userId||!userId||offline||busy||name.length<2||name.length>50||availableChannels.length>=12)return;
    setBusy(true);setError("");
    try{
      await requireOnline();
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==userId)throw Error("Sign in again.");
      const slug=name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40)||"discussion";
      const {data,error:channelError}=await supabase.from("hoop_group_channels")
        .insert({space_id:selected.id,slug,name,sort_index:availableChannels.length})
        .select("id,space_id,name,slug,sort_index").single();
      if(channelError||!data)throw Error("Could not create a new discussion topic.");
      setChannels(current=>[...current,data as Channel]);setChannelId(data.id);setNewChannel("");
    }catch(failure){setError(failure instanceof Error?failure.message:"Topic creation failed.");}
    finally{setBusy(false);}
  }
  async function shareGroup() {
    if(!selected)return;
    await Share.share({message:`Join ${selected.name} on HoopGroups: https://hoopcheck.online/hoopgroups?group=${encodeURIComponent(selected.slug)}`});
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
    <Text style={{color:theme.muted,fontSize:13,lineHeight:19}}>
      Independent basketball communities, member-created groups and moderated discussion channels.
    </Text>
    {loading?<HoopCheckLoading label="Finding HoopGroups…" />:null}
    {error?<Text accessibilityRole="alert" style={{color:theme.accent}}>{error}</Text>:null}
    {offline?<Text style={{color:theme.muted}}>Reconnect to see your groups.</Text>:null}
    {!userId&&!loading?<Text style={{color:theme.muted}}>Sign in to discover HoopGroups.</Text>:null}
    {Boolean(userId)&&!offline?<>
      <TextInput accessibilityLabel="Search HoopGroups" placeholder="Search group names and topics…" placeholderTextColor={theme.muted}
        value={query} maxLength={100} onChangeText={setQuery}
        style={{minHeight:46,paddingHorizontal:12,color:theme.foreground,backgroundColor:theme.input,
          borderColor:theme.glassBorder,borderWidth:1,borderRadius:14}} />
      <View accessibilityRole="tablist" style={{flexDirection:"row",gap:6}}>
        {(["discover","joined","mine"] as const).map(value=><Pressable key={value}
          accessibilityRole="tab" accessibilityState={{selected:filter===value}}
          accessibilityLabel={value==="discover"?"Discover groups":value==="joined"?"Joined groups":"My groups"}
          onPress={()=>setFilter(value)}
          style={{minHeight:44,flex:1,justifyContent:"center",alignItems:"center",borderRadius:12,
            backgroundColor:filter===value?theme.accentSurface:theme.surface,
            borderWidth:1,borderColor:filter===value?theme.accent:theme.glassBorder}}>
          <Text style={{color:filter===value?theme.accent:theme.foreground,fontWeight:"800",fontSize:12}}>
            {value==="discover"?"Discover":value==="joined"?"Joined":"My groups"}
          </Text>
        </Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={creating?"Cancel new group":"Create a group"}
        onPress={()=>setCreating(value=>!value)}
        style={{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,
          borderRadius:13,borderWidth:1,borderColor:theme.glassBorder,backgroundColor:theme.surface}}>
        <Text style={{color:theme.accent,fontWeight:"800"}}>{creating?"Cancel":"＋ Create your group"}</Text>
      </Pressable>
      {creating?<GlassCard style={{gap:9}}>
        <Text style={{color:theme.foreground,fontWeight:"900",fontSize:17}}>Create an independent group</Text>
        <Text style={{color:theme.muted,fontSize:12}}>Choose a name, description and basketball topic. You can own up to three groups.</Text>
        <TextInput accessibilityLabel="Group name" placeholder="Group name" placeholderTextColor={theme.muted}
          maxLength={80} value={newName} onChangeText={setNewName}
          style={{color:theme.foreground,minHeight:44,backgroundColor:theme.input,borderRadius:10,paddingHorizontal:10}} />
        <TextInput accessibilityLabel="Group description" placeholder="What is this group for?" placeholderTextColor={theme.muted}
          maxLength={300} value={newDescription} onChangeText={setNewDescription} multiline
          style={{color:theme.foreground,minHeight:62,backgroundColor:theme.input,borderRadius:10,padding:10,textAlignVertical:"top"}} />
        <Text style={{color:theme.muted,fontSize:12}}>Basketball topic</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:6}}>
          {([{value:"global",label:"Basketball"},{value:"players",label:"Players"},{value:"fans",label:"Supporters"},
             {value:"coaches",label:"Coaches"},{value:"agents",label:"Scouting"},{value:"womens",label:"Women’s hoops"}]).map(item=>
            <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{checked:newCategory===item.value}}
              onPress={()=>setNewCategory(item.value)}
              style={{minHeight:40,justifyContent:"center",paddingHorizontal:10,borderRadius:12,
                borderWidth:1,borderColor:newCategory===item.value?theme.accent:theme.glassBorder}}>
              <Text style={{color:newCategory===item.value?theme.accent:theme.foreground,fontSize:12}}>{item.label}</Text>
            </Pressable>)}
        </View>
        <Button disabled={busy||newName.trim().length<3||newDescription.trim().length>300}
          onPress={()=>void createGroup()}>{busy?"Creating…":"Create group"}</Button>
      </GlassCard>:null}
    </>:null}
    {Boolean(filtered.length)&&<>
      <Text accessibilityRole="header" style={{color:theme.foreground,fontSize:17,fontWeight:"900"}}>
        {filter==="joined"?"Joined groups":filter==="mine"?"Your groups":"Discover communities"}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
        {filtered.map(space=><Pressable key={space.id} accessibilityRole="button"
          accessibilityState={{selected:selected?.id===space.id}}
          accessibilityLabel={`Open ${space.name} group`}
          onPress={()=>{setSpaceId(space.id);setChannelId("");setDraft("");}}
          style={{minHeight:68,width:160,borderWidth:1,borderColor:selected?.id===space.id?theme.accent:theme.glassBorder,
            borderRadius:16,backgroundColor:selected?.id===space.id?theme.accentSurface:theme.surface,padding:10,justifyContent:"center"}}>
          <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
            <Text accessibilityLabel={space.icon_key+" group icon"} style={{fontSize:23}}>{emblem(space.icon_key)}</Text>
            <Text numberOfLines={2} style={{color:theme.foreground,fontWeight:"800",flex:1}}>{space.name}</Text>
          </View>
          <Text style={{color:theme.muted,fontSize:11,marginTop:4}}>
            {space.owner_id===userId?"Your group":joined.includes(space.id)?"Joined":"Discover"}
          </Text>
        </Pressable>)}
      </ScrollView>
      <GlassCard style={{gap:10}}>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <View style={{flex:1,gap:4}}>
            <Text style={{color:theme.foreground,fontSize:18,fontWeight:"900"}}>{selected?.name}</Text>
            <Text style={{color:theme.muted,fontSize:12}}>{selected?.description}</Text>
            <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
              <Text style={{fontSize:19}}>{selected?emblem(selected.icon_key):"🏀"}</Text>
              <View style={{width:8,height:8,borderRadius:4,backgroundColor:accent(selected?.accent_color||"orange")}}/>
              <Text style={{color:theme.muted,fontSize:11}}>Independent HoopGroup</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Share group invite" onPress={()=>void shareGroup()}
            style={{minHeight:44,minWidth:44,justifyContent:"center",alignItems:"center"}}>
            <Text style={{color:theme.accent,fontSize:12,fontWeight:"800"}}>Share</Text>
          </Pressable>
        </View>
        {selected?.owner_id===userId?<Pressable accessibilityRole="button"
          accessibilityLabel={editing?"Close group settings":"Manage group appearance"}
          onPress={()=>editing?setEditing(false):beginManage()}
          style={{minHeight:42,justifyContent:"center",alignSelf:"flex-start"}}>
          <Text style={{color:theme.accent,fontWeight:"800"}}>
            {editing?"Close settings":"Customize your group"}
          </Text>
        </Pressable>:null}
        {editing && selected?.owner_id===userId?<View style={{gap:10,paddingVertical:10,borderTopWidth:1,borderColor:theme.glassBorder}}>
          <Text style={{color:theme.foreground,fontWeight:"900"}}>Group appearance</Text>
          <TextInput accessibilityLabel="Edit group name" maxLength={80} value={editName} onChangeText={setEditName}
            style={{color:theme.foreground,backgroundColor:theme.input,minHeight:44,borderRadius:11,paddingHorizontal:10}} />
          <TextInput accessibilityLabel="Edit group description" maxLength={300} multiline value={editDescription}
            onChangeText={setEditDescription} style={{color:theme.foreground,backgroundColor:theme.input,minHeight:62,
              borderRadius:11,paddingHorizontal:10,paddingVertical:8,textAlignVertical:"top"}} />
          <Text style={{color:theme.muted,fontSize:12}}>Community color</Text>
          <View style={{flexDirection:"row",gap:10,flexWrap:"wrap"}}>
            {(Object.keys(colorOptions) as (keyof typeof colorOptions)[]).map(name=><Pressable key={name}
              accessibilityRole="radio" accessibilityLabel={name+" group color"}
              accessibilityState={{checked:editColor===name}}
              onPress={()=>setEditColor(name)}
              style={{width:40,height:40,borderRadius:20,backgroundColor:colorOptions[name],
                borderWidth:editColor===name?3:0,borderColor:theme.foreground,alignItems:"center",justifyContent:"center"}}>
              {editColor===name?<Text style={{color:"#111827",fontWeight:"900"}}>✓</Text>:null}
            </Pressable>)}
          </View>
          <Text style={{color:theme.muted,fontSize:12}}>Community emblem</Text>
          <View style={{flexDirection:"row",gap:7,flexWrap:"wrap"}}>
            {(Object.keys(iconOptions) as (keyof typeof iconOptions)[]).map(name=><Pressable key={name}
              accessibilityRole="radio" accessibilityLabel={name+" group emblem"}
              accessibilityState={{checked:editIcon===name}}
              onPress={()=>setEditIcon(name)}
              style={{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center",
                borderWidth:editIcon===name?1:0,borderColor:theme.accent,borderRadius:12,
                backgroundColor:editIcon===name?theme.accentSurface:"transparent"}}>
              <Text style={{fontSize:24}}>{iconOptions[name]}</Text>
            </Pressable>)}
          </View>
          <Button disabled={busy||offline||editName.trim().length<3||editDescription.trim().length>300}
            onPress={()=>void saveGroup()}>{busy?"Saving…":"Save group settings"}</Button>
        </View>:null}
        {!member?<Button disabled={busy||offline} onPress={()=>void join()}>Join group</Button>:
          <Pressable accessibilityRole="button" accessibilityLabel="Leave group" disabled={busy||offline}
            onPress={()=>void leaveGroup()} style={{minHeight:40,justifyContent:"center",alignItems:"flex-start"}}>
            <Text style={{color:theme.accent,fontSize:12,fontWeight:"800"}}>Leave group</Text>
          </Pressable>}
        {member?<>
          <Text style={{color:theme.muted,fontSize:11,fontWeight:"800",letterSpacing:1}}>DISCUSSION CHANNELS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
            {availableChannels.map(item=><Pressable key={item.id} accessibilityRole="button"
              accessibilityState={{selected:channel?.id===item.id}}
              onPress={()=>{setChannelId(item.id);setDraft("");}}
              style={{minHeight:44,justifyContent:"center",paddingHorizontal:11,borderRadius:11,
                backgroundColor:channel?.id===item.id?theme.accentSurface:theme.chip}}>
              <Text style={{color:theme.foreground,fontWeight:"700"}}># {item.name}</Text>
            </Pressable>)}
          </ScrollView>
          {selected?.owner_id===userId&&availableChannels.length<12?<View style={{flexDirection:"row",gap:8}}>
            <TextInput accessibilityLabel="New discussion channel" placeholder="New channel name" placeholderTextColor={theme.muted}
              maxLength={50} value={newChannel} onChangeText={setNewChannel}
              style={{flex:1,minHeight:44,color:theme.foreground,backgroundColor:theme.input,
                borderRadius:11,paddingHorizontal:10}} />
            <Button secondary disabled={busy||newChannel.trim().length<2} onPress={()=>void createChannel()}>Add topic</Button>
          </View>:null}
        </>:null}
      </GlassCard>
      {member&&channel?<GlassCard style={{gap:10}}>
        <Text style={{color:theme.foreground,fontSize:17,fontWeight:"900"}}># {channel.name}</Text>
        <Text style={{color:theme.muted,fontSize:12}}>Members only · moderated posts · 20-second slow mode</Text>
        {posts.length?posts.map(post=><View key={post.id}
          style={{borderBottomWidth:1,borderColor:theme.border,paddingVertical:10,gap:5}}>
          <Text style={{color:theme.foreground,fontWeight:"700"}}>{post.author_id===userId?"You":"Community member"}</Text>
          <Text style={{color:theme.foreground}}>{post.body}</Text>
          <Text style={{color:theme.muted,fontSize:11}}>{post.moderation_status==="approved"?"Approved":"Pending review · visible only to you"} · {new Date(post.created_at).toLocaleString()}</Text>
          {post.author_id!==userId&&post.moderation_status==="approved"?<Pressable accessibilityRole="button"
            style={{minHeight:40,justifyContent:"center"}} onPress={()=>actions(post)}>
            <Text style={{color:theme.accent}}>Report or block</Text>
          </Pressable>:null}
        </View>):<Text style={{color:theme.muted,marginVertical:12}}>No approved messages yet.</Text>}
        <TextInput accessibilityLabel={"Message in "+channel.name} multiline maxLength={1200}
          value={draft} onChangeText={setDraft} placeholder="Post to this discussion…" placeholderTextColor={theme.muted}
          style={{backgroundColor:theme.input,color:theme.foreground,borderWidth:1,borderColor:theme.border,
            padding:12,minHeight:72,textAlignVertical:"top",borderRadius:14}} />
        <Button disabled={busy||offline||!draft.trim()} onPress={()=>void send()}>{busy?"Submitting…":"Post for approval"}</Button>
      </GlassCard>:null}
    </>}
    {!loading&&!filtered.length&&!error?<Text style={{color:theme.muted}}>
      {filter==="joined"?"You haven’t joined any groups yet.":filter==="mine"?"You haven’t created a group yet.":"No communities match this search."}
    </Text>:null}
  </View>;
}
