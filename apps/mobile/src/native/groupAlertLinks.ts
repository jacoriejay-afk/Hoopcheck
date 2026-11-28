import type {SupabaseClient} from "@supabase/supabase-js";
export function groupAlertId(v:unknown):string|null{return typeof v==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)?v.toLowerCase():null;}
type Space={id:string;slug:string;name:string;category:string;description:string;owner_id:string|null;accent_color:string;icon_key:string};
type Channel={id:string;space_id:string;slug:string;name:string;sort_index:number};
export async function resolveGroupChannelLink(client:SupabaseClient,uid:string,hint:string,bearer:string,signal:AbortSignal):Promise<{space:Space;channel:Channel}|null>{
 if(!groupAlertId(uid)||!groupAlertId(hint)||!/^Bearer [^\s]+$/.test(bearer)||signal.aborted)throw Error("Discussion unavailable.");
 const c=await client.from("hoop_group_channels").select("id,space_id,slug,name,sort_index").eq("id",hint).setHeader("Authorization",bearer).abortSignal(signal).maybeSingle();
 if(c.error||signal.aborted)throw Error("Discussion unavailable.");
 if(!c.data)return null;
 if(c.data.id!==hint||!groupAlertId(c.data.space_id)||typeof c.data.name!=="string"||typeof c.data.slug!=="string"||!Number.isFinite(c.data.sort_index))throw Error("Invalid discussion.");
 const spaceId=c.data.space_id;
 const [s,m]=await Promise.all([
 client.from("hoop_group_spaces").select("id,slug,name,category,description,owner_id,accent_color,icon_key").eq("id",spaceId).setHeader("Authorization",bearer).abortSignal(signal).maybeSingle(),
 client.from("hoop_group_members").select("space_id,user_id").eq("space_id",spaceId).eq("user_id",uid).setHeader("Authorization",bearer).abortSignal(signal).maybeSingle()
 ]);
 if(s.error||m.error||signal.aborted)throw Error("Discussion unavailable.");
 if(!s.data||m.data?.space_id!==spaceId||m.data?.user_id!==uid)return null;
 const spaceData:Record<string,unknown>=s.data;
 if(s.data.id!==spaceId||["slug","name","category","description","accent_color","icon_key"].some(k=>typeof spaceData[k]!=="string")||!(s.data.owner_id===null||groupAlertId(s.data.owner_id)))throw Error("Invalid discussion.");
 const latest=await client.auth.getSession();
 if(signal.aborted||latest.error||latest.data.session?.user.id!==uid||"Bearer "+latest.data.session.access_token!==bearer)throw Error("Account changed.");
 return {space:s.data as Space,channel:c.data as Channel};
}
