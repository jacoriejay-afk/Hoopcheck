"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { HoopIcon } from "../../components/HoopCheckUI";
import CourtLines from "../../components/CourtLines";

type MiniProfile = { display_name: string | null; avatar_url: string | null; current_country?: string | null; current_team?: string | null };
type Post = { id:string; body:string; image_url:string|null; location_country:string|null; show_country?:boolean; topic_tag?:TopicTag|null; created_at:string; expires_at:string; author_id:string; ageLabel?:string; expiresLabel?:string; profiles?:MiniProfile|null };
type TopicTag = "Practice" | "Game Day" | "Travel" | "Teammates" | "Culture" | "Win" | "Challenge";
const TOPIC_TAGS: TopicTag[] = ["Practice","Game Day","Travel","Teammates","Culture","Win","Challenge"];
const topicClass = (tag: TopicTag) => tag.toLowerCase().replace(/\\s+/g, "-");
type Comment = { id:string; post_id:string; body:string; created_at:string; author_id:string; profiles?:MiniProfile|null };
type Profile = { account_type:string; current_country:string|null };
type Subscription = { plan:string|null; status:string|null; access_status:string|null };

const ago = (v:string, now:number) => {
  const s=Math.max(0,Math.floor((now-new Date(v).getTime())/1000));
  if(s<60)return "just now"; const m=Math.floor(s/60); if(m<60)return m+"m ago";
  const h=Math.floor(m/60); if(h<24)return h+"h ago"; return Math.floor(h/24)+"d ago";
};

