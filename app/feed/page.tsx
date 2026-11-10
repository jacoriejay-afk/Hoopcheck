"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { PageShell } from "../../components/LayoutSystem";
import { FeedPostCard, FeedAuthorRow, FeedMediaArea, FeedActionRow, FeedEmptyState, FeedLoadingSkeleton } from "../../components/HoopFeedShared";
import { getHoopCheckEntitlements } from "../../lib/membership-tier";
import HoopLoading from "../../components/HoopLoading";
import { HoopIcon } from "../../components/HoopCheckUI";
import CourtLines from "../../components/CourtLines";
import "../hoopfeed-shared.css";
import "./feed-camera-picker.css";
import "./feed-compact-hero.css";
import "./feed-pull-refresh.css";

type MiniProfile = { display_name: string | null; avatar_url: string | null; account_type?: string | null; current_country?: string | null; current_country_public?: boolean; current_team?: string | null };
type Post = { id:string; shared_post_id?:string|null; shared_post?:{author_id:string;profiles?:{display_name:string|null}|null}|null; body:string; image_url:string|null; image_urls?:string[]|null; video_url?:string|null; post_kind?:string|null; poll_options?:string[]|null; is_pinned?:boolean|null; pinned_at?:string|null; location_country:string|null; topic_tag?:TopicTag|null; game_day_team?:string|null; game_day_opponent?:string|null; game_day_score_for?:number|null; game_day_score_against?:number|null; created_at:string; expires_at:string; author_id:string; ageLabel?:string; profiles?:MiniProfile|null };
type VoteState = { counts:number[]; total:number; mine:number|null };
type TopicTag = "Practice" | "Game Day" | "Travel" | "Teammates" | "Culture" | "Win" | "Challenge";
type TypeFilter = "All Posts" | "Discussion" | "News" | "Media" | "Polls" | "Saved";
const TYPE_FILTERS: TypeFilter[] = ["All Posts","Discussion","News","Media","Polls","Saved"];
const ROLE_PILLS: Record<string,{label:string}> = { player:{label:"Player"}, team:{label:"Team"}, coach:{label:"Coach"}, fan:{label:"Fan"}, agent:{label:"Agent"}, scout:{label:"Scout"}, manager:{label:"Manager"} };
const formatCount = (n:number) => n>=1000 ? (Math.round(n/100)/10).toString().replace(/\.0$/,"")+"K" : String(n);
function calculatePostingStreak(rows: { activity_date: string }[]) {
  const dates = new Set(rows.map(row => String(row.activity_date).slice(0, 10)));
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let cursor = dates.has(today) ? today : dates.has(yesterday) ? yesterday : "";
  if (!cursor) return 0;
  let count = 0;
  while (dates.has(cursor)) { count += 1; cursor = new Date(Date.parse(cursor + "T00:00:00.000Z") - 86400000).toISOString().slice(0, 10); }
  return count;
}
type Comment = { id:string; post_id:string; body:string; created_at:string; author_id:string; profiles?:MiniProfile|null };
type Profile = { account_type:string; current_country:string|null; current_country_public:boolean };
type Subscription = { plan:string|null; status:string|null; access_status:string|null };

const ago = (v:string, now:number) => {
  const s=Math.max(0,Math.floor((now-new Date(v).getTime())/1000));
  if(s<60)return "just now"; const m=Math.floor(s/60); if(m<60)return m+"m ago";
  const h=Math.floor(m/60); if(h<24)return h+"h ago"; return Math.floor(h/24)+"d ago";
};

