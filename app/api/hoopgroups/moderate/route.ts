import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateModerationRequest } from "../../../../lib/server/review-moderation";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const disabled=()=>NextResponse.json({error:"HoopGroups moderation is not active."},{status:503,headers});
function serviceClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error("HoopGroups backend configuration unavailable");
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
async function ownerChannels(db:ReturnType<typeof serviceClient>,ownerId:string) {
  const {data:spaces,error:spaceError}=await db.from("hoop_group_spaces").select("id")
    .eq("owner_id",ownerId).limit(3);
  if(spaceError) throw new Error("Owner lookup failed");
  const ids=(spaces||[]).map(space=>space.id);
  if(!ids.length) return [];
  const {data:channels,error:channelError}=await db.from("hoop_group_channels")
    .select("id,space_id").in("space_id",ids);
  if(channelError) throw new Error("Owner channels unavailable");
  return channels||[];
}
export async function GET(request:Request) {
  if(process.env.HOOPGROUPS_CHANNELS_SERVER_ENABLED!=="true") return disabled();
  const auth=await authenticateModerationRequest(request);
  if(!auth.ok) return auth.response;
  try {
    const db=serviceClient();
    const channels=await ownerChannels(db,auth.user.id);
    if(!channels.length) return NextResponse.json({posts:[]},{headers});
    const {data,error}=await db.from("hoop_group_posts")
      .select("id,channel_id,author_id,body,moderation_status,created_at")
      .in("channel_id",channels.map(channel=>channel.id))
      .eq("moderation_status","pending").order("created_at",{ascending:true}).limit(100);
    if(error) throw new Error("Pending posts unavailable");
    const spaceByChannel=new Map(channels.map(channel=>[channel.id,channel.space_id]));
    return NextResponse.json({posts:(data||[]).map(post=>({...post,space_id:spaceByChannel.get(post.channel_id)}))},{headers});
  } catch(error) {
    console.error("Owner HoopGroups queue failed:",error);
    return NextResponse.json({error:"Unable to load pending messages."},{status:500,headers});
  }
}
export async function PATCH(request:Request) {
  if(process.env.HOOPGROUPS_CHANNELS_SERVER_ENABLED!=="true") return disabled();
  const auth=await authenticateModerationRequest(request);
  if(!auth.ok) return auth.response;
  try {
    if(Number(request.headers.get("content-length")||0)>2048)
      return NextResponse.json({error:"Invalid request."},{status:413,headers});
    const body=await request.json().catch(()=>null);
    const id=typeof body?.id==="string"?body.id:"";
    const status=body?.status;
    if(!uuid.test(id)||!["approved","rejected","removed"].includes(status))
      return NextResponse.json({error:"Invalid moderation action."},{status:400,headers});
    const db=serviceClient();
    const {data:post,error:postError}=await db.from("hoop_group_posts")
      .select("id,channel_id").eq("id",id).maybeSingle();
    if(postError) throw new Error("Post lookup failed");
    if(!post) return NextResponse.json({error:"Message not found."},{status:404,headers});
    const channels=await ownerChannels(db,auth.user.id);
    if(!channels.some(channel=>channel.id===post.channel_id))
      return NextResponse.json({error:"You do not moderate this community."},{status:403,headers});
    // The RPC independently checks owner/group scope and logs every transition.
    const {data,error}=await db.rpc("moderate_hoop_group_post",{
      p_post_id:id,p_actor_id:auth.user.id,p_new_status:status
    });
    if(error||!Array.isArray(data)||data.length!==1) {
      console.error("Owner HoopGroups moderation rejected:",error?.code);
      return NextResponse.json({error:"Moderation action was not confirmed."},{status:409,headers});
    }
    return NextResponse.json({post:data[0]},{headers});
  } catch(error) {
    console.error("Owner HoopGroups moderation failed:",error);
    return NextResponse.json({error:"Moderation request failed."},{status:500,headers});
  }
}
