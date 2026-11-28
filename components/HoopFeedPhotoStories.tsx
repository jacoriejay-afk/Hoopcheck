"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthState } from "./AuthProvider";
import HoopFeedPrivateMedia from "./HoopFeedPrivateMedia";
import HoopFeedReportAction from "./HoopFeedReportAction";
import { readPhotoStories, publishPhotoStory, storyVisible, adjacentStoryId, type Story, type StoryCursor, type StoryAudience } from "../apps/mobile/src/native/photoStories";
import { PublicationUnconfirmed } from "../apps/mobile/src/native/mediaClient";
import {publishReviewedVideoStory,readMyVideoStoryJobs,videoStoryPhaseLabel,type VideoStoryJob} from "../apps/mobile/src/native/storyVideoReview";
import {uploadStoryDraft,validateStoryVideoInput,type StoryVideoInput} from "../apps/mobile/src/native/storyVideoStaging";
import { blockNativeAccount } from "../apps/mobile/src/native/accountBlocking";

const enabled = process.env.NEXT_PUBLIC_HOOPCHECK_PHOTO_STORIES_ENABLED === "true";
const reviewedPublicationEnabled=process.env.NEXT_PUBLIC_HOOPCHECK_REVIEWED_VIDEO_STORIES_ENABLED==="true";
const stagingEnabled=process.env.NEXT_PUBLIC_HOOPCHECK_VIDEO_STORY_STAGING_ENABLED==="true";
const statusEnabled=process.env.NEXT_PUBLIC_HOOPCHECK_VIDEO_STORY_REVIEW_LIFECYCLE_ENABLED==="true";
const community = process.env.NEXT_PUBLIC_HOOPCHECK_COMMUNITY_PHOTO_STORIES_ENABLED === "true";