export default function Feed(){
  const [posts,setPosts]=useState<Post[]>([]);
  const [comments,setComments]=useState<Record<string,Comment[]>>({});
  const [checks,setChecks]=useState<Record<string,number>>({});
  const [mine,setMine]=useState<Record<string,boolean>>({});
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [open,setOpen]=useState<Record<string,boolean>>({});
  const [body,setBody]=useState(""); const [topicTag,setTopicTag]=useState<TopicTag|null>(null); const [topicFilter,setTopicFilter]=useState<"All"|TopicTag>("All"); const [photo,setPhoto]=useState<File|null>(null); const [preview,setPreview]=useState(""); const [showCountry,setShowCountry]=useState(false); 
  const [user,setUser]=useState<any>(null); const [profile,setProfile]=useState<Profile|null>(null); const [subscription,setSubscription]=useState<Subscription|null>(null);
  const [msg,setMsg]=useState(""); const [loading,setLoading]=useState(true); const [posting,setPosting]=useState(false); const [now,setNow]=useState(0); const textareaRef = useRef<HTMLTextAreaElement|null>(null);
  const visiblePosts = topicFilter==="All" ? posts : posts.filter(p=>p.topic_tag===topicFilter);

  const access=["player","fan","scout","agent"].includes(profile?.account_type||"") &&
    (subscription?.plan==="pro"||subscription?.plan==="premium") &&
    (subscription?.status==="active"||subscription?.status==="trialing") &&
    (subscription?.access_status==null||["active","trialing","pro","premium"].includes(subscription.access_status));

  async function load(currentUser:any, currentProfile:Profile){
    const connectionPromise=currentProfile.account_type==="player"
      ? supabase.from("player_contact_requests").select("requester_id,player_id").or(`requester_id.eq.${currentUser.id},player_id.eq.${currentUser.id}`).eq("status","accepted").limit(100)
      : Promise.resolve({data:[]});
    const followPromise=currentProfile.account_type==="fan"
      ? supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id",currentUser.id).in("target_type",["fan","team"]).limit(100)
      : Promise.resolve({data:[]});
    const [connectionsResult,followsResult,feedResult]=await Promise.all([
      connectionPromise,followPromise,
      supabase.from("feed_posts").select("id,body,image_url,location_country,show_country,topic_tag,created_at,expires_at,author_id,profiles(display_name,avatar_url,current_country,current_team)")
        .eq("status","approved").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(30)
    ]);
    const connectedPlayerIds=(connectionsResult.data||[]).flatMap((x:any)=>x.requester_id===currentUser.id?[x.player_id]:[x.requester_id]).filter(Boolean);
    const followedFanIds=(followsResult.data||[]).filter((x:any)=>x.target_type==="fan").map((x:any)=>x.target_id).filter(Boolean);
    if(feedResult.error){setMsg(feedResult.error.message);return;}
    const now=Date.now();
    let rows=(feedResult.data||[]).map((r:any)=>{const post={...r,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)} as Post;return {...post,ageLabel:ago(post.created_at,now),expiresLabel:`Expires in ${Math.max(0,Math.ceil((new Date(post.expires_at).getTime()-now)/3600000))}h`};});
    if(currentProfile.account_type==="fan") rows=rows.filter(p=>followedFanIds.includes(p.author_id));
    if(currentProfile.account_type==="player") rows=rows.filter(p=>p.author_id===currentUser.id||connectedPlayerIds.includes(p.author_id));
    setPosts(rows);
    if(!rows.length){setComments({});setChecks({});setMine({});return;}
    const ids=rows.map(p=>p.id);
    void Promise.all([
      supabase.from("feed_post_comments").select("id,post_id,body,created_at,author_id,profiles(display_name,avatar_url)").in("post_id",ids).order("created_at",{ascending:true}),
      supabase.from("feed_post_checks").select("post_id,user_id").in("post_id",ids)
    ]).then(([commentsResult,checksResult])=>{
      const cg:Record<string,Comment[]>={};const cc:Record<string,number>={};const cm:Record<string,boolean>={};
      (commentsResult.data||[]).forEach((r:any)=>{(cg[r.post_id]??=[]).push({...r,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)});});
      (checksResult.data||[]).forEach((r:any)=>{cc[r.post_id]=(cc[r.post_id]||0)+1;if(r.user_id===currentUser.id)cm[r.post_id]=true;});
      setComments(cg);setChecks(cc);setMine(cm);
    });
  }

  useEffect(()=>{setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),60000);return()=>window.clearInterval(timer);},[]);

  useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();const u=session?.user;setUser(u);if(!u){setLoading(false);return;}
    const [{data:p},{data:s}]=await Promise.all([
      supabase.from("profiles").select("account_type,current_country").eq("id",u.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,access_status").eq("user_id",u.id).maybeSingle()
    ]);
    setProfile(p);setSubscription(s);
    const memberActive=(s?.plan==="pro"||s?.plan==="premium")&&(s?.status==="active"||s?.status==="trialing")&&(s?.access_status==null||["active","trialing","pro","premium"].includes(s.access_status));
    setLoading(false);
    if(p&&memberActive)void load(u,p);
  })();},[]);

  async function choosePhoto(f:File){
    if(!f.type.startsWith("image/")){setMsg("Choose a JPG, PNG, or WebP image.");return;}
    if(f.size>8*1024*1024){setMsg("Feed photos must be 8MB or smaller.");return;}
    try{
      const compressed=await new Promise<File>((resolve,reject)=>{
        const img=new Image(); const url=URL.createObjectURL(f);
        img.onload=()=>{URL.revokeObjectURL(url);const max=1600;const scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext("2d");if(!ctx){reject(new Error("Photo processing failed."));return;}ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(!blob){reject(new Error("Photo processing failed."));return;}resolve(new File([blob],"hoopfeed.jpg",{type:"image/jpeg"}));},"image/jpeg",0.82);};
        img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Photo could not be read."));}; img.src=url;
      });
      if(preview)URL.revokeObjectURL(preview);setPhoto(compressed);setPreview(URL.createObjectURL(compressed));setMsg("");
    }catch(e:any){setMsg(e?.message||"Photo processing failed.");}
  }
  function clearPhoto(){if(preview)URL.revokeObjectURL(preview);setPhoto(null);setPreview("");}

  async function post(){
    if(!user||!access||(!body.trim()&&!photo)||posting)return;
    setPosting(true);setMsg("Checking your post for safety...");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setMsg("Your session expired. Please sign in again.");setPosting(false);return;}
      const form=new FormData();
      form.append("kind","post");
      form.append("text",body.trim());
      form.append("share_country", showCountry ? "true" : "false");
      if(profile?.account_type==="player" && topicTag)form.append("topic_tag",topicTag);
      if(photo)form.append("image",photo);
      const moderation=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await moderation.json().catch(()=>({}));
      if(!moderation.ok||result.allowed!==true){setMsg(result.message||"This post could not be published because it did not pass HoopFeed safety checks.");setPosting(false);return;}
      setBody("");setTopicTag(null);setShowCountry(false);clearPhoto();setMsg("Posted to HoopFeed. AI safety checks passed. It stays live for 24 hours.");await load(user, profile!);
    }catch(e:any){setMsg(e?.message||"Safety check failed. Your content was not published.");}
    setPosting(false);
  }

  async function toggleCheck(p:Post){
    if(!user||!access)return;
    if(mine[p.id]){const {error}=await supabase.from("feed_post_checks").delete().eq("post_id",p.id).eq("user_id",user.id);if(error){setMsg(error.message);return;}setMine(x=>({...x,[p.id]:false}));setChecks(x=>({...x,[p.id]:Math.max(0,(x[p.id]||0)-1)}));}
    else{const {error}=await supabase.from("feed_post_checks").insert({post_id:p.id,user_id:user.id});if(error){setMsg(error.message);return;}setMine(x=>({...x,[p.id]:true}));setChecks(x=>({...x,[p.id]:(x[p.id]||0)+1}));}
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
      setDrafts(x=>({...x,[post_id]:""}));setMsg("");await load(user, profile!);
    }catch(e:any){setMsg(e?.message||"Comment safety check failed.");}
  }

  async function del(p:Post){if(!user||p.author_id!==user.id)return;if(!confirm("Delete this HoopFeed post?"))return;const {error}=await supabase.from("feed_posts").delete().eq("id",p.id);if(error){setMsg(error.message);return;}if(p.image_url){const marker="/storage/v1/object/public/feed-images/";const i=p.image_url.indexOf(marker);if(i>=0)await supabase.storage.from("feed-images").remove([p.image_url.slice(i+marker.length)]);}await load(user, profile!);}

  if(loading)return <main className="page-shell hc-feed-page"><div className="page-container"><HoopLoading label="Loading HoopFeed..." /><section className="hc-feed-skeletons" aria-label="Loading posts">{[0,1,2].map(n=><article className="dashboard-card hc-feed-skeleton" key={n}><div className="hc-feed-skeleton__head"><span/><div><i/><i/></div></div><i className="hc-feed-skeleton__line"/><i className="hc-feed-skeleton__line short"/><i className="hc-feed-skeleton__photo"/></article>)}</section></div></main>;
  if(!user)return <main className="page-shell hc-feed-page"><div className="page-container"><section className="hero-card"><p className="eyebrow">HOOPFEED</p><h1>Sign in to continue</h1><p className="muted">HoopFeed is for active Pro and Premium members.</p><Link href="/login" className="btn">Sign In</Link></section></div></main>;
  if(!access)return <main className="page-shell hc-feed-page"><div className="page-container"><header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link></header><section className="hero-card"><p className="eyebrow">HOOPFEED</p><h1>Daily Player Experiences</h1><p className="muted">Pro and Premium members can access HoopFeed. Players share basketball experiences; fans see posts from fans they follow.</p><div className="actions"><Link href="/membership" className="btn">Upgrade Membership</Link><Link href="/dashboard" className="btn dark">Back to Dashboard</Link></div></section></div></main>;

  return <main className="page-shell hc-feed-page"><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/players">Players</Link><Link href="/profile">Profile</Link></nav></header>
    <section className="hero-card hc-feed-hero"><div><p className="eyebrow">HOOPFEED <span className="hc-feed-plan-tag">{subscription?.plan==="premium"?"PREMIUM":"PRO"} MEMBER</span></p><h1>HoopFeed</h1><p className="muted">{profile?.account_type==="fan"?"Followed-fan activity, updated throughout the day.":"Share your current-season basketball life."}</p></div><p className="hc-feed-expiry-note">24-HOUR POSTS <span>Posts, photos, checks and comments expire with the post.</span></p></section>

    {(profile?.account_type==="player" || profile?.account_type==="fan") && <section className="dashboard-card hc-feed-composer" style={{marginTop:18}}><CourtLines variant="arc" className="hc-feed-composer__court" /><span className="card-kicker">SHARE TO HOOPFEED</span>
      <div className="hc-feed-composer__editor"><div className="hc-feed-composer__avatar" aria-hidden="true">{user?.user_metadata?.avatar_url?<img src={user.user_metadata.avatar_url} alt="" />:"HC"}</div><textarea ref={textareaRef} value={body} onChange={e=>{setBody(e.target.value);e.currentTarget.style.height="auto";e.currentTarget.style.height=Math.min(e.currentTarget.scrollHeight,220)+"px";}} rows={2} maxLength={500} placeholder={profile?.account_type==="fan"?"What are you watching, following, or talking about?":"What happened today? Practice, game day, travel, teammates, culture, wins, challenges…"} /></div>
      {profile?.account_type==="player"&&<div className="hc-feed-topic-picker" aria-label="Choose a topic"><span className="hc-feed-topic-label">TOPIC</span><div className="hc-feed-topic-chips">{TOPIC_TAGS.map(tag=><button type="button" key={tag} className={"hc-feed-topic-chip hc-feed-topic--"+topicClass(tag)+(topicTag===tag?" is-selected":"")} aria-pressed={topicTag===tag} onClick={()=>setTopicTag(current=>current===tag?null:tag)}>{tag}</button>)}</div></div>}
      <div className="hc-feed-composer__footer"><label className="hc-feed-photo-button" htmlFor="hoopfeed-photo"><HoopIcon name="image" size={16}/> Photo</label><input id="hoopfeed-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)choosePhoto(f)}} className="visually-hidden" /><label className="hc-feed-country-optin"><input type="checkbox" checked={showCountry} onChange={event=>setShowCountry(event.target.checked)} /><span className="hc-feed-switch" aria-hidden="true"/><span className="hc-feed-country-copy"><strong>Show my country on this post</strong><small>— only your country is shown, never your city or precise location.</small></span></label><span className="hc-feed-counter">{body.length}/500</span><button className="btn hc-feed-post-button" onClick={post} disabled={posting||(!body.trim()&&!photo)}>{posting?"Posting…":"POST"}</button></div>
      {preview&&<div style={{marginTop:12}}><img src={preview} alt="Post preview" style={{width:"100%",maxHeight:360,objectFit:"cover",borderRadius:16,display:"block"}}/><button type="button" className="btn dark" style={{marginTop:8}} onClick={clearPhoto}>Remove Photo</button></div>}
      <div className="hc-feed-composer__actions">{msg&&<p className="hc-feed-message" role="status" aria-live="polite">{msg}</p>}</div>
    </section>}

    <div className="hc-feed-filter-bar" aria-label="Filter HoopFeed by topic"><div className="hc-feed-filter-scroll">{(["All",...TOPIC_TAGS] as ("All"|TopicTag)[]).map(tag=><button type="button" key={tag} className={"hc-feed-filter-chip"+(topicFilter===tag?" is-active":"")+(tag!=="All"?" hc-feed-topic--"+topicClass(tag):"")} aria-pressed={topicFilter===tag} onClick={()=>setTopicFilter(tag)}>{tag}</button>)}</div><span className="hc-feed-result-count">{visiblePosts.length} {visiblePosts.length===1?"POST":"POSTS"}</span></div>
    <section className="hc-feed-stream" aria-label="Recent HoopFeed posts">{visiblePosts.length?visiblePosts.map(p=>{const cs=comments[p.id]||[];return <article className="dashboard-card hc-feed-ticket" key={p.id}>
      <header className="hc-feed-post-header"><div className="hc-feed-post-author">{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt="" className="hc-feed-post-avatar"/>:<div className="player-avatar-fallback hc-feed-post-avatar">HC</div>}<div className="hc-feed-post-author__meta"><div className="hc-feed-post-author__line"><strong>{p.profiles?.display_name||"HoopCheck Player"}</strong><span className="hc-feed-verified" aria-label="HoopCheck member">✓</span><small>{p.ageLabel}</small></div>{p.profiles?.current_team&&<span className="hc-feed-jersey-tag">{p.profiles.current_team}</span>}{p.show_country&&p.location_country&&<div className="muted hc-feed-location"><HoopIcon name="map-pin" size={14} /> Country: {p.location_country}</div>}</div></div>{p.author_id===user.id&&<button type="button" className="btn dark hc-feed-delete" onClick={()=>void del(p)}>Delete</button>}</header>
      <div className="hc-feed-expiry-track" aria-label={p.expiresLabel}><div style={{width:(Math.max(0,Math.min(1,(new Date(p.expires_at).getTime()-now)/86400000))*100)+"%"}}/></div>
      {p.topic_tag&&TOPIC_TAGS.includes(p.topic_tag)&&<span className={"hc-feed-post-topic hc-feed-topic--"+topicClass(p.topic_tag)}>{p.topic_tag}</span>}{p.body.trim()&&<p style={{whiteSpace:"pre-wrap",marginTop:14}}>{p.body}</p>}{p.image_url&&<img src={p.image_url} alt="HoopFeed post" className="hc-feed-post-image"/>}
      <div className="hc-feed-post-actions"><button type="button" className={"hc-feed-action-pill"+(mine[p.id]?" is-active":"")} onClick={()=>void toggleCheck(p)}>✓ CHECK · {checks[p.id]||0}</button><button type="button" className="hc-feed-action-pill" onClick={()=>setOpen(x=>({...x,[p.id]:!x[p.id]}))}>COMMENT · {cs.length}</button><span className="hc-feed-expires">{p.expiresLabel}</span></div>
      {open[p.id]&&<div style={{marginTop:14,borderTop:"1px solid var(--border)",paddingTop:14}}><div style={{display:"grid",gap:10}}>{cs.map(c=><div key={c.id} style={{display:"flex",gap:10}}>{c.profiles?.avatar_url?<img src={c.profiles.avatar_url} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback" style={{width:34,height:34,minWidth:34}}>HC</div>}<div><strong>{c.profiles?.display_name||"Player"}</strong><div style={{whiteSpace:"pre-wrap"}}>{c.body}</div><small className="muted">{ago(c.created_at,now)}</small></div></div>)}{!cs.length&&<p className="muted">No comments yet.</p>}</div><div style={{display:"flex",gap:8,marginTop:12}}><input value={drafts[p.id]||""} onChange={e=>setDrafts(x=>({...x,[p.id]:e.target.value}))} maxLength={1000} placeholder="Add a comment..." /><button type="button" className="btn" disabled={!drafts[p.id]?.trim()} onClick={()=>void comment(p.id)}>Send</button></div></div>}
    </article>}) : <div className="dashboard-card hc-feed-empty"><span className="eyebrow">THE FEED IS CLEAR</span><h2>No posts yet — players you follow haven’t posted in the last 24 hours</h2><p className="muted">Find players to grow your network and see more basketball life on HoopFeed.</p><Link href="/players" className="btn">Find Players</Link></div>}</section> : <div className="dashboard-card hc-feed-empty"><span className="eyebrow">NO MATCHING TOPICS</span><h2>No posts tagged {topicFilter} in the last 24 hours</h2><p className="muted">Try another topic or return to the full feed.</p><button type="button" className="btn" onClick={()=>setTopicFilter("All")}>Show All Posts</button></div>}
  </section>
  </div></main>;
}
