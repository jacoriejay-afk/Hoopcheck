import type {SupabaseClient} from "@supabase/supabase-js";
import {withHoopChatDeadline} from "./hoopChatLoad.ts";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function record(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function id(v:unknown):v is string{return typeof v==="string"&&uuid.test(v);}
function label(v:unknown,max=120):v is string{return typeof v==="string"&&v.length>0&&v.length<=max;}
function date(v:unknown):v is string{return typeof v==="string"&&Number.isFinite(Date.parse(v));}
export type Member={user_id:string;name:string;role:"owner"|"moderator"|"member";channels:string[]};
export type Contact={id:string;name:string};
export type Invite={id:string;group_name:string;expires_at:string};
export type GroupAccessSnapshot={space_id:string|null;is_owner:boolean;can_moderate:boolean;members:Member[];contacts:Contact[];private_channels:Contact[];banned:{user_id:string;name:string}[];invitations:Invite[];pending_invites:{id:string;invitee_id:string;expires_at:string}[];queue:{id:string;channel_id:string;body:string;created_at:string}[]};
export type GroupAccessAction={action:"create_private_group"|"create_private_channel"|"invite"|"accept_invite"|"decline_invite"|"revoke_invite"|"remove_member"|"ban_member"|"unban"|"promote_moderator"|"remove_moderator"|"grant_channel"|"revoke_channel"|"moderate";target:string;channel?:string;name?:string;description?:string;status?:"approved"|"rejected"|"removed"};
export function decodeGroupAccessSnapshot(v:unknown,space:string|null):GroupAccessSnapshot{
 if(!record(v)||v.space_id!==space||typeof v.is_owner!=="boolean"||typeof v.can_moderate!=="boolean"||(v.is_owner&&!v.can_moderate))throw Error("Group permissions unavailable.");
 const data=v;
 function list(key:string,limit:number){const rows=data[key];if(!Array.isArray(rows)||rows.length>limit||!rows.every(record))throw Error("Group permissions unavailable.");return rows as Record<string,unknown>[];}
 const members=list("members",100).map(x=>{
  if(!id(x.user_id)||!label(x.name)||!(x.role==="owner"||x.role==="moderator"||x.role==="member")||!Array.isArray(x.channels)||x.channels.length>12||!x.channels.every(id))throw Error("Invalid member list.");
  return {user_id:x.user_id,name:x.name,role:x.role,channels:x.channels as string[]} as Member;
 });
 function names(key:string,limit:number){return list(key,limit).map(x=>{if(!id(x.id)||!label(x.name))throw Error("Invalid group access response.");return {id:x.id,name:x.name};});}
 const contacts=names("contacts",100),private_channels=names("private_channels",12);
 const banned=list("banned",100).map(x=>{if(!id(x.user_id)||!label(x.name))throw Error("Invalid member list.");return {user_id:x.user_id,name:x.name};});
 const invitations=list("invitations",100).map(x=>{if(!id(x.id)||!label(x.group_name,80)||!date(x.expires_at))throw Error("Invalid group invite.");return {id:x.id,group_name:x.group_name,expires_at:x.expires_at};});
 const pending_invites=list("pending_invites",100).map(x=>{if(!id(x.id)||!id(x.invitee_id)||!date(x.expires_at))throw Error("Invalid group invite.");return {id:x.id,invitee_id:x.invitee_id,expires_at:x.expires_at};});
 const queue=list("queue",100).map(x=>{if(!id(x.id)||!id(x.channel_id)||!label(x.body,1200)||!date(x.created_at))throw Error("Invalid moderation queue.");return {id:x.id,channel_id:x.channel_id,body:x.body,created_at:x.created_at};});
 if(!v.is_owner&&(members.length||contacts.length||private_channels.length||banned.length||pending_invites.length)||!v.can_moderate&&queue.length)throw Error("Unapproved group data.");
 return {space_id:space,is_owner:v.is_owner,can_moderate:v.can_moderate,members,contacts,private_channels,banned,invitations,pending_invites,queue};
}
async function verified(client:SupabaseClient,uid:string,signal:AbortSignal){
 if(!id(uid)||signal.aborted)throw Error("Group account unavailable.");
 const session=await client.auth.getSession(),token=session.data.session?.access_token;
 if(session.error||session.data.session?.user.id!==uid||!token||signal.aborted)throw Error("Sign in again.");
 const check=async()=>{
  const identity=await client.auth.getUser(token),latest=await client.auth.getSession();
  if(signal.aborted||identity.error||identity.data.user?.id!==uid||latest.error||latest.data.session?.user.id!==uid||latest.data.session.access_token!==token)throw Error("Account changed.");
 };
 await check();
 return {header:"Bearer "+token,check};
}
export async function readGroupAccess(client:SupabaseClient,uid:string,space:string|null,signal:AbortSignal){
 if(space!==null&&!id(space))throw Error("Invalid group.");
 const {header,check}=await verified(client,uid,signal);
 const r=await client.rpc("hoop_group_access_snapshot",{p_space:space}).setHeader("Authorization",header).abortSignal(signal);
 if(r.error||signal.aborted)throw Error("Group permissions unavailable.");
 await check();return decodeGroupAccessSnapshot(r.data,space);
}
const allowed=new Set(["create_private_group","create_private_channel","invite","accept_invite","decline_invite","revoke_invite","remove_member","ban_member","unban","promote_moderator","remove_moderator","grant_channel","revoke_channel","moderate"]);
export async function mutateGroupAccess(client:SupabaseClient,uid:string,space:string|null,action:GroupAccessAction,signal:AbortSignal){
 if(!allowed.has(action.action)||!id(action.target)||(space!==null&&!id(space))||(action.channel!==undefined&&!id(action.channel)))throw Error("Invalid group action.");
 const {header,check}=await verified(client,uid,signal);
 const r=await client.rpc("hoop_group_access_action",{p_action:action.action,p_space:space,p_target:action.target,p_channel:action.channel??null,p_name:action.name??null,p_description:action.description??null,p_status:action.status??null}).setHeader("Authorization",header).abortSignal(signal);
 if(r.error||signal.aborted||!record(r.data)||r.data.ok!==true||!id(r.data.id))throw Error("Group action not confirmed.");
 await check();return r.data.id;
}
export function groupAccessDeadline<T>(fn:(signal:AbortSignal)=>Promise<T>,controller:AbortController){return withHoopChatDeadline(fn,20000,controller);}

export async function readGroupMemberPage(client:SupabaseClient,uid:string,space:string,after:string|null,query:string,signal:AbortSignal){
 if(!id(space)||after!==null&&!id(after)||query.length>80)throw Error("Invalid roster request.");
 const {header,check}=await verified(client,uid,signal);
 const r=await client.rpc("hoop_group_member_page",{p_space:space,p_after:after,p_query:query}).setHeader("Authorization",header).abortSignal(signal);
 const v=r.data;
 if(signal.aborted||r.error||!record(v)||v.space_id!==space||typeof v.has_more!=="boolean"||!Array.isArray(v.rows)||v.rows.length>50||v.has_more&&v.rows.length!==50)throw Error("Group roster unavailable.");
 const members:Member[]=[],seen=new Set<string>();let next:string|null=null;
 for(const x of v.rows){
  if(!record(x)||!id(x.user_id)||x.user_id===after||seen.has(x.user_id)||!label(x.name)||!(x.role==="owner"||x.role==="moderator"||x.role==="member")||!Array.isArray(x.channels)||x.channels.length>12||!x.channels.every(id))throw Error("Invalid group roster.");
  seen.add(x.user_id);next=x.user_id;members.push({user_id:x.user_id,name:x.name,role:x.role,channels:x.channels as string[]});
 }
 await check();return {members,next:v.has_more?next:null};
}

export async function readGroupInvitation(client:SupabaseClient,uid:string,invite:string,signal:AbortSignal):Promise<Invite|null>{
 if(!id(invite))throw Error("Invalid invitation.");
 const {header,check}=await verified(client,uid,signal);
 const r=await client.rpc("hoop_group_invitation_detail",{p_invite:invite}).setHeader("Authorization",header).abortSignal(signal);
 if(signal.aborted||r.error)throw Error("Invitation unavailable.");
 await check();
 if(r.data===null)return null;
 const v=r.data;
 if(!record(v)||v.id!==invite||!label(v.group_name,80)||!date(v.expires_at))throw Error("Invalid invitation.");
 return {id:invite,group_name:v.group_name,expires_at:v.expires_at};
}
export async function groupAlertPreference(client:SupabaseClient,uid:string,space:string,channel:string|null,enabled:boolean|null,signal:AbortSignal){
 if(!id(space)||channel!==null&&!id(channel)||enabled!==null&&typeof enabled!=="boolean")throw Error("Invalid group alert preference.");
 const {header,check}=await verified(client,uid,signal);
 const r=await client.rpc("hoop_group_alert_preference",{p_space:space,p_channel:channel,p_enabled:enabled}).setHeader("Authorization",header).abortSignal(signal);
 if(signal.aborted||r.error||typeof r.data!=="boolean"||enabled!==null&&r.data!==enabled)throw Error("Group notification preference unavailable.");
 await check();return r.data as boolean;
}
