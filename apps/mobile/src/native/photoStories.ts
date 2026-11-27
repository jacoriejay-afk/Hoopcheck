import type { SupabaseClient } from "@supabase/supabase-js";
import type { Photo } from "./mediaSelection";
import { isFeedId } from "./feedClient.ts";
import { PublicationUnconfirmed } from "./mediaClient.ts";

export const photoStoriesEnabled = process.env.EXPO_PUBLIC_HOOPCHECK_PHOTO_STORIES_ENABLED === "true";
export type Story = {id:string;author_id:string;body:string|null;image_url:string;created_at:string;expires_at:string;profiles:{display_name:string|null}|null};
export type StoryCursor={id:string;created_at:string};
export function storyVisible(row:Story,now=Date.now()):boolean{
 return Number.isFinite(Date.parse(row.expires_at))&&Date.parse(row.expires_at)>now;
}
function cursorValid(cursor:StoryCursor){return isFeedId(cursor.id)&&/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(cursor.created_at)&&Number.isFinite(Date.parse(cursor.created_at));}
export async function readPhotoStories(client:SupabaseClient,uid:string,signal:AbortSignal,cursor?:StoryCursor,now=new Date()){
 if(!isFeedId(uid)||(cursor&&!cursorValid(cursor))||signal.aborted)throw Error("Invalid Story request.");
 const session=await client.auth.getSession();
 if(session.error||session.data.session?.user.id!==uid||signal.aborted)throw Error("Verify your account.");
 const token=session.data.session.access_token,header="Bearer "+token;
 let query=client.from("feed_posts").select("id,author_id,body,image_url,image_urls,video_url,post_kind,community_visible,created_at,expires_at,profiles:profiles!feed_posts_author_id_fkey(display_name)")
 .eq("status","approved").eq("post_kind","story").eq("community_visible",false).is("video_url",null).gt("expires_at",now.toISOString())
 .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(21).setHeader("Authorization",header).abortSignal(signal);
 if(cursor)query=query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
 const result=await query;
 if(result.error||!Array.isArray(result.data)||result.data.length>21)throw Error("Stories unavailable.");
 const rows=result.data;
 if(rows.some(row=>!cursorValid(row)||!isFeedId(row.author_id))||new Set(rows.map(row=>row.id)).size!==rows.length)throw Error("Invalid Story response.");
 const page=rows.slice(0,20);
 const [blocks,archives]=await Promise.all([
 client.from("user_blocks").select("blocked_id").eq("blocker_id",uid).limit(501).setHeader("Authorization",header).abortSignal(signal),
 page.length?client.from("feed_post_archives").select("post_id").eq("user_id",uid).in("post_id",page.map(row=>row.id)).setHeader("Authorization",header).abortSignal(signal):Promise.resolve({data:[],error:null})
 ]);
 if(blocks.error||archives.error||!Array.isArray(blocks.data)||!Array.isArray(archives.data)||blocks.data.length>500||blocks.data.some(row=>!isFeedId(row.blocked_id)))throw Error("Story access could not be verified.");
 const hidden=new Set(archives.data.map(row=>row.post_id)),blocked=new Set(blocks.data.map(row=>row.blocked_id));
 const stories:Story[]=page.filter(row=>row.post_kind==="story"&&row.community_visible===false&&row.video_url===null&&typeof row.image_url==="string"&&row.image_url.length>0&&typeof row.expires_at==="string"&&Date.parse(row.expires_at)-Date.parse(row.created_at)===86400000&&Date.parse(row.expires_at)>now.getTime()&&!hidden.has(row.id)&&!blocked.has(row.author_id)).map(row=>({id:row.id,author_id:row.author_id,body:typeof row.body==="string"?row.body:null,image_url:row.image_url,created_at:row.created_at,expires_at:row.expires_at,profiles:Array.isArray(row.profiles)?row.profiles[0]??null:row.profiles}));
 const current=await client.auth.getSession();
 if(signal.aborted||current.error||current.data.session?.user.id!==uid||current.data.session.access_token!==token)throw Error("Account changed.");
 return {stories,next:rows.length>20?{id:page[19].id,created_at:page[19].created_at}:null};
}
export async function publishPhotoStory(origin:string,uid:string,token:string,caption:string,photo:Photo,signal:AbortSignal,body:(photo:Photo)=>Promise<Blob>,request:typeof fetch=fetch){
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!isFeedId(uid)||!token||caption.trim().length>2000||photo.type!=="image/jpeg"||!Number.isSafeInteger(photo.size)||photo.size<1||photo.size>750000||signal.aborted)throw Error("Choose a valid photo and caption.");
 url.pathname="/api/hoopfeed/moderate";
 const form=new FormData();form.append("kind","post");form.append("post_kind","story");form.append("audience","followers");form.append("text",caption.trim());form.append("image",await body(photo),"photo.jpg");
 if(signal.aborted)throw Error("Story cancelled.");
 let response:Response;
 try{response=await request(url,{method:"POST",headers:{Authorization:"Bearer "+token},body:form,cache:"no-store",redirect:"error",signal});}catch{throw new PublicationUnconfirmed("Story publication could not be confirmed. Refresh before attempting another.");}
 const result=await response.json().catch(()=>null);
 if(response.ok&&result?.allowed===true&&typeof result.story_expires_at==="string"&&Number.isFinite(Date.parse(result.story_expires_at))&&Date.parse(result.story_expires_at)>Date.now())return result.story_expires_at as string;
 if(response.status>=400&&response.status<500&&response.status!==408)throw Error(typeof result?.message==="string"?result.message.slice(0,300):"Story rejected. Your draft is kept.");
 throw new PublicationUnconfirmed("Story publication could not be confirmed. Refresh before attempting another.");
}
