"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { PageShell } from "../../components/LayoutSystem";
import { FeedPostCard, FeedAuthorRow, FeedMediaArea, FeedActionRow, FeedEmptyState, FeedLoadingSkeleton } from "../../components/HoopFeedShared";
import { getHoopCheckEntitlements } from "../../lib/membership-tier";
import HoopLoading from "../../components/HoopLoading";
import HoopFeedPrivateMedia from "../../components/HoopFeedPrivateMedia";
import { HoopIcon } from "../../components/HoopCheckUI";
import FollowButton from "../../components/FollowButton";
import HoopFeedCommentsDialog from "../../components/HoopFeedCommentsDialog";
import HoopFeedEntityTag from "../../components/HoopFeedEntityTag";
import HoopFeedToday from "../../components/HoopFeedToday";
import { compareFeedPosts, entityHref, loadFeedWorld, SEGMENTS, type EntityTag, type FeedSort, type FeedWorld, type Segment, type TaggedPost } from "../../lib/hoopfeed-organization";
import "./feed-organization.css";
import "../hoopfeed-shared.css";
import "./feed-camera-picker.css";
import "./feed-compact-hero.css";
import "./feed-pull-refresh.css";

type MiniProfile = { display_name: string | null; avatar_url: string | null; account_type?: string | null; current_country?: string | null; current_country_public?: boolean; current_team?: string | null };
type Post = TaggedPost & { entity?: EntityTag; post_location?: string | null; id:string; shared_post_id?:string|null; shared_post?:{author_id:string;profiles?:{display_name:string|null}|null}|null; body:string; image_url:string|null; image_urls?:string[]|null; video_url?:string|null; post_kind?:string|null; poll_options?:string[]|null; is_pinned?:boolean|null; pinned_at?:string|null; location_country:string|null; topic_tag?:TopicTag|null; game_day_team?:string|null; game_day_opponent?:string|null; game_day_score_for?:number|null; game_day_score_against?:number|null; created_at:string; expires_at:string|null; author_id:string; ageLabel?:string; profiles?:MiniProfile|null };
type VoteState = { counts:number[]; total:number; mine:number|null };
type TopicTag = "Practice" | "Game Day" | "Travel" | "Teammates" | "Culture" | "Win" | "Challenge";
type TypeFilter = "All Posts" | "Discussion" | "News" | "Media" | "Polls" | "Saved";
const TYPE_FILTERS: TypeFilter[] = ["All Posts","Discussion","News","Media","Polls","Saved"];
const ROLE_PILLS: Record<string,{label:string}> = { player:{label:"Player"}, team:{label:"Team"}, coach:{label:"Coach"}, fan:{label:"Fan"}, agent:{label:"Agent"}, scout:{label:"Scout"}, manager:{label:"Manager"} };
type Comment = { id:string; post_id:string; parent_id?:string|null; body:string; created_at:string; author_id:string; profiles?:MiniProfile|null };
function orderCommentThreads(items:Comment[]):Array<Comment & {depth:number}>{
  const byParent=new Map<string,Comment[]>();
  const ids=new Set(items.map(item=>item.id));
  for(const item of items){
    const parent=item.parent_id && ids.has(item.parent_id) && item.parent_id!==item.id ? item.parent_id : "";
    const siblings=byParent.get(parent)||[];
    siblings.push(item);
    byParent.set(parent,siblings);
  }
  const ordered:Array<Comment & {depth:number}>=[];
  const visited=new Set<string>();
  const visit=(item:Comment,depth:number)=>{
    if(visited.has(item.id))return;
    visited.add(item.id);
    ordered.push({...item,depth});
    for(const child of byParent.get(item.id)||[])visit(child,Math.min(depth+1,3));
  };
  for(const item of byParent.get("")||[])visit(item,0);
  for(const item of items)visit(item,0);
  return ordered;
}
type Profile = { account_type: string; display_name: string | null; avatar_url: string | null;
  selected_team_id: string | null; selected_womens_team_id: string | null; basketball_type: string | null };
type Subscription = { plan:string|null; status:string|null; access_status:string|null; current_period_end:string|null };

const SHARED_POST_HASH = /^#post-([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;

const ago = (v:string, now:number) => {
  const s=Math.max(0,Math.floor((now-new Date(v).getTime())/1000));
  if(s<60)return "just now"; const m=Math.floor(s/60); if(m<60)return m+"m ago";
  const h=Math.floor(m/60); if(h<24)return h+"h ago"; return Math.floor(h/24)+"d ago";
};

