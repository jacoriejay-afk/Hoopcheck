const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const extensions={"video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"} as const;
export type StoryVideoInput={id:string;content_type:keyof typeof extensions;size:number;duration_ms:number};
export function validateStoryVideoInput(value:unknown):StoryVideoInput{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid video.");
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["id","content_type","size","duration_ms"].includes(k))||typeof v.id!=="string"||!uuid.test(v.id)||typeof v.content_type!=="string"||!Object.hasOwn(extensions,v.content_type)||typeof v.size!=="number"||!Number.isSafeInteger(v.size)||v.size<1||v.size>50*1024*1024||typeof v.duration_ms!=="number"||!Number.isSafeInteger(v.duration_ms)||v.duration_ms<1||v.duration_ms>60000)throw Error("Choose a video up to 60 seconds and 50 MB.");
 return {id:v.id,content_type:v.content_type as StoryVideoInput["content_type"],size:v.size,duration_ms:v.duration_ms};
}
export function storyVideoPath(owner:string,input:StoryVideoInput){
 if(!uuid.test(owner))throw Error("Invalid account.");
 const v=validateStoryVideoInput(input);
 return "story-quarantine/"+owner+"/"+v.id+"."+extensions[v.content_type];
}
export function storyVideoMetadataMatches(metadata:unknown,input:StoryVideoInput){
 if(!metadata||typeof metadata!=="object")return false;
 const m=metadata as Record<string,unknown>;
 return m.size===input.size&&m.mimetype===input.content_type;
}

/** Stage a private draft only. Retrying the same input ID first reconciles
 * an existing complete object. No publication, signed playback or approval. */
export async function uploadStoryDraft(api:string,project:string,owner:string,token:string,input:StoryVideoInput,signal:AbortSignal,upload:(url:string,headers:Record<string,string>,signal:AbortSignal)=>Promise<{status:number}>,request:typeof fetch=fetch){
 const metadata=validateStoryVideoInput(input),path=storyVideoPath(owner,metadata);
 function origin(value:string){const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw Error("Invalid media service.");return url;}
 const endpoint=origin(api);endpoint.pathname="/api/hoopfeed/story-video-upload";
 const storage=origin(project);
 if(!token||/\s/.test(token)||signal.aborted)throw Error("Verify your account.");
 async function reserve(){
  if(signal.aborted)throw Error("Upload cancelled.");
  const r=await request(endpoint,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(metadata),cache:"no-store",redirect:"error",signal});
  const result=await r.json().catch(()=>null);
  if(signal.aborted||!r.ok||result?.id!==metadata.id)throw Error("Private staging could not be confirmed. Retry the same draft.");
  return result;
 }
 const first=await reserve();
 if(first.state==="awaiting_moderation")return "awaiting_moderation" as const;
 if(first.state!=="awaiting_upload"||first.bucket!=="hoopfeed-private-videos"||first.path!==path||typeof first.token!=="string"||!first.token||first.token.length>8192)throw Error("Invalid staging ticket.");
 storage.pathname="/storage/v1/object/upload/sign/hoopfeed-private-videos/"+path;storage.searchParams.set("token",first.token);
 const transfer=await upload(storage.toString(),{"Content-Type":metadata.content_type,"x-upsert":"false","cache-control":"no-store"},signal);
 if(signal.aborted||transfer.status<200||transfer.status>=300)throw Error("Upload not confirmed. Retry the same draft.");
 const done=await reserve();
 if(done.state!=="awaiting_moderation")throw Error("Upload confirmation unavailable. Retry the same draft.");
 return "awaiting_moderation" as const;
}
