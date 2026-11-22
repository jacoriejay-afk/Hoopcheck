import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeModeratorRequest } from "../../../../lib/server/review-moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

function disabled() {
  return NextResponse.json({ error: "HoopGroups moderation is not active." }, { status: 503, headers: noStore });
}
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing server Supabase configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function ready() {
  // Separate from the public discovery feature flag to prevent early privileged writes.
  return process.env.HOOPGROUPS_CHANNELS_SERVER_ENABLED === "true";
}
export async function GET(request: Request) {
  if (!ready()) return disabled();
  const auth = await authorizeModeratorRequest(request);
  if (!auth.ok) return auth.response;
  try {
    const db=serviceClient();
    const [posts,reports]=await Promise.all([
      db.from("hoop_group_posts").select("id,channel_id,author_id,body,moderation_status,created_at")
        .eq("moderation_status","pending").order("created_at",{ascending:true}).limit(100),
      db.from("hoop_group_reports").select("id,post_id,reporter_id,reason,created_at")
        .order("created_at",{ascending:false}).limit(100),
    ]);
    if(posts.error || reports.error) throw new Error("Moderation queue unavailable");
    const ids=[...new Set((reports.data||[]).map(item=>item.post_id))];
    const reported=ids.length?await db.from("hoop_group_posts").select("id,channel_id,author_id,body,moderation_status,created_at").in("id",ids)
      :{data:[],error:null};
    if(reported.error) throw new Error("Reported posts unavailable");
    return NextResponse.json({posts:posts.data||[],reports:reports.data||[],reported:reported.data||[]},{headers:noStore});
  } catch(error) {
    console.error("HoopGroups moderator queue error:",error);
    return NextResponse.json({error:"Moderation queue unavailable."},{status:500,headers:noStore});
  }
}
export async function PATCH(request: Request) {
  if (!ready()) return disabled();
  const auth=await authorizeModeratorRequest(request);
  if (!auth.ok) return auth.response;
  try {
    if (Number(request.headers.get("content-length")||0)>2048) return NextResponse.json({error:"Invalid moderation request."},{status:413,headers:noStore});
    const body=await request.json().catch(()=>null);
    const id=typeof body?.id==="string"?body.id:"";
    const status=body?.status;
    if(!uuid.test(id) || !["approved","rejected","removed"].includes(status))
      return NextResponse.json({error:"Valid post and moderation action required."},{status:400,headers:noStore});
    const db=serviceClient();
    const {data,error}=await db.rpc("moderate_hoop_group_post",{
      p_post_id:id,p_actor_id:auth.user.id,p_new_status:status,
    });
    if(error || !Array.isArray(data) || data.length!==1) {
      console.error("HoopGroups moderation RPC rejected action",error?.code);
      return NextResponse.json({error:"Moderation action was not confirmed."},{status:409,headers:noStore});
    }
    return NextResponse.json({post:data[0]},{headers:noStore});
  } catch(error) {
    console.error("HoopGroups moderation action failed:",error);
    return NextResponse.json({error:"Moderation action failed."},{status:500,headers:noStore});
  }
}