export default function Feed(){
  const [posts,setPosts]=useState<Post[]>([]);
  const [comments,setComments]=useState<Record<string,Comment[]>>({});
  const [checks,setChecks]=useState<Record<string,number>>({}); const [checkBursts,setCheckBursts]=useState<Record<string,boolean>>({});
  const [mine,setMine]=useState<Record<string,boolean>>({});
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [open,setOpen]=useState<Record<string,boolean>>({});
  const [body,setBody]=useState(""); const [typeFilter,setTypeFilter]=useState<TypeFilter>("All Posts"); const [photos,setPhotos]=useState<File[]>([]); const [previews,setPreviews]=useState<string[]>([]); const [composerMode,setComposerMode]=useState<"post"|"poll"|"news">("post"); const [composerExpanded,setComposerExpanded]=useState(false); const [pollDraft,setPollDraft]=useState<string[]>(["",""]); const [votes,setVotes]=useState<Record<string,VoteState>>({}); const [savedMap,setSavedMap]=useState<Record<string,boolean>>({}); const [carouselIdx,setCarouselIdx]=useState<Record<string,number>>({}); const [video,setVideo]=useState<File|null>(null); const [videoPreview,setVideoPreview]=useState(""); const [showCountry,setShowCountry]=useState(false);
  const [user,setUser]=useState<any>(null); const [profile,setProfile]=useState<Profile|null>(null); const [adminRole,setAdminRole]=useState<string|null>(null); const [subscription,setSubscription]=useState<Subscription|null>(null); const [memberCount,setMemberCount]=useState<number|null>(null);
  const [msg,setMsg]=useState(""); const [refreshing,setRefreshing]=useState(false); const [mediaPickerOpen,setMediaPickerOpen]=useState(false); const [postingStreak,setPostingStreak]=useState(0); const [loading,setLoading]=useState(true); const [posting,setPosting]=useState(false); const [now,setNow]=useState(0); const textareaRef = useRef<HTMLTextAreaElement|null>(null); const touchStartY = useRef<number|null>(null);
  const visiblePosts = posts.filter(p=>{
    const hasMedia=Boolean(p.image_url||(p.image_urls&&p.image_urls.length)||p.video_url);
    if(typeFilter==="Discussion"&&(hasMedia||p.post_kind==="poll"||p.post_kind==="news"))return false;
    if(typeFilter==="Media"&&!hasMedia)return false;
    if(typeFilter==="News"&&p.post_kind!=="news")return false;
    if(typeFilter==="Polls"&&p.post_kind!=="poll")return false;

    if(typeFilter==="Saved"&&!savedMap[p.id])return false;
    return true;
  }).slice().sort((a,b)=>{
    const ap=a.is_pinned?1:0; const bp=b.is_pinned?1:0;
    if(ap!==bp)return bp-ap;
    if(ap&&bp)return new Date(b.pinned_at||b.created_at).getTime()-new Date(a.pinned_at||a.created_at).getTime();
    return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
  });

  const access=getHoopCheckEntitlements({accountType:profile?.account_type,subscription,isAdmin:adminRole==="admin"}).canReadHoopFeed;
  const isAdmin=adminRole==="admin";

  async function load(currentUser:any){
    const feedResult=await supabase.from("feed_posts").select("id,shared_post_id,body,image_url,image_urls,video_url,post_kind,poll_options,is_pinned,pinned_at,location_country,topic_tag,game_day_team,game_day_opponent,game_day_score_for,game_day_score_against,created_at,expires_at,author_id,profiles:profiles!feed_posts_author_id_fkey(display_name,avatar_url,account_type,current_country,current_country_public,current_team)")
      .eq("status","approved").order("created_at",{ascending:false}).limit(30);
    if(feedResult.error){console.error("HoopFeed posts query failed",feedResult.error);setMsg("HoopFeed could not load posts. Please refresh and try again.");return;}
    const {data:archiveRows}=await supabase.from("feed_post_archives").select("post_id").eq("user_id",currentUser.id);
    const archiveIds=new Set((archiveRows||[]).map((r:any)=>r.post_id));
    const sharedIds=[...new Set((feedResult.data||[]).map((r:any)=>r.shared_post_id).filter(Boolean))] as string[];
    let sharedPostsById:Record<string,any>={};
    if(sharedIds.length){
      const {data:sharedRows,error:sharedError}=await supabase.from("feed_posts").select("id,author_id,profiles:profiles!feed_posts_author_id_fkey(display_name)").in("id",sharedIds);
      if(sharedError){console.error("HoopFeed shared-post lookup failed",sharedError);}
      sharedPostsById=Object.fromEntries((sharedRows||[]).map((r:any)=>[r.id,{...r,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)}]));
    }
    const nowTs=Date.now();
    const rows=(feedResult.data||[]).filter((r:any)=>!archiveIds.has(r.id)).map((r:any)=>{const post={...r,shared_post:r.shared_post_id?sharedPostsById[r.shared_post_id]||null:null,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)} as Post;return {...post,ageLabel:ago(post.created_at,nowTs)};});
    setPosts(rows);
    if(!rows.length){setComments({});setChecks({});setMine({});setVotes({});setSavedMap({});return;}
    const ids=rows.map(p=>p.id);
    void Promise.all([
      supabase.from("feed_post_comments").select("id,post_id,body,created_at,author_id,profiles:profiles!feed_post_comments_author_id_fkey(display_name,avatar_url)").in("post_id",ids).order("created_at",{ascending:true}),
      supabase.from("feed_post_checks").select("post_id,user_id").in("post_id",ids),
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.access_token) return { data: null, error: new Error("Session unavailable") };
        const response = await fetch("/api/hoopfeed/poll-results", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ post_ids: rows.filter(p => p.post_kind === "poll").map(p => p.id) }),
          cache: "no-store",
        });
        if (!response.ok) return { data: null, error: new Error("Poll results unavailable") };
        const payload = await response.json();
        return { data: payload.results as Record<string, VoteState>, error: null };
      }),
      supabase.from("feed_post_bookmarks").select("post_id").eq("user_id",currentUser.id).in("post_id",ids)
    ]).then(([commentsResult,checksResult,votesResult,bookmarksResult])=>{
      const cg:Record<string,Comment[]>={};const cc:Record<string,number>={};const cm:Record<string,boolean>={};
      (commentsResult.data||[]).forEach((r:any)=>{(cg[r.post_id]??=[]).push({...r,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)});});
      (checksResult.data||[]).forEach((r:any)=>{cc[r.post_id]=(cc[r.post_id]||0)+1;if(r.user_id===currentUser.id)cm[r.post_id]=true;});
      const vs:Record<string,VoteState>={};
      rows.forEach(p=>{if(p.post_kind==="poll"&&Array.isArray(p.poll_options))vs[p.id]={counts:p.poll_options.map(()=>0),total:0,mine:null};});
      for (const [postId, result] of Object.entries(votesResult.data || {})) { if (vs[postId] && result.counts.length === vs[postId].counts.length) vs[postId] = result; }
      const sm:Record<string,boolean>={};
      (bookmarksResult.data||[]).forEach((r:any)=>{sm[r.post_id]=true;});
      setComments(cg);setChecks(cc);setMine(cm);setVotes(vs);setSavedMap(sm);
    });
  }

  useEffect(()=>{setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),60000);return()=>window.clearInterval(timer);},[]);

  useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();const u=session?.user;setUser(u);if(!u){setLoading(false);return;}
    const [{data:p},{data:s}]=await Promise.all([
      supabase.from("profiles").select("account_type,current_country,current_country_public").eq("id",u.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,access_status").eq("user_id",u.id).maybeSingle()
    ]);
    setProfile(p);setSubscription(s);setShowCountry(Boolean(p?.current_country_public));
    const {data:roleData}=await supabase.rpc("get_current_user_admin_role");
    const resolvedAdminRole=roleData==="admin"||roleData==="moderator"?roleData:null;
    setAdminRole(resolvedAdminRole);
    const {data:activity}=await supabase.from("feed_posting_activity").select("activity_date").eq("user_id",u.id).order("activity_date",{ascending:false}).limit(370);setPostingStreak(calculatePostingStreak(activity||[]));
    void supabase.from("profiles").select("id",{count:"exact",head:true}).then(({count})=>{if(typeof count==="number")setMemberCount(count);});
    const memberActive=getHoopCheckEntitlements({accountType:p?.account_type,subscription:s,isAdmin:resolvedAdminRole==="admin"}).canReadHoopFeed;
    setLoading(false);
    if(p&&memberActive)void load(u);
  })();},[]);

  const photoSlotsRef=useRef(0);
  const photoGenerationRef=useRef(0);
  async function choosePhoto(f:File){
    if(photoSlotsRef.current>=4){setMsg("Up to 4 photos per post.");return;}
    if(!["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(f.type)&&!( !f.type&&/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name))){setMsg("Choose a JPG, PNG, WebP, or supported iPhone photo.");return;}
    if(f.size>30*1024*1024){setMsg("Choose a photo smaller than 30 MB. HoopCheck compresses photos to meet the 8 MB upload limit.");return;}
    photoSlotsRef.current+=1;
    const generation=photoGenerationRef.current;
    try{
      const compressed=await new Promise<File>((resolve,reject)=>{
        const img=new Image(); const url=URL.createObjectURL(f);
        img.onload=()=>{URL.revokeObjectURL(url);try{const max=1600;const scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext("2d");if(!ctx){reject(new Error("Photo processing failed."));return;}ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(!blob){reject(new Error("Photo processing failed."));return;}resolve(new File([blob],"hoopfeed.jpg",{type:"image/jpeg"}));},"image/jpeg",0.82);}catch{reject(new Error("This photo could not be processed. Try another photo or a JPG from your library."));}};
        img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("This photo could not be opened. Try taking a new photo or choosing a JPG from your library."));}; img.src=url;
      });
      if(generation!==photoGenerationRef.current)return;
      if(compressed.size>8*1024*1024){photoSlotsRef.current=Math.max(0,photoSlotsRef.current-1);setMsg("This photo is still larger than 8 MB after processing. Choose a smaller image.");return;}
      setVideo(null);if(videoPreview)URL.revokeObjectURL(videoPreview);setVideoPreview("");setPhotos(x=>[...x,compressed]);const previewUrl=URL.createObjectURL(compressed);setPreviews(x=>[...x,previewUrl]);setMsg("");
    }catch(e:any){if(generation===photoGenerationRef.current){photoSlotsRef.current=Math.max(0,photoSlotsRef.current-1);setMsg(e?.message||"Photo processing failed.");}}
  }
  function removePhoto(i:number){photoSlotsRef.current=Math.max(0,photoSlotsRef.current-1);if(previews[i])URL.revokeObjectURL(previews[i]);setPreviews(x=>x.filter((_,j)=>j!==i));setPhotos(x=>x.filter((_,j)=>j!==i));}
  function clearPhotos(){photoGenerationRef.current+=1;photoSlotsRef.current=0;previews.forEach(u=>URL.revokeObjectURL(u));setPhotos([]);setPreviews([]);}
  function chooseVideo(f:File){
    if(f.size>50*1024*1024||!(["video/mp4","video/webm","video/quicktime"].includes(f.type)||(!f.type&&/\.(mp4|webm|mov)$/i.test(f.name)))){setMsg("Use MP4, WebM, or MOV up to 50 MB.");return;}
    setVideo(f);if(videoPreview)URL.revokeObjectURL(videoPreview);setVideoPreview(URL.createObjectURL(f));clearPhotos();setMsg("Add a caption to your video before posting.");
  }

  async function apiAction(fields:Record<string,string>):Promise<{ok:boolean;message?:string}>{
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)return {ok:false,message:"Your session expired. Please sign in again."};
      const form=new FormData();
      Object.entries(fields).forEach(([k,v])=>form.append(k,v));
      const response=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.allowed!==true)return {ok:false,message:result.message};
      return {ok:true};
    }catch(e){console.error("HoopFeed action failed",e);return {ok:false};}
  }

  async function vote(p:Post,optionIndex:number){
    if(!user||!access)return;
    const prev=votes[p.id];
    setVotes(x=>{const cur=x[p.id]||{counts:(p.poll_options||[]).map(()=>0),total:0,mine:null};const counts=cur.counts.slice();let total=cur.total;if(cur.mine!==null&&counts[cur.mine]!==undefined){counts[cur.mine]=Math.max(0,counts[cur.mine]-1);total=Math.max(0,total-1);}counts[optionIndex]=(counts[optionIndex]||0)+1;total+=1;return {...x,[p.id]:{counts,total,mine:optionIndex}};});
    const r=await apiAction({kind:"vote",post_id:p.id,option_index:String(optionIndex)});
    if(!r.ok){if(prev)setVotes(x=>({...x,[p.id]:prev}));setMsg(r.message||"That vote didn't go through. Please try again.");}
  }

  async function toggleSave(p:Post){
    if(!user||!access)return;
    const next=!savedMap[p.id];
    setSavedMap(x=>({...x,[p.id]:next}));
    const r=await apiAction({kind:"bookmark",post_id:p.id,saved:next?"true":"false"});
    if(!r.ok){setSavedMap(x=>({...x,[p.id]:!next}));setMsg(r.message||"Couldn't update your saved posts. Please try again.");}
  }

  async function togglePin(p:Post){
    if(!user||!isAdmin)return;
    const r=await apiAction({kind:"pin",post_id:p.id,pinned:p.is_pinned?"false":"true"});
    if(!r.ok){setMsg(r.message||"Couldn't update the pin. Please try again.");return;}
    setMsg(p.is_pinned?"Post unpinned.":"Post pinned to the top of HoopFeed.");
    await load(user);
  }

  async function post(){
    const pollOptionsClean=pollDraft.map(o=>o.trim()).filter(Boolean);
    if(!user||!access||posting)return;
    if(photoSlotsRef.current>photos.length){setMsg("Your photos are still processing. Wait a moment before posting.");return;}
    if(composerMode==="poll"&&(!body.trim()||pollOptionsClean.length<2))return;
    if(composerMode!=="poll"&&!body.trim()&&!photos.length&&!video)return;
    if(video&&!body.trim()){setMsg("Add a caption to your video so HoopCheck can run safety checks.");return;}
    setPosting(true);setMsg("Checking your post for safety...");
    let uploadedVideoPath:string|null=null;
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setMsg("Your session expired. Please sign in again.");setPosting(false);return;}
      const form=new FormData();
      form.append("kind","post");
      form.append("text",body.trim());
      form.append("share_country", showCountry ? "true" : "false");
      form.append("post_kind",composerMode==="poll"?"poll":composerMode==="news"?"news":"discussion");
      if(composerMode==="poll")form.append("poll_options",JSON.stringify(pollOptionsClean));
      photos.forEach(f=>form.append("images",f));
      if(video){const ext=video.type==="video/webm"?"webm":video.type==="video/quicktime"?"mov":(!video.type&&/\.webm$/i.test(video.name))?"webm":(!video.type&&/\.mov$/i.test(video.name))?"mov":"mp4";const videoType=video.type||({webm:"video/webm",mov:"video/quicktime",mp4:"video/mp4"} as Record<string,string>)[ext];const path=`${user.id}/${crypto.randomUUID()}.${ext}`;const {error:uploadError}=await supabase.storage.from("feed-videos").upload(path,video,{contentType:videoType,cacheControl:"31536000",upsert:false});if(uploadError)throw new Error("Video upload failed. Please try again.");uploadedVideoPath=path;form.append("video_path",path);form.append("video_type",videoType);}
      const moderation=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await moderation.json().catch(()=>({}));
      if(!moderation.ok||result.allowed!==true){setMsg(result.message||"This post could not be published because it did not pass HoopFeed safety checks.");if(uploadedVideoPath){try{const {error:cleanupError}=await supabase.storage.from("feed-videos").remove([uploadedVideoPath]);if(cleanupError)console.error("HoopFeed rejected video cleanup failed",cleanupError);}catch(cleanupError){console.error("HoopFeed rejected video cleanup threw",cleanupError);}uploadedVideoPath=null;}setPosting(false);return;}
      uploadedVideoPath=null;
      setBody("");setVideo(null);if(videoPreview)URL.revokeObjectURL(videoPreview);setVideoPreview("");setShowCountry(Boolean(profile?.current_country_public));clearPhotos();setPollDraft(["",""]);setComposerMode("post");setMsg(composerMode==="poll"?"Poll posted to HoopFeed. AI safety checks passed.":"Posted to HoopFeed. AI safety checks passed.");try{await load(user);}catch(refreshError){console.error("HoopFeed refresh after posting failed",refreshError);setMsg("Your post was published, but the feed could not refresh. Pull down to reload.");}
    }catch(e:any){console.error("HoopFeed post failed",e);setMsg(e?.message==="Video upload failed. Please try again."?e.message:"Posting failed. Please try again.");}
    if(uploadedVideoPath){try{const {error:cleanupError}=await supabase.storage.from("feed-videos").remove([uploadedVideoPath]);if(cleanupError)console.error("HoopFeed rejected video cleanup failed",cleanupError);}catch(cleanupError){console.error("HoopFeed rejected video cleanup threw",cleanupError);}}
    setPosting(false);
  }

  async function sharePost(p:Post){
    if(!user||!access||posting)return;
    setPosting(true);setMsg("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setMsg("Your session expired. Please sign in again.");return;}
      const form=new FormData();form.append("kind","share");form.append("post_id",p.id);
      const response=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.allowed!==true){setMsg(result.message||"Couldn't share — try again.");return;}
      setMsg("Shared to HoopFeed.");
      await load(user);
    }catch(error){
      console.error("HoopFeed share request failed",error);
      setMsg("Couldn't share — try again.");
    }finally{setPosting(false);}
  }

  async function toggleCheck(p:Post){
    if(!user||!access)return;
    if(mine[p.id]){const {error}=await supabase.from("feed_post_checks").delete().eq("post_id",p.id).eq("user_id",user.id);if(error){console.error("HoopFeed check update failed",error);setMsg("That check didn't go through. Please try again.");return;}setMine(x=>({...x,[p.id]:false}));setChecks(x=>({...x,[p.id]:Math.max(0,(x[p.id]||0)-1)}));}
    else{const {error}=await supabase.from("feed_post_checks").insert({post_id:p.id,user_id:user.id});if(error){console.error("HoopFeed check update failed",error);setMsg("That check didn't go through. Please try again.");return;}setMine(x=>({...x,[p.id]:true}));setChecks(x=>({...x,[p.id]:(x[p.id]||0)+1}));setCheckBursts(x=>({...x,[p.id]:true}));window.setTimeout(()=>setCheckBursts(x=>({...x,[p.id]:false})),750);}
  }

  async function comment(post_id:string){
    const text=(drafts[post_id]||"").trim();if(!user||!access||!text)return;
    setMsg("Checking comment...");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setMsg("Your session expired. Please sign in again.");return;}
      const form=new FormData();form.append("kind","comment");form.append("post_id",post_id);form.append("text",text);
      const moderation=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await moderation.json().catch(()=>({}));
      if(!moderation.ok||result.allowed!==true){setMsg(result.message||"This comment did not pass HoopFeed safety checks.");return;}
      setDrafts(x=>({...x,[post_id]:""}));setMsg("");await load(user);
    }catch(e:any){console.error("HoopFeed comment failed",e);setMsg("That comment couldn't be posted. Please try again.");}
  }

  async function del(p:Post){if(!user||p.author_id!==user.id)return;if(!confirm("Delete this HoopFeed post?"))return;const {error}=await supabase.from("feed_posts").delete().eq("id",p.id);if(error){console.error("HoopFeed delete failed",error);setMsg("That post couldn't be deleted. Please try again.");return;}{const marker="/storage/v1/object/public/feed-images/";const urls=[...((p.image_urls&&p.image_urls.length)?p.image_urls:[]),...(p.image_url?[p.image_url]:[])];const paths=urls.map(u=>{const i=u.indexOf(marker);return i>=0?u.slice(i+marker.length):"";}).filter(Boolean);if(paths.length)await supabase.storage.from("feed-images").remove(paths);}if(p.video_url){const marker="/storage/v1/object/public/feed-videos/";const i=p.video_url.indexOf(marker);if(i>=0)await supabase.storage.from("feed-videos").remove([p.video_url.slice(i+marker.length)]);}await load(user);}

  const hero=<section className="hf5-hero hf5-hero--compact" aria-label="HoopFeed"><div className="hf5-hero__inner"><h1 className="hf5-hero__title">Hoop<span>Feed</span></h1>{user&&access&&<span className="hf5-hero__plan">{subscription?.plan==="premium"?"PREMIUM":subscription?.plan==="pro"?"PRO":"MEMBER"}</span>}</div></section>;

  if(loading)return <PageShell><main className="page-shell hc-feed-page"><div className="page-container"><HoopLoading label="Loading HoopFeed..." /><FeedLoadingSkeleton count={3} /></div></main></PageShell>;
  if(!user)return <PageShell><main className="page-shell hc-feed-page"><div className="page-container">{hero}<section className="hero-card"><p className="eyebrow">HOOPFEED</p><h2>One community. Every role.</h2><p className="muted">Players, fans, teams, coaches and agents — HoopFeed is where the global basketball community talks. Join to post, comment and Check.</p><div className="actions"><Link href="/signup" className="btn">+ Join Community</Link><Link href="/login" className="btn dark">Sign In</Link></div></section></div></main></PageShell>;
  if(!access)return <PageShell><main className="page-shell hc-feed-page"><div className="page-container"><header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link></header>{hero}<section className="hero-card"><p className="eyebrow">HOOPFEED</p><h2>The global basketball community</h2><p className="muted">An active Pro or Premium membership is required to enter HoopFeed — one feed for players, fans, teams, coaches and agents.</p><div className="actions"><Link href="/membership" className="btn">Upgrade Membership</Link><Link href="/dashboard" className="btn dark">Back to Dashboard</Link></div></section></div></main></PageShell>;

  return <PageShell><main className="page-shell hc-feed-page" onTouchStart={(event)=>{touchStartY.current=window.scrollY===0?(event.touches[0]?.clientY??null):null;}} onTouchEnd={(event)=>{const start=touchStartY.current;touchStartY.current=null;const end=event.changedTouches[0]?.clientY??0;if(start!==null&&end-start>80&&user&&profile&&!refreshing){void(async()=>{setRefreshing(true);try{await load(user);setNow(Date.now());}catch(error){console.error("HoopFeed refresh failed",error);setMsg("Could not refresh HoopFeed. Please try again.");}finally{setRefreshing(false);}})();}}}><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/players">Players</Link><Link href="/profile">Profile</Link></nav></header>
    {hero}

    <div className="hf5-type-row hc-liquid-glass-filter" role="group" aria-label="Filter HoopFeed by post type">{TYPE_FILTERS.map(t=><button type="button" key={t} className={"hf5-type-chip"+(typeFilter===t?" is-active":"")} aria-pressed={typeFilter===t} onClick={()=>setTypeFilter(t)}>{t}</button>)}</div>

    <section className={"dashboard-card hc-feed-composer hc-liquid-glass-composer hc-feed-composer--compact"+(composerExpanded?" is-expanded":" is-collapsed")} style={{marginTop:8}}><CourtLines variant="arc" className="hc-feed-composer__court" /><div className="hc-feed-composer__heading"><span className="card-kicker">SHARE TO HOOPFEED</span><span className="hc-feed-streak" aria-label={postingStreak+" day HoopFeed posting streak"}><span aria-hidden="true">🔥</span> {postingStreak}-day streak</span><button type="button" className="hc-feed-composer__toggle" aria-expanded={composerExpanded} aria-controls="hc-feed-composer-fields" onClick={()=>setComposerExpanded(v=>!v)}>{composerExpanded?"Close":"Create post"}</button></div><div id="hc-feed-composer-fields" className="hc-feed-composer__fields">
      <div className="hf5-mode-row" role="group" aria-label="Choose what to create">{([["post","Post"],["poll","Poll"]] as const).map(([m,label])=><button type="button" key={m} className={"hf5-type-chip"+(composerMode===m?" is-active":"")} aria-pressed={composerMode===m} onClick={()=>setComposerMode(m)}>{label}</button>)}{isAdmin&&<button type="button" className={"hf5-type-chip"+(composerMode==="news"?" is-active":"")} aria-pressed={composerMode==="news"} onClick={()=>setComposerMode("news")}>News (official)</button>}</div>
      <div className="hc-feed-composer__editor"><div className="hc-feed-composer__avatar" aria-hidden="true">{user?.user_metadata?.avatar_url?<img src={user.user_metadata.avatar_url} alt="" />:"HC"}</div><textarea ref={textareaRef} value={body} onChange={e=>{setBody(e.target.value);e.currentTarget.style.height="auto";e.currentTarget.style.height=Math.min(e.currentTarget.scrollHeight,220)+"px";}} rows={3} maxLength={2000} placeholder={composerMode==="poll"?"Ask the community a question...":composerMode==="news"?"Write the official update...":"Start a post... (ask, share, discuss, update)"} /></div>
      {composerMode==="poll"&&<div className="hf5-poll-editor" aria-label="Poll options">{pollDraft.map((opt,i)=><div key={i} className="hf5-poll-editor__row"><input value={opt} onChange={e=>setPollDraft(x=>x.map((o,j)=>j===i?e.target.value:o))} maxLength={60} placeholder={"Option "+(i+1)} aria-label={"Poll option "+(i+1)} />{pollDraft.length>2&&<button type="button" className="hf5-poll-editor__remove" onClick={()=>setPollDraft(x=>x.filter((_,j)=>j!==i))} aria-label={"Remove option "+(i+1)}>✕</button>}</div>)}{pollDraft.length<4&&<button type="button" className="btn dark" onClick={()=>setPollDraft(x=>[...x,""])}>+ Add option</button>}<small className="muted">Polls are text only — 2 to 4 options. Members can change their vote.</small></div>}
      <div className="hc-feed-composer__footer">{composerMode!=="poll"&&<><button type="button" className="hc-feed-photo-button" aria-expanded={mediaPickerOpen} aria-controls="hc-feed-media-picker" onClick={()=>setMediaPickerOpen(v=>!v)}><HoopIcon name="image" size={16}/> Camera & media</button>{mediaPickerOpen&&<div id="hc-feed-media-picker" className="hc-feed-media-picker"><label className="hc-feed-photo-button" htmlFor="hoopfeed-camera">Take photo</label><label className="hc-feed-photo-button" htmlFor="hoopfeed-video-camera">Record video</label><label className="hc-feed-photo-button" htmlFor="hoopfeed-photo">Photo library{photos.length?` (${photos.length}/4)`:""}</label><label className="hc-feed-photo-button" htmlFor="hoopfeed-video">Video library</label></div>}<input id="hoopfeed-video-camera" type="file" accept="video/mp4,video/webm,video/quicktime" capture="environment" className="visually-hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;chooseVideo(f);e.target.value="";setMediaPickerOpen(false);}} /><input id="hoopfeed-camera" type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={e=>{const f=e.target.files?.[0];if(f)choosePhoto(f);e.target.value="";setMediaPickerOpen(false);}} /><input id="hoopfeed-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={e=>{const f=e.target.files?.[0];if(f)choosePhoto(f);e.target.value="";setMediaPickerOpen(false);}} className="visually-hidden" /><input id="hoopfeed-video" className="visually-hidden" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>{const f=e.target.files?.[0];if(!f)return;chooseVideo(f);e.target.value="";setMediaPickerOpen(false);}} /></>}<label className="hc-feed-country-optin"><input type="checkbox" checked={showCountry} disabled={!profile?.current_country_public} onChange={event=>setShowCountry(event.target.checked)} /><span className="hc-feed-switch" aria-hidden="true"/><span className="hc-feed-country-copy"><strong>Show my country on this post</strong><small>— only your country is shown, never your city or precise location.</small></span></label><span className="hc-feed-counter" aria-live="polite">{body.length}/2000</span><button className="btn hc-feed-post-button" onClick={post} disabled={posting||(composerMode==="poll"?(!body.trim()||pollDraft.map(o=>o.trim()).filter(Boolean).length<2):(!body.trim()&&!photos.length&&!video)||(Boolean(video)&&!body.trim()))}>{posting?"Posting…":composerMode==="poll"?"POST POLL":"POST"}</button></div>
      {video&&!body.trim()&&<p className="hc-feed-video-caption-hint" role="status">Add a caption to your video before posting so HoopCheck can complete its safety checks.</p>}
      {previews.length>0&&<div className="hf5-photo-grid" style={{marginTop:12}}>{previews.map((src,i)=><div key={i} className="hf5-photo-grid__item"><img src={src} alt={"Photo "+(i+1)+" preview"} /><button type="button" className="hf5-photo-grid__remove" onClick={()=>removePhoto(i)} aria-label={"Remove photo "+(i+1)}>✕</button></div>)}</div>}{videoPreview&&<div style={{marginTop:12}}><video src={videoPreview} controls playsInline style={{width:"100%",maxHeight:360,borderRadius:16}}/><button type="button" className="btn dark" style={{marginTop:8}} onClick={()=>{setVideo(null);if(videoPreview)URL.revokeObjectURL(videoPreview);setVideoPreview("");setMsg("");}}>Remove video</button><small>Video uploads require a caption for safety review.</small></div>}
      </div><div className="hc-feed-composer__actions">{msg&&<p className="hc-feed-message" role="status" aria-live="polite">{msg}</p>}</div>
    </section>

    <div className="hc-feed-filter-bar" aria-label="HoopFeed tools">{refreshing && <span className="hc-feed-pull-loading" role="status"><span className="hc-feed-pull-spinner" aria-hidden="true" /> Updating HoopFeed…</span>}<span className="hc-feed-result-count">{visiblePosts.length} {visiblePosts.length===1?"POST":"POSTS"}</span></div>
    <section className="hc-feed-stream" aria-label="Recent HoopFeed posts">{visiblePosts.length?visiblePosts.map(p=>{const cs=comments[p.id]||[];const roleKey=(p.profiles?.account_type||"").toLowerCase();const rolePill=ROLE_PILLS[roleKey];const mediaImgs:string[]=(p.image_urls&&p.image_urls.length?p.image_urls:(p.image_url?[p.image_url]:[]));const carouselPos=Math.min(carouselIdx[p.id]||0,Math.max(0,mediaImgs.length-1));return <FeedPostCard key={p.id} onDoubleClick={()=>void toggleCheck(p)}>
      {p.is_pinned&&<div className="hf5-pinbar"><span>📌 Pinned by HoopCheck</span></div>}
      <header className="hc-feed-post-header"><FeedAuthorRow>{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt="" className="hc-feed-post-avatar hf5-avatar"/>:<span className="player-avatar-fallback hc-feed-post-avatar hf5-avatar">HC</span>}<div className="hc-feed-post-author__meta"><div className="hc-feed-post-author__line"><strong>{p.shared_post_id?"Shared by "+(p.profiles?.display_name||"HoopCheck Member"):(p.profiles?.display_name||"HoopCheck Member")}</strong><span className="hc-feed-verified" aria-label="HoopCheck member">✓</span>{rolePill&&<span className={"hf5-pill hf5-pill--"+roleKey}>{rolePill.label}</span>}{p.post_kind==="news"&&<span className="hf5-pill hf5-pill--news">News</span>}{p.post_kind==="poll"&&<span className="hf5-pill hf5-pill--poll">Poll</span>}<small>· {p.ageLabel}</small></div>{p.profiles?.current_team&&<span className="hc-feed-jersey-tag">{p.profiles.current_team}</span>}{p.shared_post?.profiles?.display_name&&<small className="muted">Originally shared from {p.shared_post.profiles.display_name}</small>}{p.location_country&&p.profiles?.current_country_public!==false&&<div className="muted hc-feed-location"><HoopIcon name="map-pin" size={14} /> Country: {p.location_country}</div>}</div></FeedAuthorRow></header>
      {p.topic_tag==="Game Day"&&p.game_day_team&&p.game_day_opponent&&<div className="hc-feed-game-score"><span>{p.game_day_team}</span>{p.game_day_score_for!=null&&p.game_day_score_against!=null?<strong>{p.game_day_score_for} <i>—</i> {p.game_day_score_against}</strong>:<strong className="hc-feed-game-vs">VS</strong>}<span>{p.game_day_opponent}</span></div>}{p.body.trim()&&<div className="hc-feed-post-body"><p>{p.body}</p></div>}{p.post_kind==="poll"&&Array.isArray(p.poll_options)&&p.poll_options.length>0&&(()=>{const v=votes[p.id]||{counts:p.poll_options.map(()=>0),total:0,mine:null};const voted=v.mine!==null;return <div className="hf5-poll" role="group" aria-label="Poll">{p.poll_options.map((opt,oi)=>{const pct=v.total?Math.round((v.counts[oi]||0)/v.total*100):0;return voted?<div key={oi} className={"hf5-poll__result"+(v.mine===oi?" is-mine":"")}><button type="button" className="hf5-poll__bar-button" onClick={()=>void vote(p,oi)} aria-label={"Vote for "+opt}><span className="hf5-poll__fill" style={{width:pct+"%"}} /><span className="hf5-poll__label">{opt}{v.mine===oi?" ✓":""}</span><span className="hf5-poll__pct">{pct}%</span></button></div>:<button key={oi} type="button" className="hf5-poll__option" onClick={()=>void vote(p,oi)}>{opt}</button>;})}<small className="muted">{v.total} {v.total===1?"vote":"votes"}{voted?" · Tap another option to change your vote":""}</small></div>;})()}<FeedMediaArea>{p.image_url||mediaImgs.length?(mediaImgs.length===1?<img src={mediaImgs[0]} alt="HoopFeed post" className={"hc-feed-post-image"+(checkBursts[p.id]?" hc-feed-photo-check-burst":"")} />:<div className="hf5-carousel"><img src={mediaImgs[carouselPos]} alt={"HoopFeed post photo "+(carouselPos+1)+" of "+mediaImgs.length} className={"hc-feed-post-image"+(checkBursts[p.id]?" hc-feed-photo-check-burst":"")} /><span className="hf5-carousel__count">{carouselPos+1}/{mediaImgs.length}</span>{carouselPos>0&&<button type="button" className="hf5-carousel__nav hf5-carousel__nav--prev" aria-label="Previous photo" onClick={()=>setCarouselIdx(x=>({...x,[p.id]:carouselPos-1}))}>‹</button>}{carouselPos<mediaImgs.length-1&&<button type="button" className="hf5-carousel__nav hf5-carousel__nav--next" aria-label="Next photo" onClick={()=>setCarouselIdx(x=>({...x,[p.id]:carouselPos+1}))}>›</button>}<div className="hf5-carousel__dots">{mediaImgs.map((_,di)=><span key={di} className={"hf5-carousel__dot"+(di===carouselPos?" is-active":"")} />)}</div></div>):null}{p.video_url&&<video src={p.video_url} controls playsInline preload="metadata" className="hc-feed-post-image" aria-label="HoopFeed video"/>}</FeedMediaArea>
      <FeedActionRow><button type="button" className={"hc-feed-action-pill hf5-check"+(mine[p.id]?" is-active":"")+(checkBursts[p.id]?" hc-feed-check-burst":"")} aria-label="Check this post" title="Check" onClick={()=>void toggleCheck(p)}><span className="hf5-up" aria-hidden="true">↑</span> {checks[p.id]||0}{checkBursts[p.id]&&<span className="hc-feed-check-pop" aria-hidden="true">✓</span>}</button><button type="button" className="hc-feed-action-pill" onClick={()=>setOpen(x=>({...x,[p.id]:!x[p.id]}))}>💬 {cs.length} {cs.length===1?"Comment":"Comments"}</button><button type="button" className="hc-feed-action-pill" disabled={posting} onClick={()=>void sharePost(p)}>Share</button><button type="button" className={"hc-feed-action-pill"+(savedMap[p.id]?" is-active":"")} onClick={()=>void toggleSave(p)}>{savedMap[p.id]?"🔖 Saved":"🔖 Save"}</button>{isAdmin&&<button type="button" className="hc-feed-action-pill" onClick={()=>void togglePin(p)}>{p.is_pinned?"📌 Unpin":"📌 Pin"}</button>}{p.author_id===user?.id&&<button type="button" className="hc-feed-action-pill" onClick={()=>void del(p)}>Delete</button>}</FeedActionRow>
      {open[p.id]&&<><button type="button" className="hc-feed-comments-backdrop" aria-label="Close comments" onClick={()=>setOpen(x=>({...x,[p.id]:false}))}/><div className="hc-feed-comments-panel" role="dialog" aria-modal="true" aria-label="Comments" style={{marginTop:14,borderTop:"1px solid var(--border)",paddingTop:14}}><div className="hc-feed-comments-sheet-head"><strong>COMMENTS</strong><button type="button" onClick={()=>setOpen(x=>({...x,[p.id]:false}))}>Close</button></div><div style={{display:"grid",gap:10}}>{cs.map(c=><div key={c.id} style={{display:"flex",gap:10}}>{c.profiles?.avatar_url?<img src={c.profiles.avatar_url} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback" style={{width:34,height:34,minWidth:34}}>HC</div>}<div><strong>{c.profiles?.display_name||"Member"}</strong><div style={{whiteSpace:"pre-wrap"}}>{c.body}</div><small className="muted">{ago(c.created_at,now)}</small></div></div>)}{!cs.length&&<p className="muted">No comments yet.</p>}</div><div style={{display:"flex",gap:8,marginTop:12}}><input value={drafts[p.id]||""} onChange={e=>setDrafts(x=>({...x,[p.id]:e.target.value}))} maxLength={1000} placeholder="Add a comment..." /><button type="button" className="btn" disabled={!drafts[p.id]?.trim()} onClick={()=>void comment(p.id)}>Send</button></div></div></>}
    </FeedPostCard>}) : posts.length===0 ? <FeedEmptyState><span className="eyebrow">THE FEED IS QUIET</span><h2>No posts yet — be the first to start the conversation</h2><p className="muted">HoopFeed is one community for players, fans, teams, coaches and agents. Share what is happening in your basketball world.</p><Link href="/players" className="btn">Find Players</Link></FeedEmptyState> : <FeedEmptyState><span className="eyebrow">NOTHING HERE YET</span><h2>{typeFilter==="Polls"?"No polls yet — start one from the composer":typeFilter==="News"?"No news posts yet":typeFilter==="Saved"?"Nothing saved yet — tap Save on any post":"No posts match this filter"}</h2><p className="muted">Try another filter or return to the full feed.</p><button type="button" className="btn" onClick={()=>{setTypeFilter("All Posts");}}>Show All Posts</button></FeedEmptyState>}
  </section>
  </div></main></PageShell>;
}
