"use client";
import {useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {useGroupAccess} from "../apps/mobile/src/native/useGroupAccess";
import type {GroupAccessAction} from "../apps/mobile/src/native/groupAccess";
export default function HoopGroupsAccessPanel({uid,space,onChanged}:{uid:string;space:string|null;onChanged:()=>void}){
 const {snapshot,busy,notice,run}=useGroupAccess(supabase,uid,space,onChanged);
 const [name,setName]=useState(""),[description,setDescription]=useState(""),[member,setMember]=useState("");
 const intent=useRef<{key:string;id:string}|null>(null);
 async function create(action:"create_private_group"|"create_private_channel"){
  const value=name.trim(),key=JSON.stringify([uid,space,action,value,description]);
  if(!intent.current||intent.current.key!==key)intent.current={key,id:crypto.randomUUID()};
  if(await run({action,target:intent.current.id,name:value,description:action==="create_private_group"?description.trim():undefined})){intent.current=null;setName("");setDescription("");}
 }
 const selected=snapshot?.members.find(m=>m.user_id===member&&m.role!=="owner");
 const button=(label:string,action:GroupAccessAction)=><button type="button" disabled={busy} onClick={()=>void run(action)}>{label}</button>;
 return <section aria-label="Private community access" className="dashboard-card">
  <h3>Community access & invitations</h3>
  <p>Private communities require a targeted invitation. Private channels require individual member access.</p>
  <button type="button" disabled={busy} onClick={()=>void run()}>Refresh permissions and invitations</button>
  <label>New private community or channel name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>
  <label>Community description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={300}/></label>
  <button type="button" disabled={busy||name.trim().length<3} onClick={()=>void create("create_private_group")}>Create private community</button>
  {snapshot?.is_owner&&space&&<button type="button" disabled={busy||name.trim().length<2||name.trim().length>50} onClick={()=>void create("create_private_channel")}>Create private channel</button>}
  {notice&&<p role="status">{notice}</p>}
  {snapshot&&<><h4>Your invitations</h4>{snapshot.invitations.length?snapshot.invitations.map(i=><div key={i.id}><strong>{i.group_name}</strong> · expires {new Date(i.expires_at).toLocaleDateString()} {button("Accept",{action:"accept_invite",target:i.id})} {button("Decline",{action:"decline_invite",target:i.id})}</div>):<p>No pending invitations.</p>}
   {snapshot.is_owner&&<><h4>Invite an accepted contact</h4>{snapshot.contacts.map(c=><div key={c.id}>{c.name} {button("Invite",{action:"invite",target:c.id})}</div>)}
   {snapshot.pending_invites.map(i=><div key={i.id}>Pending invitation · {new Date(i.expires_at).toLocaleDateString()} {button("Revoke invite",{action:"revoke_invite",target:i.id})}</div>)}
   <h4>Manage members</h4><label>Choose member<select value={member} onChange={e=>setMember(e.target.value)}><option value="">Select a member</option>{snapshot.members.filter(m=>m.role!=="owner").map(m=><option value={m.user_id} key={m.user_id}>{m.name} · {m.role} · {m.user_id.slice(0,6)}</option>)}</select></label>
   {selected&&<div><p>{selected.name} · {selected.role}</p>{button(selected.role==="moderator"?"Remove moderator":"Make moderator",{action:selected.role==="moderator"?"remove_moderator":"promote_moderator",target:selected.user_id})}
   <button type="button" disabled={busy} onClick={()=>{if(window.confirm("Remove this member from the community?"))void run({action:"remove_member",target:selected.user_id});}}>Remove member</button>
   <button type="button" disabled={busy} onClick={()=>{if(window.confirm("Remove and prevent this member from rejoining?"))void run({action:"ban_member",target:selected.user_id});}}>Ban member</button>
   {snapshot.private_channels.map(c=><div key={c.id}>{c.name} {button(selected.channels.includes(c.id)?"Revoke access":"Grant access",{action:selected.channels.includes(c.id)?"revoke_channel":"grant_channel",target:selected.user_id,channel:c.id})}</div>)}</div>}
   {snapshot.banned.map(m=><div key={m.user_id}>{m.name} · banned {button("Lift ban",{action:"unban",target:m.user_id})}</div>)}</>}
   {snapshot.can_moderate&&<><h4>Pending moderation</h4>{snapshot.queue.length?snapshot.queue.map(p=><article key={p.id}><p>{p.body}</p>{button("Approve",{action:"moderate",target:p.id,status:"approved"})} {button("Reject",{action:"moderate",target:p.id,status:"rejected"})}</article>):<p>No pending messages in accessible channels.</p>}</>}
  </>}
 </section>;
}