export default function HoopFeedPhotoStories({ uid }: { uid: string }) {
  const { userId } = useAuthState();
  if (!enabled || !uid || userId !== uid) return null;
  return <StoriesEntry key={uid} uid={uid}/>;
}
function StoriesEntry({uid}:{uid:string}){
  const [open,setOpen]=useState(false);
  const close=useCallback(()=>setOpen(false),[]);
  return <section aria-label="Photo Stories">
    <button className="btn dark" type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Photo Stories</button>
    {open&&<StoriesPanel uid={uid} close={close}/>}
  </section>;
}
function StoriesPanel({uid,close}:{uid:string;close:()=>void}){
  const [rows,setRows]=useState<Story[]>([]),[cursor,setCursor]=useState<StoryCursor|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [video,setVideo]=useState<{file:File;url:string;id:string;duration:number}|null>(null),[videoProgress,setVideoProgress]=useState<number|null>(null),[jobs,setJobs]=useState<VideoStoryJob[]>([]),[videoStaged,setVideoStaged]=useState(false);
  const localPreview=useRef<string|null>(null);
  const [file,setFile]=useState<File|null>(null),[caption,setCaption]=useState(""),[audience,setAudience]=useState<StoryAudience>("followers");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false),[now,setNow]=useState(Date.now);
  const live=useRef(false),request=useRef<AbortController|null>(null);
  const active=useCallback((controller:AbortController)=>live.current&&request.current===controller&&!controller.signal.aborted,[]);
  const run=useCallback(async(task:(controller:AbortController)=>Promise<void>,timeout=12000)=>{
    if(!live.current||request.current)return;
    const controller=new AbortController();request.current=controller;
    setBusy(true);setMessage("");
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{await task(controller);}
    catch(error){if(live.current&&request.current===controller){setMessage(error instanceof Error?error.message:"Stories unavailable.");if(error instanceof PublicationUnconfirmed)setUncertain(true);}}
    finally{clearTimeout(timer);if(request.current===controller){request.current=null;if(live.current)setBusy(false);}}
  },[]);
  const refresh=useCallback(async(before?:StoryCursor)=>{
    await run(async controller=>{
      if(!before){setRows([]);setSelected(null);setCursor(null);}
      try{
        const page=await readPhotoStories(supabase,uid,controller.signal,before,new Date(),community,reviewedPublicationEnabled);
        if(!active(controller))throw Error("Story access could not be verified.");
        setRows(previous=>before?[...new Map([...previous,...page.stories].map(row=>[row.id,row])).values()]:page.stories);
        setCursor(page.next);setNow(Date.now());
      }catch(error){
        // A failed account/access check must not leave a previously loaded page visible.
        if(live.current&&request.current===controller){setRows([]);setSelected(null);setCursor(null);}
        throw error;
      }
    });
  },[uid,run,active]);
  useEffect(()=>{
    live.current=true;void refresh();
    const ticker=setInterval(()=>setNow(Date.now()),1000);
    const hide=()=>{if(document.visibilityState==="hidden"){live.current=false;request.current?.abort();close();}};
    document.addEventListener("visibilitychange",hide);
    return()=>{live.current=false;request.current?.abort();request.current=null;if(localPreview.current)URL.revokeObjectURL(localPreview.current);localPreview.current=null;clearInterval(ticker);document.removeEventListener("visibilitychange",hide);};
  },[refresh,close]);
  async function verifiedToken(controller:AbortController){
    const session=await supabase.auth.getSession();
    const token=session.data.session?.access_token;
    if(!active(controller)||session.error||session.data.session?.user.id!==uid||!token)throw Error("Verify your account.");
    const identity=await supabase.auth.getUser(token);
    const current=await supabase.auth.getSession();
    if(!active(controller)||identity.error||identity.data.user?.id!==uid||current.error||current.data.session?.user.id!==uid||current.data.session.access_token!==token)throw Error("Account changed.");
    return token;
  }
  function pickVideo(next:File|null){
    if(!next||!stagingEnabled||busy||uncertain)return;
    try{validateStoryVideoInput({id:crypto.randomUUID(),content_type:next.type,size:next.size,duration_ms:1});}
    catch{setMessage("Choose a supported video up to 50 MB.");return;}
    if(localPreview.current)URL.revokeObjectURL(localPreview.current);
    const url=URL.createObjectURL(next);localPreview.current=url;setVideo({file:next,url,id:crypto.randomUUID(),duration:0});setFile(null);setVideoStaged(false);setMessage("");
  }
  async function refreshVideoStatus(){
    await run(async controller=>{const token=await verifiedToken(controller);const result=await readMyVideoStoryJobs(window.location.origin,token,controller.signal);if(await verifiedToken(controller)!==token)throw Error("Account changed.");if(active(controller))setJobs(result);});
  }
  async function stageVideo(){
    if(!video||videoStaged||!stagingEnabled||!video.duration||video.duration>60000)return;
    const draft=video;
    await run(async controller=>{
      const token=await verifiedToken(controller);setVideoProgress(0);
      try{
        await uploadStoryDraft(window.location.origin,process.env.NEXT_PUBLIC_SUPABASE_URL||"",uid,token,{id:draft.id,content_type:draft.file.type as StoryVideoInput["content_type"],size:draft.file.size,duration_ms:draft.duration},controller.signal,async(url,headers,signal)=>{
          // Fetch refuses redirects; do not follow a signed upload ticket to
          // another origin. Browser progress is indeterminate until receipt.
          const response=await fetch(url,{method:"PUT",headers,body:draft.file,redirect:"error",signal});
          if(active(controller)&&response.ok)setVideoProgress(100);
          return {status:response.status};
        });
        if(await verifiedToken(controller)!==token)throw Error("Account changed.");
        if(active(controller)){setVideoStaged(true);setMessage("Private clip staged. It has not been published.");}
      }finally{if(live.current)setVideoProgress(null);}
    },180000);
  }
  async function publishReviewed(job:string){
    if(!reviewedPublicationEnabled||!window.confirm("Publish this reviewed video to followers for 24 hours, without a custom caption?"))return;
    let success=false;
    await run(async controller=>{
      await publishReviewedVideoStory(supabase,uid,job,controller.signal);
      if(active(controller)){success=true;setJobs(old=>old.filter(j=>j.id!==job));setVideo(null);setVideoStaged(false);if(localPreview.current)URL.revokeObjectURL(localPreview.current);localPreview.current=null;}
    });
    if(success&&live.current){await refresh();if(live.current)setMessage("Reviewed video published to followers for 24 hours.");}
  }
  async function publish(){
    if(!file||video||uncertain)return;
    const photoFile=file;let published=false;
    await run(async controller=>{
      if(photoFile.type!=="image/jpeg"||photoFile.size<1||photoFile.size>750000)throw Error("Choose a JPEG photo up to 750 KB.");
      const bitmap=await createImageBitmap(photoFile);
      const width=bitmap.width,height=bitmap.height;bitmap.close();
      if(!active(controller)||width<1||height<1||width*height>80000000)throw Error("Choose a valid photo.");
      const token=await verifiedToken(controller);
      await publishPhotoStory(window.location.origin,uid,token,caption,{uri:"browser-file",name:"photo.jpg",type:"image/jpeg",size:photoFile.size,width,height},controller.signal,async()=>photoFile,fetch,audience,community);
      if(!active(controller))return;
      setFile(null);setCaption("");published=true;
    },30000);
    if(published&&live.current){await refresh();if(live.current)setMessage("Story published for the selected audience for 24 hours.");}
  }
  async function remove(row:Story){
    if(row.author_id!==uid||!window.confirm("Remove your Story?"))return;
    await run(async controller=>{
      const token=await verifiedToken(controller);
      const result=await supabase.from("feed_posts").delete().eq("id",row.id).eq("author_id",uid).eq("post_kind","story").setHeader("Authorization","Bearer "+token).abortSignal(controller.signal).select("id");
      if(!active(controller))return;
      if(result.error||result.data?.length!==1||result.data[0].id!==row.id)throw Error("Removal could not be confirmed. Refresh before retrying.");
      setRows(previous=>previous.filter(item=>item.id!==row.id));setSelected(null);setMessage("Story removed.");
    });
  }
  async function block(row:Story){
    if(row.author_id===uid||!window.confirm("Block this account?"))return;
    await run(async controller=>{
      await verifiedToken(controller);
      await blockNativeAccount(supabase,uid,row.author_id,()=>active(controller));
      if(active(controller)){setRows(previous=>previous.filter(item=>item.author_id!==row.author_id));setSelected(null);setMessage("Account blocked.");}
    });
  }
  const visible=rows.filter(row=>storyVisible(row,now));
  const current=visible.find(row=>row.id===selected);
  return <div className="hc-feed-editor-surface">
    <div className="hc-feed-editor-heading"><h2>Photo Stories</h2><button type="button" onClick={close}>Close</button></div>
    <p className="muted">Photos are visible to the selected eligible audience for 24 hours. Expiration does not erase copies already downloaded.</p>
    <label>Story photo (JPEG, up to 750 KB)<input type="file" accept="image/jpeg" disabled={busy||uncertain} onChange={event=>{const next=event.target.files?.[0];if(next){if(localPreview.current)URL.revokeObjectURL(localPreview.current);localPreview.current=null;setVideo(null);setVideoStaged(false);setFile(next);}event.target.value="";}}/></label>
    {file&&<p>{file.name} <button type="button" disabled={busy||uncertain} onClick={()=>setFile(null)}>Remove photo</button></p>}
    {stagingEnabled&&<section aria-label="Private video Story draft"><label>Choose video (up to 60 seconds, 50 MB)<input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={busy||uncertain} onChange={e=>{pickVideo(e.target.files?.[0]??null);e.target.value="";}}/></label><label>Record video with camera<input type="file" accept="video/mp4,video/quicktime,video/webm" capture="environment" disabled={busy||uncertain} onChange={e=>{pickVideo(e.target.files?.[0]??null);e.target.value="";}}/></label>{video&&<><video key={video.id} src={video.url} controls playsInline preload="metadata" style={{width:"100%",maxHeight:260}} onLoadedMetadata={e=>{const ms=Math.ceil(e.currentTarget.duration*1000);setVideo(v=>v?.id===video.id?{...v,duration:Number.isFinite(ms)&&ms<=60000?ms:0}:v);}} onError={()=>setMessage("This clip cannot be previewed.")}/><button type="button" disabled={busy||!video.duration||videoStaged} onClick={()=>void stageVideo()}>{videoStaged?"Staged privately":"Stage privately for moderation"}</button>{videoProgress!==null&&<><p role="status">{videoProgress===100?"Upload received; confirming private staging…":"Uploading privately…"}</p><button type="button" onClick={()=>request.current?.abort()}>Cancel upload</button></>}<button type="button" disabled={busy} onClick={()=>{if(localPreview.current)URL.revokeObjectURL(localPreview.current);localPreview.current=null;setVideo(null);setVideoStaged(false);}}>Discard local preview</button></>}<p>Video drafts remain private until reviewed. {reviewedPublicationEnabled?"Use processing status to publish a reviewed video to followers.":"Video publication is disabled."} Custom captions are not enabled for video.</p></section>}
    {statusEnabled&&<section aria-label="Private video processing"><button type="button" disabled={busy} onClick={()=>void refreshVideoStatus()}>Check my video processing</button>{jobs.map(j=><div key={j.id}><p>{new Date(j.created_at).toLocaleString()} · {videoStoryPhaseLabel[j.phase]}</p>{reviewedPublicationEnabled&&j.phase==="review_approved"&&<button type="button" disabled={busy} onClick={()=>void publishReviewed(j.id)}>Publish reviewed video</button>}</div>)}</section>}
    <label>Story caption<textarea maxLength={2000} value={caption} disabled={busy||uncertain} onChange={event=>setCaption(event.target.value)}/></label>
    {community&&<label>Story audience<select value={audience} disabled={busy||uncertain} onChange={event=>setAudience(event.target.value==="community"?"community":"followers")}><option value="followers">Followers</option><option value="community">Eligible community</option></select></label>}
    <div className="actions"><button className="btn" type="button" disabled={!file||!!video||busy||uncertain} onClick={()=>void publish()}>Publish Story · 24h</button><button className="btn dark" type="button" disabled={busy} onClick={()=>void refresh()}>Refresh Stories</button></div>
    {uncertain&&<p role="status">Publication was uncertain. Review the Stories list before discarding your draft; do not repost automatically.</p>}
    {message&&<p role="status">{message}</p>}
    {current?<div>
      <p>{current.profiles?.display_name||"HoopCheck member"} · {current.audience} · expires {new Date(current.expires_at).toLocaleString()}</p>
      <HoopFeedPrivateMedia key={current.id} postId={current.id} reference={current.video_url||current.image_url} kind={current.video_url?"video":"image"} alt="Story media"/>
      {current.body&&<p>{current.body}</p>}
      {current.author_id===uid?<button type="button" disabled={busy} onClick={()=>void remove(current)}>Remove Story</button>:<><HoopFeedReportAction uid={uid} postId={current.id} authorId={current.author_id}/><button type="button" disabled={busy} onClick={()=>void block(current)}>Block account</button></>}
      <div className="actions">
        <button type="button" disabled={busy||!adjacentStoryId(visible,current.id,-1,now)} onClick={()=>setSelected(adjacentStoryId(visible,current.id,-1))}>Previous Story</button>
        <button type="button" disabled={busy||!adjacentStoryId(visible,current.id,1,now)} onClick={()=>setSelected(adjacentStoryId(visible,current.id,1))}>Next Story</button>
      </div>
      <button type="button" onClick={()=>setSelected(null)}>Back to Stories</button>
    </div>:visible.length?visible.map(row=><button key={row.id} type="button" onClick={()=>setSelected(row.id)}>{row.profiles?.display_name||"HoopCheck member"} · View Story</button>):<p role="status">{busy?"Checking Stories…":"No accessible photo Stories on this page."}</p>}
    {cursor&&<button type="button" disabled={busy} onClick={()=>void refresh(cursor)}>Load more Stories</button>}
  </div>;
}
