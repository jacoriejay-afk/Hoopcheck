import {useRef,useState} from "react";
import {Alert,Text,TextInput,View} from "react-native";
import {randomUUID} from "expo-crypto";
import {Button} from "../src/primitives";
import {useEntryTheme} from "../src/theme";
import {supabase} from "../src/lib/supabase";
import {useGroupAccess} from "../src/native/useGroupAccess";
import type {GroupAccessAction} from "../src/native/groupAccess";
export function GroupAccessPanel({uid,space,onChanged}:{uid:string;space:string|null;onChanged:()=>void}){
 const t=useEntryTheme(),{snapshot,busy,notice,run}=useGroupAccess(supabase,uid,space,onChanged);
 const [name,setName]=useState(""),[description,setDescription]=useState(""),[member,setMember]=useState("");
 const intent=useRef<{key:string;id:string}|null>(null);
 async function create(action:"create_private_group"|"create_private_channel"){
  const value=name.trim(),key=JSON.stringify([uid,space,action,value,description]);
  if(!intent.current||intent.current.key!==key)intent.current={key,id:randomUUID()};
  if(await run({action,target:intent.current.id,name:value,description:action==="create_private_group"?description.trim():undefined})){intent.current=null;setName("");setDescription("");}
 }
 const selected=snapshot?.members.find(m=>m.user_id===member&&m.role!=="owner");
 const button=(label:string,action:GroupAccessAction)=><Button secondary disabled={busy} onPress={()=>void run(action)}>{label}</Button>;
 const confirm=(label:string,action:GroupAccessAction)=>Alert.alert(label,"This changes community membership immediately.",[{text:"Cancel",style:"cancel"},{text:"Confirm",style:"destructive",onPress:()=>void run(action)}]);
 return <View style={{gap:8,paddingVertical:10,borderTopWidth:1,borderColor:t.border}}>
  <Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800"}}>Community access & invitations</Text>
  <Text style={{color:t.muted}}>Private communities require an invitation. Private channels require individual access.</Text>
  <Button secondary disabled={busy} onPress={()=>void run()}>Refresh permissions and invitations</Button>
  <TextInput accessibilityLabel="New private community or channel name" placeholder="Private community or channel name" placeholderTextColor={t.muted} value={name} onChangeText={setName} maxLength={80} style={{color:t.foreground,backgroundColor:t.input,padding:10,minHeight:44}}/>
  <TextInput accessibilityLabel="Community description" placeholder="Community description" placeholderTextColor={t.muted} value={description} onChangeText={setDescription} maxLength={300} multiline style={{color:t.foreground,backgroundColor:t.input,padding:10,minHeight:44}}/>
  <Button secondary disabled={busy||name.trim().length<3} onPress={()=>void create("create_private_group")}>Create private community</Button>
  {snapshot?.is_owner&&space?<Button secondary disabled={busy||name.trim().length<2||name.trim().length>50} onPress={()=>void create("create_private_channel")}>Create private channel</Button>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={{color:t.muted}}>{notice}</Text>:null}
  {snapshot?<><Text style={{color:t.foreground,fontWeight:"800"}}>Your invitations</Text>{snapshot.invitations.length?snapshot.invitations.map(i=><View key={i.id} style={{gap:4}}><Text style={{color:t.foreground}}>{i.group_name} · expires {new Date(i.expires_at).toLocaleDateString()}</Text>{button("Accept",{action:"accept_invite",target:i.id})}{button("Decline",{action:"decline_invite",target:i.id})}</View>):<Text style={{color:t.muted}}>No pending invitations.</Text>}
  {snapshot.is_owner?<><Text style={{color:t.foreground,fontWeight:"800"}}>Invite accepted contacts</Text>{snapshot.contacts.map(c=><View key={c.id} style={{gap:4}}><Text style={{color:t.foreground}}>{c.name}</Text>{button("Invite",{action:"invite",target:c.id})}</View>)}{snapshot.pending_invites.map(i=><View key={i.id}><Text style={{color:t.muted}}>Pending · {new Date(i.expires_at).toLocaleDateString()}</Text>{button("Revoke invite",{action:"revoke_invite",target:i.id})}</View>)}
  <Text style={{color:t.foreground,fontWeight:"800"}}>Manage members</Text>{snapshot.members.filter(m=>m.role!=="owner").map(m=><Button secondary key={m.user_id} disabled={busy} onPress={()=>setMember(m.user_id)}>{m.name} · {m.role} · {m.user_id.slice(0,6)}</Button>)}
  {selected?<View style={{gap:4}}><Text style={{color:t.foreground}}>{selected.name} · {selected.role}</Text>{button(selected.role==="moderator"?"Remove moderator":"Make moderator",{action:selected.role==="moderator"?"remove_moderator":"promote_moderator",target:selected.user_id})}
  <Button secondary disabled={busy} onPress={()=>confirm("Remove member?",{action:"remove_member",target:selected.user_id})}>Remove member</Button>
  <Button secondary disabled={busy} onPress={()=>confirm("Ban member?",{action:"ban_member",target:selected.user_id})}>Ban member</Button>
  {snapshot.private_channels.map(c=><View key={c.id}><Text style={{color:t.foreground}}>{c.name}</Text>{button(selected.channels.includes(c.id)?"Revoke access":"Grant access",{action:selected.channels.includes(c.id)?"revoke_channel":"grant_channel",target:selected.user_id,channel:c.id})}</View>)}</View>:null}
  {snapshot.banned.map(m=><View key={m.user_id}><Text style={{color:t.muted}}>{m.name} · banned</Text>{button("Lift ban",{action:"unban",target:m.user_id})}</View>)}</>:null}
  {snapshot.can_moderate?<><Text style={{color:t.foreground,fontWeight:"800"}}>Pending moderation</Text>{snapshot.queue.length?snapshot.queue.map(p=><View key={p.id} style={{gap:4}}><Text style={{color:t.foreground}}>{p.body}</Text>{button("Approve",{action:"moderate",target:p.id,status:"approved"})}{button("Reject",{action:"moderate",target:p.id,status:"rejected"})}</View>):<Text style={{color:t.muted}}>No pending messages in accessible channels.</Text>}</>:null}
  </>:null}
 </View>;
}
