import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXT: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing server Supabase configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function moderate(text: string, image: File | null) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { allowed:false, status:503, message:"Safety moderation is temporarily unavailable. Your post was not published." };
  const input:any[] = [];
  if (text) input.push({type:"text",text});
  if (image) {
    if (!IMAGE_TYPES.has(image.type) || image.size > 8*1024*1024) return {allowed:false,status:400,message:"Use a JPG, PNG, or WebP photo no larger than 8 MB."};
    const bytes=Buffer.from(await image.arrayBuffer());
    input.push({type:"image_url",image_url:{url:"data:"+image.type+";base64,"+bytes.toString("base64")}});
  }
  if (!input.length) return {allowed:false,status:400,message:"Add text or a photo before posting."};
  let response:Response;
  try { response=await fetch("https://api.openai.com/v1/moderations",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"omni-moderation-latest",input}),signal:AbortSignal.timeout(12000),cache:"no-store"}); }
  catch { return {allowed:false,status:502,message:"Safety moderation is temporarily unavailable."}; }
  if (!response.ok) return {allowed:false,status:502,message:"Safety moderation is temporarily unavailable."};
  const result=(await response.json().catch(()=>null))?.results?.[0];
  if (!result || typeof result.flagged!=="boolean") return {allowed:false,status:502,message:"Safety moderation returned no valid result."};
  if (result.flagged) return {allowed:false,status:400,message:"This content was blocked by HoopCheck safety moderation."};
  return {allowed:true,status:200,message:"ok"};
}

export async function POST(request:Request) {
  try {
    const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(\S+)$/i)?.[1];
    if(!token) return NextResponse.json({allowed:false,message:"Sign in is required."},{status:401});
    const db=adminClient();
    const {data:userData,error:userError}=await db.auth.getUser(token);
    const user=userData?.user;
    if(userError||!user) return NextResponse.json({allowed:false,message:"Your session is invalid."},{status:401});
    const {data:profile}=await db.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
    if(profile?.account_type!=="fan") return NextResponse.json({allowed:false,message:"Only fan accounts can use Fan HoopFeed."},{status:403});
    const {data:sub}=await db.from("subscriptions").select("plan,status,access_status").eq("user_id",user.id).maybeSingle();
    if(!["pro","premium"].includes(sub?.plan||"")||!["active","trialing"].includes(sub?.status||"")||!["active","trialing","pro","premium"].includes(sub?.access_status??"active"))
      return NextResponse.json({allowed:false,message:"Active Pro or Premium membership is required."},{status:403});

    const isJson=request.headers.get("content-type")?.includes("application/json");
    let kind="post", postId="", text="", teamId="", image:File|null=null;
    if(isJson) {
      const payload=await request.json();
      kind=String(payload.kind||"comment"); postId=String(payload.post_id||""); text=String(payload.text||"").trim();
    } else {
      const form=await request.formData(); teamId=String(form.get("team_id")||""); text=String(form.get("text")||"").trim();
      const v=form.get("image"); image=v instanceof File&&v.size?v:null;
    }
    if(text.length>500) return NextResponse.json({allowed:false,message:"Text must be 500 characters or fewer."},{status:413});
    if(kind==="comment") {
      if(!postId||!text) return NextResponse.json({allowed:false,message:"Write a comment first."},{status:400});
      const {data:post}=await db.from("fan_feed_posts").select("id,author_id,team_id,status,expires_at").eq("id",postId).maybeSingle();
      if(!post||post.status!=="approved"||new Date(post.expires_at).getTime()<=Date.now()) return NextResponse.json({allowed:false,message:"This fan post is no longer available."},{status:404});
      const [{data:follow},{data:teamFollow}]=await Promise.all([
        db.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","fan").eq("target_id",post.author_id).maybeSingle(),
        db.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").eq("target_id",post.team_id).maybeSingle()
      ]);
      if(post.author_id!==user.id&&!follow&&!teamFollow) return NextResponse.json({allowed:false,message:"You cannot comment on a post outside your fan feed."},{status:403});
      const mod=await moderate(text,null); if(!mod.allowed) return NextResponse.json({allowed:false,message:mod.message},{status:mod.status});
      const {error}=await db.from("fan_feed_comments").insert({post_id:postId,author_id:user.id,body:text});
      if(error) return NextResponse.json({allowed:false,message:"Your comment could not be published."},{status:400});
      return NextResponse.json({allowed:true});
    }
    if(!teamId||(!text&&!image)) return NextResponse.json({allowed:false,message:"Choose a followed team and add text or a photo."},{status:400});
    const {data:teamFollow}=await db.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").eq("target_id",teamId).maybeSingle();
    if(!teamFollow) return NextResponse.json({allowed:false,message:"You can only post for teams you follow."},{status:403});
    if(image&&(!IMAGE_TYPES.has(image.type)||image.size>8*1024*1024)) return NextResponse.json({allowed:false,message:"Use a JPG, PNG, or WebP photo no larger than 8 MB."},{status:400});
    const mod=await moderate(text,image); if(!mod.allowed) return NextResponse.json({allowed:false,message:mod.message},{status:mod.status});
    let image_url:string|null=null;
    if(image) {
      const path=user.id+"/"+crypto.randomUUID()+"."+IMAGE_EXT[image.type];
      const {error}=await db.storage.from("feed-images").upload(path,Buffer.from(await image.arrayBuffer()),{contentType:image.type,cacheControl:"31536000",upsert:false});
      if(error) return NextResponse.json({allowed:false,message:"Photo upload failed. Your post was not published."},{status:400});
      image_url=db.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
    }
    const {error}=await db.from("fan_feed_posts").insert({author_id:user.id,team_id:teamId,body:text,image_url,status:"approved",expires_at:new Date(Date.now()+86400000).toISOString()});
    if(error) return NextResponse.json({allowed:false,message:"Your post could not be published."},{status:400});
    return NextResponse.json({allowed:true});
  } catch(error) {
    console.error("Fan HoopFeed request failed",error);
    return NextResponse.json({allowed:false,message:"Fan HoopFeed could not complete the request."},{status:500});
  }
}
