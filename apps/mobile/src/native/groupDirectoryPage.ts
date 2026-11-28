import type {SupabaseClient} from "@supabase/supabase-js";
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const text=(v:unknown,max:number):v is string=>typeof v==="string"&&v.length<=max;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export type DirectoryMode="all"|"joined"|"mine"|"recommended";
export type DirectoryInput={query:string;mode:DirectoryMode;after:string|null;slug?:string|null};
export type DirectorySpace={id:string;slug:string;name:string;category:string;description:string;owner_id:string|null;accent_color:string;icon_key:string};
export type DirectoryChannel={id:string;space_id:string;slug:string;name:string;sort_index:number};
export async function readGroupDirectoryPage(client:SupabaseClient,owner:string,bearer:string,input:DirectoryInput,signal:AbortSignal){
 if(!uuid(owner)||!/^Bearer [^\s]+$/.test(bearer)||signal.aborted||input.query.length>80||!["all","joined","mine","recommended"].includes(input.mode)||input.after!==null&&!uuid(input.after)||input.slug!=null&&(!/^[a-z0-9-]{3,60}$/.test(input.slug)||input.after!==null||input.query!==""||input.mode!=="all"))throw Error("Invalid directory request.");
 const r=await client.rpc("hoop_group_directory_page",{p_query:input.query,p_mode:input.mode,p_after:input.after,p_slug:input.slug??null}).setHeader("Authorization",bearer).abortSignal(signal);
 const data:unknown=r.data;
 if(signal.aborted||r.error||!record(data)||!Array.isArray(data.rows)||data.rows.length>50||typeof data.has_more!=="boolean"||data.has_more&&data.rows.length!==50||!Array.isArray(data.channels)||data.channels.length>600)throw Error("Community directory unavailable.");
 const spaces:DirectorySpace[]=[],channels:DirectoryChannel[]=[],joined:string[]=[];
 const ids=new Set<string>(),channelIds=new Set<string>();
 for(const s of data.rows){
  if(!record(s)||!uuid(s.id)||s.id===input.after||ids.has(s.id)||!text(s.slug,60)||!text(s.name,80)||!text(s.category,20)||!text(s.description,300)||!(s.owner_id===null||uuid(s.owner_id))||!text(s.accent_color,20)||!text(s.icon_key,20)||typeof s.joined!=="boolean"||input.mode==="joined"&&!s.joined||input.mode==="mine"&&s.owner_id!==owner||input.mode==="recommended"&&(s.joined||s.owner_id===owner)||input.slug&&s.slug!==input.slug)throw Error("Invalid community directory.");
  ids.add(s.id);if(s.joined)joined.push(s.id);
  spaces.push({id:s.id,slug:s.slug,name:s.name,category:s.category,description:s.description,owner_id:s.owner_id,accent_color:s.accent_color,icon_key:s.icon_key});
 }
 for(const c of data.channels){
  if(!record(c)||!uuid(c.id)||channelIds.has(c.id)||!uuid(c.space_id)||!ids.has(c.space_id)||!text(c.slug,40)||!text(c.name,50)||typeof c.sort_index!=="number"||!Number.isSafeInteger(c.sort_index))throw Error("Invalid community channel.");
  channelIds.add(c.id);channels.push({id:c.id,space_id:c.space_id,slug:c.slug,name:c.name,sort_index:c.sort_index});
 }
 const session=await client.auth.getSession();
 if(signal.aborted||session.error||session.data.session?.user.id!==owner||"Bearer "+session.data.session.access_token!==bearer)throw Error("Account changed.");
 return {spaces,channels,joined,next:data.has_more?spaces[spaces.length-1].id:null};
}
