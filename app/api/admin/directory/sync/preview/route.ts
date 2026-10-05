import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDirectoryConnector } from "../../../../../../lib/directory-sync/connectors";
import type { NormalizedDirectory, SyncEntityType } from "../../../../../../lib/directory-sync/types";
import { clean } from "../../../../../../lib/directory-sync/sync-record";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 50;

export async function POST(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user}}=await s.auth.getUser(token); if(!user)return NextResponse.json({error:"Invalid session"},{status:401});
 const {data:admin}=await s.rpc("is_current_user_admin_or_moderator"); if(!admin)return NextResponse.json({error:"Admin or moderator access required"},{status:403});
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!serviceRoleKey)return NextResponse.json({error:"Server directory sync is not configured"},{status:503});
 const adminSupabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const body=await req.json().catch(()=>({})); const sourceId=typeof body.source_id==="string"?body.source_id:null;
 const entityType:SyncEntityType|undefined=["leagues","teams","coaches"].includes(body.entity_type)?body.entity_type:undefined;
 if(!sourceId||!entityType)return NextResponse.json({error:"source_id and entity_type are required"},{status:400});
 const offset=typeof body.offset==="number"&&Number.isFinite(body.offset)?Math.max(0,Math.floor(body.offset)):0;
 const requestedLimit=typeof body.limit==="number"&&Number.isFinite(body.limit)?Math.floor(body.limit):DEFAULT_BATCH_SIZE;
 const limit=Math.min(MAX_BATCH_SIZE,Math.max(1,requestedLimit));
 const {data:source}=await adminSupabase.from("directory_sources").select("id,name,active,connector_key").eq("id",sourceId).single();
 if(!source)return NextResponse.json({error:"Provider not found"},{status:404}); if(!source.active)return NextResponse.json({error:"Provider is paused"},{status:409});
 const connector=getDirectoryConnector(source.connector_key); if(!connector)return NextResponse.json({error:"Connector not configured for this provider"},{status:409});
 try{
  let directory:NormalizedDirectory;
  try {
   directory=await connector.getDirectory({entityType,sourceId,options:{offset,limit}});
  } catch (error) {
   const detail=error instanceof Error ? error.message : JSON.stringify(error);
   throw new Error(`Provider fetch failed: ${detail}`);
  }
  const rows=directory[entityType];
  let create=0,update=0,skip=0;
  for(const row of rows){const name=clean(row.name);if(!name){skip++;continue;}let existing:{id:string}|null=null;
   if(clean(row.externalId)){const q=await adminSupabase.from(entityType).select("id").eq("source_id",sourceId).eq("external_id",clean(row.externalId)).limit(1).maybeSingle();if(q.error)throw q.error;existing=q.data;}
   if(!existing){const q=await adminSupabase.from(entityType).select("id").ilike("name",name).eq("country",clean(row.country)).limit(1).maybeSingle();if(q.error&&q.error.code!=="PGRST116")throw q.error;existing=q.data;}
   if(existing)update++;else create++;
  }
  const {data:preview,error}=await adminSupabase.from("directory_sync_previews").insert({source_id:sourceId,created_by:user.id,entity_type:entityType,status:"pending",normalized_data:directory,total_rows:rows.length,create_count:create,update_count:update,skip_count:skip}).select("id,source_id,entity_type,status,total_rows,create_count,update_count,skip_count,expires_at,created_at").single();
  if(error)throw error;
  const hasMore=entityType!=="coaches" && rows.length>=limit;
  return NextResponse.json({preview,provider:source.name,batch:{offset,limit,next_offset:hasMore?offset+limit:null,has_more:hasMore}});
 }catch(e){
  const message=e instanceof Error ? e.message : (typeof e === "string" ? e : JSON.stringify(e));
  return NextResponse.json({error:`Directory preview failed: ${message || "Unknown error"}`},{status:500});
 }
}