export default function Feed(){
  const [posts,setPosts]=useState<Post[]>([]);
  const [linkedPostId, setLinkedPostId] = useState<string>();
  const [sharedLinkUnavailable, setSharedLinkUnavailable] = useState(false);
  const [comments,setComments]=useState<Record<string,Comment[]>>({});
  const [checks,setChecks]=useState<Record<string,number>>({}); const [checkBursts,setCheckBursts]=useState<Record<string,boolean>>({});
  const [mine,setMine]=useState<Record<string,boolean>>({});
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [replyTargets,setReplyTargets]=useState<Record<string,{id:string;name:string}|null>>({});
  const [sendingComments,setSendingComments]=useState<Record<string,boolean>>({});
  const commentRequests = useRef(new Set<string>());
  const [canReply, setCanReply] = useState(false);


  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [segment, setSegment] = useState<Segment>("All");
  const [sort, setSort] = useState<FeedSort>("Latest");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [world, setWorld] = useState<FeedWorld | null>(null);
  const [ready, setReady] = useState(false);
  const voteRequests = useRef(new Set<string>());
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [location, setLocation] = useState("");
  const [tag, setTag] = useState<EntityTag | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [body,setBody]=useState(""); const [typeFilter,setTypeFilter]=useState<TypeFilter>("All Posts"); const [photos,setPhotos]=useState<File[]>([]); const [previews,setPreviews]=useState<string[]>([]); const [composerMode,setComposerMode]=useState<"post"|"poll"|"news">("post"); const [composerExpanded,setComposerExpanded]=useState(false); const [pollDraft,setPollDraft]=useState<string[]>(["",""]); const [votes,setVotes]=useState<Record<string,VoteState>>({}); const [savedMap,setSavedMap]=useState<Record<string,boolean>>({}); const [carouselIdx,setCarouselIdx]=useState<Record<string,number>>({}); const [video,setVideo]=useState<File|null>(null); const [videoPreview,setVideoPreview]=useState("");
  const [user,setUser]=useState<any>(null); const [profile,setProfile]=useState<Profile|null>(null); const [adminRole,setAdminRole]=useState<string|null>(null); const [subscription,setSubscription]=useState<Subscription|null>(null);
  const [msg,setMsg]=useState(""); const [refreshing,setRefreshing]=useState(false); const [mediaPickerOpen,setMediaPickerOpen]=useState(false); const [loading,setLoading]=useState(true); const [posting,setPosting]=useState(false); const [now,setNow]=useState(0); const pendingChecksRef = useRef<Set<string>>(new Set()); const textareaRef = useRef<HTMLTextAreaElement|null>(null); const touchStartY = useRef<number|null>(null);
  const following = new Set(followingIds);
  const segmentPosts = {
    All: posts,
    Following: posts.filter(post => following.has(post.author_id) || post.author_id === user?.id),
    "My World": posts.filter(post =>
      Boolean(world?.club && post[world.club.column] === world.club.id) ||
      Boolean(world?.league && post[world.league.column] === world.league.id) ||
      Boolean(world?.groups.includes(post.club_id ?? post.womens_club_id ?? "")) ||
      Boolean(world?.members.includes(post.author_id))),
  };
  const visiblePosts = segmentPosts[segment].filter(p=>{
    const hasMedia=Boolean(p.image_url||(p.image_urls&&p.image_urls.length)||p.video_url);
    if(typeFilter==="Discussion"&&(hasMedia||p.post_kind==="poll"||p.post_kind==="news"))return false;
    if(typeFilter==="Media"&&!hasMedia)return false;
    if(typeFilter==="News"&&p.post_kind!=="news")return false;
    if(typeFilter==="Polls"&&p.post_kind!=="poll")return false;

    if(typeFilter==="Saved"&&!savedMap[p.id])return false;
    return true;
  }).slice().sort((a,b)=>{
    if (a.id !== b.id && (a.id === linkedPostId || b.id === linkedPostId)) return a.id === linkedPostId ? -1 : 1;
    return compareFeedPosts(a, b, sort, checks, now || Date.now());
  });

  const access=getHoopCheckEntitlements({accountType:profile?.account_type,subscription,isAdmin:adminRole==="admin"}).canReadHoopFeed;
  const isAdmin=adminRole==="admin";

  async function load(currentUser:any){
    const linkedPostId = window.location.hash.match(SHARED_POST_HASH)?.[1]?.toLowerCase();
    if (linkedPostId) setLinkedPostId(linkedPostId);
    const readablePosts = () => supabase.from("feed_posts").select(
      "id,shared_post_id,body,image_url,image_urls,video_url,post_kind,poll_options,is_pinned,pinned_at,location_country,topic_tag,game_day_team,game_day_opponent,game_day_score_for,game_day_score_against,created_at,expires_at,author_id,post_location,club_id,womens_club_id,league_id,womens_league_id,club:teams!feed_posts_club_id_fkey(id,name),womens_club:womens_teams!feed_posts_womens_club_id_fkey(id,name),league:leagues!feed_posts_league_id_fkey(id,name),womens_league:womens_leagues!feed_posts_womens_league_id_fkey(id,name),profiles:profiles!feed_posts_author_id_fkey(display_name,avatar_url,account_type,current_country_public,current_team)")
      .eq("status", "approved").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    const [linkedPostResult, archiveResult, followResult] = await Promise.all([
      linkedPostId ? readablePosts().eq("id", linkedPostId).maybeSingle() : null,
      supabase.from("feed_post_archives").select("post_id").eq("user_id", currentUser.id),
      supabase.from("follow_relationships").select("target_id").eq("follower_id", currentUser.id).in("target_type", ["player", "fan"]),
    ]);
    const archiveIds = new Set((archiveResult.data ?? []).map(row => row.post_id));
    if (!followResult.error) setFollowingIds((followResult.data ?? []).map(row => row.target_id));
    const feedRows: NonNullable<Awaited<ReturnType<typeof readablePosts>>["data"]> = [];
    let cursor: { created_at: string; id: string } | undefined;
    do {
      const query = readablePosts().order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200);
      if (cursor) query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
      const { data, error } = await query;
      if (error) {
        console.error("HoopFeed posts query failed", error);
        setMsg("HoopFeed could not load posts. Please refresh and try again.");
        return;
      }
      feedRows.push(...(data ?? []));
      cursor = data?.length === 200 ? data[199] : undefined;
    } while (cursor);
    const linkedPost = linkedPostResult?.data;
    const sourceRows = linkedPost && !feedRows.some(row => row.id === linkedPost.id)
      ? [linkedPost, ...feedRows]
      : feedRows;
    setSharedLinkUnavailable(Boolean(linkedPostId && (!linkedPost || archiveIds.has(linkedPostId))));
    const sharedIds=[...new Set(sourceRows.map(row=>row.shared_post_id).filter(Boolean))] as string[];
    let sharedPostsById:Record<string,any>={};
    if(sharedIds.length){
      const {data:sharedRows,error:sharedError}=await supabase.from("feed_posts").select("id,author_id,profiles:profiles!feed_posts_author_id_fkey(display_name)").in("id",sharedIds);
      if(sharedError){console.error("HoopFeed shared-post lookup failed",sharedError);}
      sharedPostsById=Object.fromEntries((sharedRows||[]).map((r:any)=>[r.id,{...r,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)}]));
    }
    const nowTs=Date.now();
    const rows=sourceRows.filter((r:any)=>!archiveIds.has(r.id)).map((r:any)=>{const post={...r,shared_post:r.shared_post_id?sharedPostsById[r.shared_post_id]||null:null,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)} as Post;return {...post,ageLabel:ago(post.created_at,nowTs)};});
    const sourceById = new Map(sourceRows.map(source => [source.id, source]));
    for (const row of rows) {
      const source = sourceById.get(row.id);
      if (!source) continue;
      const candidates = [
        ["club_id", source.club], ["womens_club_id", source.womens_club],
        ["league_id", source.league], ["womens_league_id", source.womens_league],
      ] as const;
      for (const [column, relation] of candidates) {
        const entity = Array.isArray(relation) ? relation[0] : relation;
        if (entity) { row.entity = { ...entity, column }; break; }
      }
    }
    if (linkedPostId && linkedPost && !archiveIds.has(linkedPostId)) {
      setTypeFilter("All Posts"); setSegment("All");
    }
    const ids = rows.map(post => post.id);
    const totals: Record<string, number> = {};
    const myChecks: Record<string, boolean> = {};
    const saved: Record<string, boolean> = {};
    const myVotes: Record<string, VoteState> = {};
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);
      const [checksResult, bookmarksResult] = await Promise.all([
        supabase.rpc("get_hoopfeed_check_totals", { post_ids: batch }),
        supabase.from("feed_post_bookmarks").select("post_id").eq("user_id", currentUser.id).in("post_id", batch),
      ]);
      if (checksResult.error || bookmarksResult.error) {
        setMsg("Some HoopFeed activity could not load. Pull down to retry.");
      }
      for (const row of checksResult.data ?? []) {
        totals[row.post_id] = Number(row.checks_count);
        myChecks[row.post_id] = row.checked_by_me;
      }
      for (const row of bookmarksResult.data ?? []) saved[row.post_id] = true;
    }
    const pollIds = rows.filter(post => post.post_kind === "poll").map(post => post.id);
    for (let offset = 0; offset < pollIds.length; offset += 100) {
      const { data, error } = await supabase.rpc("get_hoopfeed_poll_totals", { post_ids: pollIds.slice(offset, offset + 100) });
      if (error) setMsg("Poll activity could not load. Pull down to retry.");
      for (const row of data ?? []) {
        const vote = myVotes[row.post_id] ??= { mine: null, counts: [], total: 0 };
        const count = Number(row.votes_count);
        vote.counts[row.option_index] = count;
        vote.total += count;
        if (row.voted_by_me) vote.mine = row.option_index;
      }
    }
    setChecks(totals); setMine(myChecks); setSavedMap(saved); setVotes(myVotes);
    setPosts(rows);
    if (linkedPostId && linkedPost && !archiveIds.has(linkedPostId)) {
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`post-${linkedPostId}`)?.scrollIntoView({ block: "start" })));
    }
  }

  async function loadComments(postId: string) {
    setCommentErrors(current => ({ ...current, [postId]: "" }));
    const { data, error } = await supabase.from("feed_post_comments")
      .select("id,post_id,body,created_at,author_id,parent_id,profiles:profiles!feed_post_comments_author_id_fkey(display_name,avatar_url)")
      .eq("post_id", postId).order("created_at").order("id");
    if (error) {
      setCommentErrors(current => ({ ...current, [postId]: "Comments could not load." }));
      return;
    }
    setCanReply(true);
    setComments(current => ({ ...current, [postId]: (data ?? []).map(row => ({
      ...row, profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
    })) }));
  }

  function chooseSegment(next: Segment) {
    setSegment(next); setVisibleLimit(30); setLinkedPostId(undefined);
    if (user) localStorage.setItem(`hoopfeed-segment:${user.id}`, next);
  }

  function chooseSort(next: FeedSort) {
    setSort(next); setVisibleLimit(30); setLinkedPostId(undefined);
    if (user) localStorage.setItem(`hoopfeed-sort:${user.id}`, next);
  }

  function showSystemPost(id: string) {
    setTypeFilter("All Posts");
    setLinkedPostId(id);
    requestAnimationFrame(() => document.getElementById(`post-${id}`)?.scrollIntoView({ block: "start" }));
  }

  useEffect(()=>{setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),60000);return()=>window.clearInterval(timer);},[]);

  useEffect(()=>{setLinkedPostId(window.location.hash.match(SHARED_POST_HASH)?.[1]?.toLowerCase());(async()=>{const {data:{session}}=await supabase.auth.getSession();const u=session?.user;setUser(u);if(!u){setLoading(false);return;}
    const [{data:p},{data:s}]=await Promise.all([
      supabase.from("profiles").select("account_type,display_name,avatar_url,selected_team_id,selected_womens_team_id,basketball_type").eq("id",u.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id",u.id).maybeSingle()
    ]);
    setProfile(p);setSubscription(s);
    const {data:roleData}=await supabase.rpc("get_current_user_admin_role");
    const resolvedAdminRole=roleData==="admin"||roleData==="moderator"?roleData:null;
    setAdminRole(resolvedAdminRole);
    const memberActive= getHoopCheckEntitlements({ accountType:p?.account_type, subscription:s, isAdmin:resolvedAdminRole==="admin" }).canReadHoopFeed;
    if (p && memberActive) {
      const savedSegment = localStorage.getItem(`hoopfeed-segment:${u.id}`);
      if (SEGMENTS.includes(savedSegment as Segment)) setSegment(savedSegment as Segment);
      if (localStorage.getItem(`hoopfeed-sort:${u.id}`) === "Top") setSort("Top");
      setLoading(false);
      await Promise.all([load(u), loadFeedWorld(u.id, p).then(setWorld)]);
      setReady(true);
    } else setLoading(false);
  })().catch(error => {
    console.error("HoopFeed initialization failed", error);
    setLoading(false); setReady(true); setMsg("HoopFeed could not load. Please refresh and try again.");
  });},[]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => setKeyboardOpen(window.innerHeight - viewport.height > 120);
    viewport.addEventListener("resize", resize);
    return () => viewport.removeEventListener("resize", resize);
  }, []);

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

  async function vote(p: Post, optionIndex: number) {
    if (!user || !access || voteRequests.current.has(p.id)) return;
    voteRequests.current.add(p.id);
    try {
      const result = await apiAction({ kind: "vote", post_id: p.id, option_index: String(optionIndex) });
      if (!result.ok) { setMsg(result.message || "That vote didn't go through. Please try again."); return; }
      const { data, error } = await supabase.rpc("get_hoopfeed_poll_totals", { post_ids: [p.id] });
      if (error) { setMsg("Your vote was saved. Refresh to see the updated poll."); return; }
      const updated: VoteState = { counts: [], total: 0, mine: optionIndex };
      for (const row of data ?? []) {
        updated.counts[row.option_index] = Number(row.votes_count);
        updated.total += Number(row.votes_count);
      }
      setVotes(current => ({ ...current, [p.id]: updated }));
    } finally {
      voteRequests.current.delete(p.id);
    }
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
    let uploadAccessToken="";
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setMsg("Your session expired. Please sign in again.");setPosting(false);return;}
      uploadAccessToken=session.access_token;
      const form=new FormData();
      form.append("kind","post");
      form.append("audience","community");
      form.append("text",body.trim());
      if (location.trim()) form.append("post_location", location.trim());
      if (tag) form.append(tag.column, tag.id);
      form.append("post_kind",composerMode==="poll"?"poll":composerMode==="news"?"news":"discussion");
      if(composerMode==="poll")form.append("poll_options",JSON.stringify(pollOptionsClean));
      photos.forEach(f=>form.append("images",f));
      if(video){
        const ext=video.type==="video/webm"?"webm":video.type==="video/quicktime"?"mov":(!video.type&&/\.webm$/i.test(video.name))?"webm":(!video.type&&/\.mov$/i.test(video.name))?"mov":"mp4";
        const videoType=video.type||({webm:"video/webm",mov:"video/quicktime",mp4:"video/mp4"} as Record<string,string>)[ext];
        const authorization=await fetch("/api/hoopfeed/video-upload",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({content_type:videoType,size:video.size})});
        if(!authorization.ok)throw new Error("Video upload authorization failed. Please try again.");
        const upload=await authorization.json();
        if(upload.mode==="private"&&upload.bucket==="hoopfeed-private-videos"&&upload.path&&upload.token){
          const {error:uploadError}=await supabase.storage.from("hoopfeed-private-videos").uploadToSignedUrl(upload.path,upload.token,video,{contentType:videoType});
          if(uploadError)throw new Error("Video upload failed. Please try again.");
          uploadedVideoPath="hoopfeed-private-videos/"+upload.path;
          form.append("video_path",uploadedVideoPath);
        }else throw new Error("Unsupported video upload mode.");
        form.append("video_type",videoType);
      }
      const moderation=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await moderation.json().catch(()=>({}));
      if(!moderation.ok||result.allowed!==true){setMsg(result.message||"This post could not be published because it did not pass HoopFeed safety checks.");if(uploadedVideoPath){try{const {error:cleanupError}=uploadedVideoPath.startsWith("hoopfeed-private-videos/") ? await fetch("/api/hoopfeed/video-cleanup",{method:"DELETE",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({path:uploadedVideoPath.slice("hoopfeed-private-videos/".length)})}).then(r=>({error:r.ok?null:new Error("Cleanup failed")})) : await supabase.storage.from("feed-videos").remove([uploadedVideoPath]);if(cleanupError)console.error("HoopFeed rejected video cleanup failed",cleanupError);}catch(cleanupError){console.error("HoopFeed rejected video cleanup threw",cleanupError);}uploadedVideoPath=null;}setPosting(false);return;}
      uploadedVideoPath=null;
      setBody("");setVideo(null);if(videoPreview)URL.revokeObjectURL(videoPreview);setVideoPreview("");setLocation("");setTag(null);setComposerExpanded(false);clearPhotos();setPollDraft(["",""]);setComposerMode("post");setMsg(composerMode==="poll"?"Poll posted to HoopFeed. AI safety checks passed.":"Posted to HoopFeed. AI safety checks passed.");try{await load(user);}catch(refreshError){console.error("HoopFeed refresh after posting failed",refreshError);setMsg("Your post was published, but the feed could not refresh. Pull down to reload.");}
    }catch(e:any){console.error("HoopFeed post failed",e);setMsg(e?.message==="Video upload failed. Please try again."?e.message:"Posting failed. Please try again.");}
    if(uploadedVideoPath){try{const {error:cleanupError}=uploadedVideoPath.startsWith("hoopfeed-private-videos/") ? await fetch("/api/hoopfeed/video-cleanup",{method:"DELETE",headers:{Authorization:"Bearer "+uploadAccessToken,"Content-Type":"application/json"},body:JSON.stringify({path:uploadedVideoPath.slice("hoopfeed-private-videos/".length)})}).then(r=>({error:r.ok?null:new Error("Cleanup failed")})) : await supabase.storage.from("feed-videos").remove([uploadedVideoPath]);if(cleanupError)console.error("HoopFeed rejected video cleanup failed",cleanupError);}catch(cleanupError){console.error("HoopFeed rejected video cleanup threw",cleanupError);}}
    setPosting(false);
  }

  async function sharePost(p:Post){
    // The fragment identifies the post. The recipient's viewer-scoped query decides access.
    const url = new URL(`/feed#post-${p.id}`, window.location.origin).href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "HoopFeed™", url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMsg("Post link copied.");
        return;
      }
      setMsg("Sharing isn't supported in this browser.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("HoopFeed share failed", error);
      setMsg("Couldn't share this post. Please try again.");
    }
  }

  async function toggleCheck(p:Post){
    if(!user||!access||pendingChecksRef.current.has(p.id))return;
    pendingChecksRef.current.add(p.id);
    try{
      if(mine[p.id]){
        const {error}=await supabase.from("feed_post_checks").delete().eq("post_id",p.id).eq("user_id",user.id);
        if(error){console.error("HoopFeed check update failed",error);setMsg("That check didn't go through. Please try again.");return;}
        setMine(x=>({...x,[p.id]:false}));
        setChecks(x=>({...x,[p.id]:Math.max(0,(x[p.id]||0)-1)}));
        setMsg("");
      }else{
        const {error}=await supabase.from("feed_post_checks").insert({post_id:p.id,user_id:user.id});
        if(error){
          // A duplicate check can happen when another device already checked this post.
          if(error.code==="23505"){
            setMine(x=>({...x,[p.id]:true}));
            const {count}=await supabase.from("feed_post_checks").select("post_id",{count:"exact",head:true}).eq("post_id",p.id);
            if(count!==null)setChecks(x=>({...x,[p.id]:count}));
            setMsg("");
            return;
          }
          console.error("HoopFeed check update failed",error);
          setMsg(error.code==="42501"?"You don't have permission to check this post. Please verify your membership and try again.":"That check didn't go through. Please try again.");
          return;
        }
        setMine(x=>({...x,[p.id]:true}));
        setChecks(x=>({...x,[p.id]:(x[p.id]||0)+1}));
        setMsg("");
        setCheckBursts(x=>({...x,[p.id]:true}));
        window.setTimeout(()=>setCheckBursts(x=>({...x,[p.id]:false})),750);
      }
    }finally{
      pendingChecksRef.current.delete(p.id);
    }
  }

  async function comment(post_id:string){
    const text=(drafts[post_id]||"").trim();if(!user||!access||!text||commentRequests.current.has(post_id))return;
    commentRequests.current.add(post_id);
    setSendingComments(x=>({...x,[post_id]:true}));
    const reportError = (message: string) => setCommentErrors(current => ({ ...current, [post_id]: message }));
    reportError("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){reportError("Your session expired. Please sign in again.");return;}
      const form=new FormData();form.append("kind","comment");form.append("post_id",post_id);form.append("text",text);if(replyTargets[post_id]?.id)form.append("parent_id",replyTargets[post_id]!.id);
      const moderation=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await moderation.json().catch(()=>({}));
      if(!moderation.ok||result.allowed!==true){reportError(result.message||"This comment did not pass HoopFeed safety checks.");return;}
      setDrafts(x=>({...x,[post_id]:""}));setReplyTargets(x=>({...x,[post_id]:null}));reportError("");
      if (result.comment) {
        const published: Comment = { ...result.comment, profiles: profile };
        setComments(current => ({ ...current, [post_id]: [...(current[post_id] ?? []).filter(item => item.id !== published.id), published] }));
      }
      await loadComments(post_id);
    }catch(e:any){console.error("HoopFeed comment failed",e);reportError("That comment couldn't be posted. Please try again.");}finally{commentRequests.current.delete(post_id);setSendingComments(x=>({...x,[post_id]:false}));}
  }

  async function del(p:Post){if(!user||p.author_id!==user.id)return;if(!confirm("Delete this HoopFeed post?"))return;const {error}=await supabase.from("feed_posts").delete().eq("id",p.id);if(error){console.error("HoopFeed delete failed",error);setMsg("That post couldn't be deleted. Please try again.");return;}{const marker="/storage/v1/object/public/feed-images/";const urls=[...((p.image_urls&&p.image_urls.length)?p.image_urls:[]),...(p.image_url?[p.image_url]:[])];const paths=urls.map(u=>{const i=u.indexOf(marker);return i>=0?u.slice(i+marker.length):"";}).filter(Boolean);if(paths.length)await supabase.storage.from("feed-images").remove(paths);}if(p.video_url){const marker="/storage/v1/object/public/feed-videos/";const i=p.video_url.indexOf(marker);if(i>=0)await supabase.storage.from("feed-videos").remove([p.video_url.slice(i+marker.length)]);}await load(user);}

  const title = <h1 className="visually-hidden">HoopFeed</h1>;

  if(loading)return <PageShell><main className="page-shell hc-feed-page"><div className="page-container"><HoopLoading label="Loading HoopFeed..." /><FeedLoadingSkeleton count={3} /></div></main></PageShell>;
  if(!user)return <PageShell><main className="page-shell hc-feed-page"><div className="page-container">{title}<section className="hero-card"><p className="eyebrow">HOOPFEED</p><h2>One community. Every role.</h2><p className="muted">Players, fans, teams, coaches and agents — HoopFeed is where the global basketball community talks. Join to post, comment and Check.</p><div className="actions"><Link href="/signup" className="btn">+ Join Community</Link><Link href={linkedPostId ? `/login?returnTo=${encodeURIComponent(`/feed#post-${linkedPostId}`)}` : "/login"} className="btn dark">Sign In</Link></div></section></div></main></PageShell>;
  if(!access)return <PageShell><main className="page-shell hc-feed-page"><div className="page-container">{title}<section className="hero-card"><p className="eyebrow">HOOPFEED</p><h2>The global basketball community</h2><p className="muted">An active Pro or Premium membership is required to enter HoopFeed — one feed for players, fans, teams, coaches and agents.</p><div className="actions"><Link href="/membership" className="btn">Upgrade Membership</Link><Link href="/dashboard" className="btn dark">Back to Dashboard</Link></div></section></div></main></PageShell>;

  return <PageShell><main className="page-shell hc-feed-page" onTouchStart={(event)=>{touchStartY.current=window.scrollY===0?(event.touches[0]?.clientY??null):null;}} onTouchEnd={(event)=>{const start=touchStartY.current;touchStartY.current=null;const end=event.changedTouches[0]?.clientY??0;if(start!==null&&end-start>80&&user&&profile&&!refreshing){void(async()=>{setRefreshing(true);try{await load(user);setNow(Date.now());}catch(error){console.error("HoopFeed refresh failed",error);setMsg("Could not refresh HoopFeed. Please try again.");}finally{setRefreshing(false);}})();}}}><div className="page-container">
    {title}

    <div className="hc-feed-organization">
      <div className="hc-feed-segments" role="group" aria-label="HoopFeed segments">
        {SEGMENTS.map(item => <button key={item} type="button" aria-pressed={segment === item} onClick={() => chooseSegment(item)}>
          {item}{ready && <small>{segmentPosts[item].length.toLocaleString()}</small>}
        </button>)}
      </div>
      <div className="hc-feed-sorts" role="group" aria-label="Sort HoopFeed">
        {(["Top", "Latest"] as const).map(item => <button key={item} type="button" aria-pressed={sort === item} onClick={() => chooseSort(item)}>{item}</button>)}
      </div>
    </div>
    <div className="hf5-type-row hc-liquid-glass-filter" role="group" aria-label="Filter HoopFeed by post type">{TYPE_FILTERS.map(t=><button type="button" key={t} className={"hf5-type-chip"+(typeFilter===t?" is-active":"")} aria-pressed={typeFilter===t} onClick={()=>{setTypeFilter(t);setVisibleLimit(30);}}>{t}</button>)}</div>

    {!composerExpanded && <button type="button" className="hc-feed-slim-composer" onClick={() => setComposerExpanded(true)} aria-controls="hc-feed-composer-fields">
      <span className="hc-feed-composer__avatar" aria-hidden="true">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : "HC"}</span>
      <span>Share something…</span>
    </button>}
    {!composerExpanded && !keyboardOpen && !openComments && <button type="button" className="hc-feed-compose-fab" aria-label="Create HoopFeed post" onClick={() => {
      setComposerExpanded(true);
      requestAnimationFrame(() => document.getElementById("hc-feed-composer-fields")?.scrollIntoView({ block: "center" }));
    }}>+</button>}
    <section className="hc-feed-editor-surface" hidden={!composerExpanded}>
      <div className="hc-feed-editor-heading"><h2>Create a post</h2><button type="button" onClick={() => setComposerExpanded(false)}>Close</button></div>
      <div id="hc-feed-composer-fields" className="hc-feed-composer__fields">
      <div className="hf5-mode-row" role="group" aria-label="Choose what to create">{([["post","Post"],["poll","Poll"]] as const).map(([m,label])=><button type="button" key={m} className={"hf5-type-chip"+(composerMode===m?" is-active":"")} aria-pressed={composerMode===m} onClick={()=>setComposerMode(m)}>{label}</button>)}{isAdmin&&<button type="button" className={"hf5-type-chip"+(composerMode==="news"?" is-active":"")} aria-pressed={composerMode==="news"} onClick={()=>setComposerMode("news")}>News (official)</button>}</div>
      <div className="hc-feed-composer__editor"><div className="hc-feed-composer__avatar" aria-hidden="true">{user?.user_metadata?.avatar_url?<img src={user.user_metadata.avatar_url} alt="" />:"HC"}</div><textarea ref={textareaRef} value={body} onChange={e=>{setBody(e.target.value);e.currentTarget.style.height="auto";e.currentTarget.style.height=Math.min(e.currentTarget.scrollHeight,220)+"px";}} rows={3} maxLength={2000} placeholder={composerMode==="poll"?"Ask the community a question...":composerMode==="news"?"Write the official update...":"Start a post... (ask, share, discuss, update)"} /></div>
      {composerMode==="poll"&&<div className="hf5-poll-editor" aria-label="Poll options">{pollDraft.map((opt,i)=><div key={i} className="hf5-poll-editor__row"><input value={opt} onChange={e=>setPollDraft(x=>x.map((o,j)=>j===i?e.target.value:o))} maxLength={60} placeholder={"Option "+(i+1)} aria-label={"Poll option "+(i+1)} />{pollDraft.length>2&&<button type="button" className="hf5-poll-editor__remove" onClick={()=>setPollDraft(x=>x.filter((_,j)=>j!==i))} aria-label={"Remove option "+(i+1)}>✕</button>}</div>)}{pollDraft.length<4&&<button type="button" className="btn dark" onClick={()=>setPollDraft(x=>[...x,""])}>+ Add option</button>}<small className="muted">Polls are text only — 2 to 4 options. Members can change their vote.</small></div>}
      <div className="hc-feed-composer__footer">{composerMode!=="poll"&&<><button type="button" className="hc-feed-photo-button" aria-expanded={mediaPickerOpen} aria-controls="hc-feed-media-picker" onClick={()=>setMediaPickerOpen(v=>!v)}><HoopIcon name="image" size={16}/> Camera & media</button>{mediaPickerOpen&&<div id="hc-feed-media-picker" className="hc-feed-media-picker"><label className="hc-feed-photo-button" htmlFor="hoopfeed-camera">Take photo</label><label className="hc-feed-photo-button" htmlFor="hoopfeed-video-camera">Record video</label><label className="hc-feed-photo-button" htmlFor="hoopfeed-photo">Photo library{photos.length?` (${photos.length}/4)`:""}</label><label className="hc-feed-photo-button" htmlFor="hoopfeed-video">Video library</label></div>}<input id="hoopfeed-video-camera" type="file" accept="video/mp4,video/webm,video/quicktime" capture="environment" className="visually-hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;chooseVideo(f);e.target.value="";setMediaPickerOpen(false);}} /><input id="hoopfeed-camera" type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={e=>{const f=e.target.files?.[0];if(f)choosePhoto(f);e.target.value="";setMediaPickerOpen(false);}} /><input id="hoopfeed-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={e=>{const f=e.target.files?.[0];if(f)choosePhoto(f);e.target.value="";setMediaPickerOpen(false);}} className="visually-hidden" /><input id="hoopfeed-video" className="visually-hidden" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>{const f=e.target.files?.[0];if(!f)return;chooseVideo(f);e.target.value="";setMediaPickerOpen(false);}} /></>}<span className="hc-feed-counter" aria-live="polite">{body.length}/2000</span><button className="btn hc-feed-post-button" onClick={post} disabled={posting||(composerMode==="poll"?(!body.trim()||pollDraft.map(o=>o.trim()).filter(Boolean).length<2):(!body.trim()&&!photos.length&&!video)||(Boolean(video)&&!body.trim()))}>{posting?"Posting…":composerMode==="poll"?"POST POLL":"POST"}</button></div>
      <div className="hc-feed-optional-fields">
        <label>Location <span className="muted">(optional)</span><input value={location} maxLength={100}
          placeholder="Add a public location" onChange={event => setLocation(event.target.value)} /></label>
        <HoopFeedEntityTag value={tag} onChange={setTag} />
      </div>
      {video&&!body.trim()&&<p className="hc-feed-video-caption-hint" role="status">Add a caption to your video before posting so HoopCheck can complete its safety checks.</p>}
      {previews.length>0&&<div className="hf5-photo-grid" style={{marginTop:12}}>{previews.map((src,i)=><div key={i} className="hf5-photo-grid__item"><img src={src} alt={"Photo "+(i+1)+" preview"} /><button type="button" className="hf5-photo-grid__remove" onClick={()=>removePhoto(i)} aria-label={"Remove photo "+(i+1)}>✕</button></div>)}</div>}{videoPreview&&<div style={{marginTop:12}}><video src={videoPreview} controls playsInline style={{width:"100%",maxHeight:360,borderRadius:16}}/><button type="button" className="btn dark" style={{marginTop:8}} onClick={()=>{setVideo(null);if(videoPreview)URL.revokeObjectURL(videoPreview);setVideoPreview("");setMsg("");}}>Remove video</button><small>Video uploads require a caption for safety review.</small></div>}
      </div>
    </section>
    {msg && <p className="hc-feed-message" role="status">{msg}</p>}
    {refreshing && <p className="hc-feed-pull-loading" role="status">Updating HoopFeed…</p>}
    {segment === "All" && ready && <HoopFeedToday
      pinned={posts.filter(post => post.is_pinned).sort((a, b) => Date.parse(b.pinned_at ?? b.created_at) - Date.parse(a.pinned_at ?? a.created_at))[0]}
      poll={posts.find(post => post.post_kind === "poll" && votes[post.id]?.mine == null)}
      world={world} now={now || Date.now()} onPost={showSystemPost} canUseChat={getHoopCheckEntitlements({accountType:profile?.account_type, subscription, isAdmin}).canUseLiveGameChat} />}
    {sharedLinkUnavailable && <p role="status">This shared post is unavailable.</p>}
    <section className="hc-feed-stream" aria-label="Recent HoopFeed posts">{!ready ? <FeedLoadingSkeleton count={3} /> : visiblePosts.length?visiblePosts.slice(0, visibleLimit).map(p=>{const cs=orderCommentThreads(comments[p.id]||[]);const roleKey=(p.profiles?.account_type||"").toLowerCase();const rolePill=ROLE_PILLS[roleKey];const mediaImgs:string[]=(p.image_urls&&p.image_urls.length?p.image_urls:(p.image_url?[p.image_url]:[]));const carouselPos=Math.min(carouselIdx[p.id]||0,Math.max(0,mediaImgs.length-1));return <FeedPostCard key={p.id} onDoubleClick={()=>void toggleCheck(p)}>
      
      <header id={`post-${p.id}`} className="hc-feed-post-header"><FeedAuthorRow>{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt="" className="hc-feed-post-avatar hf5-avatar"/>:<span className="player-avatar-fallback hc-feed-post-avatar hf5-avatar">HC</span>}<div className="hc-feed-post-author__meta"><div className="hc-feed-post-author__line"><strong>{p.shared_post_id?"Shared by "+(p.profiles?.display_name||"HoopCheck Member"):(p.profiles?.display_name||"HoopCheck Member")}</strong><span className="hc-feed-verified" aria-label="HoopCheck member">✓</span>{rolePill&&<span className={"hf5-pill hf5-pill--"+roleKey}>{rolePill.label}</span>}{p.post_kind==="news"&&<span className="hf5-pill hf5-pill--news">News</span>}{p.post_kind==="poll"&&<span className="hf5-pill hf5-pill--poll">Poll</span>}<small>· {p.ageLabel}</small></div>{p.profiles?.current_team&&<span className="hc-feed-jersey-tag">{p.profiles.current_team}</span>}{p.shared_post?.profiles?.display_name&&<small className="muted">Originally shared from {p.shared_post.profiles.display_name}</small>}{p.location_country&&p.profiles?.current_country_public!==false&&<div className="muted hc-feed-location"><HoopIcon name="map-pin" size={14} /> {p.location_country}</div>}{p.post_location && <div className="muted hc-feed-location"><HoopIcon name="map-pin" size={14} /> {p.post_location}</div>}
      {p.entity && <Link className="hc-feed-tag-chip" href={entityHref(p.entity)}>{p.entity.name}</Link>}
      </div>{p.author_id !== user.id && (roleKey === "player" || roleKey === "fan") && <FollowButton
        targetType={roleKey} targetId={p.author_id} showCount={false} showNotifications={false}
        controlledFollowing={following.has(p.author_id)} onFollowingChange={next => {
          setFollowingIds(current => next ? [...new Set([...current, p.author_id])] : current.filter(id => id !== p.author_id));
          void load(user);
        }} />}
      </FeedAuthorRow></header>
      {p.topic_tag==="Game Day"&&p.game_day_team&&p.game_day_opponent&&<div className="hc-feed-game-score"><span>{p.game_day_team}</span>{p.game_day_score_for!=null&&p.game_day_score_against!=null?<strong>{p.game_day_score_for} <i>—</i> {p.game_day_score_against}</strong>:<strong className="hc-feed-game-vs">VS</strong>}<span>{p.game_day_opponent}</span></div>}{p.body.trim()&&<div className="hc-feed-post-body"><p>{p.body}</p></div>}{p.post_kind==="poll"&&Array.isArray(p.poll_options)&&p.poll_options.length>0&&(()=>{const v=votes[p.id]||{counts:p.poll_options.map(()=>0),total:0,mine:null};const voted=v.mine!==null;return <div className="hf5-poll" role="group" aria-label="Poll">{p.poll_options.map((opt,oi)=>{const pct=v.total?Math.round((v.counts[oi]||0)/v.total*100):0;return voted?<div key={oi} className={"hf5-poll__result"+(v.mine===oi?" is-mine":"")}><button type="button" className="hf5-poll__bar-button" onClick={()=>void vote(p,oi)} aria-label={"Vote for "+opt}><span className="hf5-poll__fill" style={{width:pct+"%"}} /><span className="hf5-poll__label">{opt}{v.mine===oi?" ✓":""}</span><span className="hf5-poll__pct">{pct}%</span></button></div>:<button key={oi} type="button" className="hf5-poll__option" onClick={()=>void vote(p,oi)}>{opt}</button>;})}<small className="muted">{v.total} {v.total===1?"vote":"votes"}{voted?" · Tap another option to change your vote":""}</small></div>;})()}<FeedMediaArea>{p.image_url||mediaImgs.length?(mediaImgs.length===1?<HoopFeedPrivateMedia postId={p.id} reference={mediaImgs[0]} kind="image" alt="HoopFeed post" className={"hc-feed-post-image"+(checkBursts[p.id]?" hc-feed-photo-check-burst":"")} />:<div className="hf5-carousel"><HoopFeedPrivateMedia postId={p.id} reference={mediaImgs[carouselPos]} kind="image" alt={"HoopFeed post photo "+(carouselPos+1)+" of "+mediaImgs.length} className={"hc-feed-post-image"+(checkBursts[p.id]?" hc-feed-photo-check-burst":"")} /><span className="hf5-carousel__count">{carouselPos+1}/{mediaImgs.length}</span>{carouselPos>0&&<button type="button" className="hf5-carousel__nav hf5-carousel__nav--prev" aria-label="Previous photo" onClick={()=>setCarouselIdx(x=>({...x,[p.id]:carouselPos-1}))}>‹</button>}{carouselPos<mediaImgs.length-1&&<button type="button" className="hf5-carousel__nav hf5-carousel__nav--next" aria-label="Next photo" onClick={()=>setCarouselIdx(x=>({...x,[p.id]:carouselPos+1}))}>›</button>}<div className="hf5-carousel__dots">{mediaImgs.map((_,di)=><span key={di} className={"hf5-carousel__dot"+(di===carouselPos?" is-active":"")} />)}</div></div>):null}{p.video_url&&<HoopFeedPrivateMedia postId={p.id} reference={p.video_url} kind="video" className="hc-feed-post-image" ariaLabel="HoopFeed video"/>}</FeedMediaArea>
      <FeedActionRow><button type="button" className={"hc-feed-action-pill hf5-check"+(mine[p.id]?" is-active":"")+(checkBursts[p.id]?" hc-feed-check-burst":"")} aria-label="Check this post" title="Check" onClick={()=>void toggleCheck(p)}><span className="hf5-up" aria-hidden="true">↑</span> {checks[p.id]||0}{checkBursts[p.id]&&<span className="hc-feed-check-pop" aria-hidden="true">✓</span>}</button><button type="button" className="hc-feed-action-pill" onClick={() => {
        setOpenComments(p.id); void loadComments(p.id);
      }}>{comments[p.id] ? `${cs.length} ${cs.length === 1 ? "comment" : "comments"}` : "Comments"}</button><button type="button" className="hc-feed-action-pill" disabled={posting} onClick={()=>void sharePost(p)}>Share</button><button type="button" className={"hc-feed-action-pill"+(savedMap[p.id]?" is-active":"")} onClick={()=>void toggleSave(p)}>{savedMap[p.id]?"🔖 Saved":"🔖 Save"}</button>{isAdmin && <button type="button" className="hc-feed-action-pill" onClick={() => void togglePin(p)}>{p.is_pinned ? "Unpin" : "Pin"}</button>}{p.author_id===user?.id&&<><button type="button" className="hc-feed-action-pill" onClick={()=>void del(p)}>Delete</button></>}</FeedActionRow>
      {openComments === p.id && <HoopFeedCommentsDialog onClose={() => setOpenComments(null)}>
        <div className="hc-feed-comment-list">
          {cs.map(c => <article key={c.id} style={{ marginInlineStart: Math.min(c.depth * 12, 36) }}>
            {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" /> : <span className="player-avatar-fallback">HC</span>}
            <div><strong>{c.profiles?.display_name || "Member"}</strong> <small className="muted">{ago(c.created_at, now)}</small>
              <p>{c.body}</p>
              {canReply && <button type="button" onClick={() => setReplyTargets(current => ({
                ...current, [p.id]: { id: c.id, name: c.profiles?.display_name || "Member" },
              }))}>Reply</button>}
            </div>
          </article>)}
          {!cs.length && (comments[p.id] ? <p>No comments yet.</p> : !commentErrors[p.id] && <p role="status">Loading comments…</p>)}
        </div>
        <form className="hc-feed-comment-form" onSubmit={event => { event.preventDefault(); void comment(p.id); }}>
          {replyTargets[p.id] && <button type="button" onClick={() => setReplyTargets(current => ({ ...current, [p.id]: null }))}>
            Replying to {replyTargets[p.id]?.name} ×</button>}
          {commentErrors[p.id] && <p role="alert">{commentErrors[p.id]} {!comments[p.id] &&
            <button type="button" onClick={() => void loadComments(p.id)}>Retry</button>}</p>}
          <div><input aria-label="Write a comment" value={drafts[p.id] || ""} maxLength={1000}
            onChange={event => setDrafts(current => ({ ...current, [p.id]: event.target.value }))}
            placeholder={replyTargets[p.id] ? "Write a reply…" : "Add a comment…"} />
            <button type="submit" disabled={!drafts[p.id]?.trim() || sendingComments[p.id]}>
              {sendingComments[p.id] ? "Sending…" : "Send"}
            </button></div>
        </form>
      </HoopFeedCommentsDialog>}
    </FeedPostCard>}) : segment === "Following" ? <FeedEmptyState>
      <h2>Follow players to fill this view</h2>
      {world?.suggestions.filter(player => !following.has(player.id)).slice(0, 5).map(player =>
        <div className="hc-feed-suggested-player" key={player.id}><Link href={`/players/${player.id}`}>{player.display_name}</Link>
          <FollowButton targetType="player" targetId={player.id} showCount={false} showNotifications={false}
            controlledFollowing={following.has(player.id)} onFollowingChange={next => {
              setFollowingIds(current => next ? [...new Set([...current, player.id])] : current.filter(id => id !== player.id));
              void load(user);
            }} />
        </div>)}
    </FeedEmptyState> : segment === "My World" ? <FeedEmptyState>
      <h2>No posts in My World yet</h2><p>Posts from your club, league and fan groups will appear here.</p>
      <div className="actions">
        {world?.club && <Link href={entityHref(world.club)}>{world.club.name}</Link>}
        {world?.league && <Link href={entityHref(world.league)}>{world.league.name}</Link>}
        {Boolean(world?.groups.length) && <Link href="/team-hub/groups">My fan groups</Link>}
        {!world?.club && !world?.groups.length && <Link href="/search" className="btn">Search</Link>}
      </div>
    </FeedEmptyState> : posts.length === 0 ? <FeedEmptyState><h2>The feed is quiet</h2><p>Be the first to start the conversation.</p>
      <Link href="/players" className="btn">Find Players</Link>
    </FeedEmptyState> : <FeedEmptyState><h2>No posts match this filter</h2>
      <button type="button" className="btn" onClick={() => setTypeFilter("All Posts")}>Show All Posts</button>
    </FeedEmptyState>}
    {visiblePosts.length > visibleLimit && <button type="button" className="btn dark" onClick={() => setVisibleLimit(limit => limit + 30)}>Show more posts</button>}
  </section>
  </div></main></PageShell>;
}
