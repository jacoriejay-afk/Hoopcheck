import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDirectoryConnector } from "@/lib/directory-sync/connectors";
import { buildPreview } from "@/lib/directory-sync/preview";

export async function POST(req:Request){
 const auth=req.headers.get("authorization"); const token=auth?.startsWith("Bearer ")?auth.slice(7):null;
 if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
 const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user}}=await supabase.auth.getUser(token); if(!user)return NextResponse.json({error:"Invalid session"},{status:401});
 const {data:admin}=await supabase.rpc("is_current_user_admin_or_moderator"); if(!admin)return NextResponse.json({error:"Admin or moderator access required"},{status:403});
 const body=await req.json().catch(()=>({})); const sourceId=typeof body.source_id==="string"?body.source_id:null; const entityType=["leagues","teams","coaches"].includes(body.entity_type)?body.entity_type:null;
 if(!sourceId||!entityType)return NextResponse.json({error:"source_id and entity_type are required"},{status:400});
 const {data:source}=await supabase.from("directory_sources").select("id,name,active,connector_key").eq("id",sourceId).single();
 if(!source)return NextResponse.json({error:"Provider not found"},{status:404}); if(!source.active)return NextResponse.json({error:"Provider is paused"},{status:409});
 const connector=getDirectoryConnector(source.connector_key); if(!connector)return NextResponse.json({error:"Connector not configured"},{status:409});
 try{
  const directory=await connector.getDirectory({entityType,sourceId});
  const preview=buildPreview(entityType,directory);
  return NextResponse.json({provider:source.name,entity_type:entityType,total:preview.length,preview});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Preview failed"},{status:500});}
}
