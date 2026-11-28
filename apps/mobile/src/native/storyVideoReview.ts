import type {SupabaseClient} from "@supabase/supabase-js";
export const videoStoryPhases=["awaiting_upload","inspecting","transcoding","awaiting_review","review_approved","rejected","retry_required"] as const;
export type VideoStoryPhase=typeof videoStoryPhases[number];
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const videoStoryPhaseLabel:Record<VideoStoryPhase,string>={awaiting_upload:"Waiting for upload",inspecting:"Checking video integrity",transcoding:"Preparing video and thumbnail",awaiting_review:"Waiting for visual and audio review",review_approved:"Review approved; not published",rejected:"Video did not pass review",retry_required:"Processing requires a retry"};
export async function readVideoStoryStatus(origin:string,token:string,id:string,signal:AbortSignal,request:typeof fetch=fetch){
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!uuid.test(id)||!token||/\s/.test(token)||signal.aborted)throw Error("Invalid status request.");
 url.pathname="/api/hoopfeed/story-video-review";
 const r=await request(url,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"status",id}),signal,cache:"no-store",redirect:"error"});
 const result=await r.json().catch(()=>null);
 if(signal.aborted||!r.ok||result?.id!==id||result.published!==false||!videoStoryPhases.includes(result.phase))throw Error("Video status unavailable.");
 return result.phase as VideoStoryPhase;
}

export type VideoStoryJob={id:string;created_at:string;duration_ms:number;phase:VideoStoryPhase};
export async function readMyVideoStoryJobs(origin:string,token:string,signal:AbortSignal,request:typeof fetch=fetch){
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!token||/\s/.test(token)||signal.aborted)throw Error("Invalid status request.");
 url.pathname="/api/hoopfeed/story-video-review";
 const r=await request(url,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"my_jobs"}),signal,cache:"no-store",redirect:"error"});
 const result=await r.json().catch(()=>null);
 if(signal.aborted||!r.ok||!Array.isArray(result?.jobs)||result.jobs.length>20)throw Error("Video status unavailable.");
 const jobs:VideoStoryJob[]=[],seen=new Set<string>();
 for(const j of result.jobs){
  if(!j||typeof j.id!=="string"||!uuid.test(j.id)||seen.has(j.id)||j.published!==false||!videoStoryPhases.includes(j.phase)||typeof j.created_at!=="string"||!Number.isFinite(Date.parse(j.created_at))||!Number.isSafeInteger(j.duration_ms)||j.duration_ms<1||j.duration_ms>60000)throw Error("Invalid video status.");
  seen.add(j.id);jobs.push({id:j.id,created_at:j.created_at,duration_ms:j.duration_ms,phase:j.phase});
 }
 return jobs;
}

export async function publishReviewedVideoStory(client:SupabaseClient,owner:string,job:string,signal:AbortSignal){
 if(!uuid.test(owner)||!uuid.test(job)||signal.aborted)throw Error("Invalid video publication.");
 const session=await client.auth.getSession(),token=session.data.session?.access_token;
 if(session.error||session.data.session?.user.id!==owner||!token||signal.aborted)throw Error("Verify account.");
 const verified=await client.auth.getUser(token);
 if(verified.error||verified.data.user?.id!==owner||signal.aborted)throw Error("Verify account.");
 const r=await client.rpc("publish_reviewed_story_video",{p_job:job}).setHeader("Authorization","Bearer "+token).abortSignal(signal);
 const after=await client.auth.getSession();
 if(signal.aborted||r.error||after.error||after.data.session?.user.id!==owner||after.data.session.access_token!==token)throw Error("Publication unconfirmed. Check this same job before retrying.");
 const data=r.data;
 if(data?.state!=="published"||!uuid.test(data.post_id)||typeof data.expires_at!=="string"||!Number.isFinite(Date.parse(data.expires_at))||Date.parse(data.expires_at)<=Date.now()||Date.parse(data.expires_at)>Date.now()+86400000+60000)throw Error("This video is not available for publication.");
 return {postId:data.post_id as string,expiresAt:data.expires_at as string};
}
