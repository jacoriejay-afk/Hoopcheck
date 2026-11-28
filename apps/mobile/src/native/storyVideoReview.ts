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
