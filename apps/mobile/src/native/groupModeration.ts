const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PendingGroupPost={id:string;space_id:string;channel_id:string;body:string;moderation_status:"pending"};
export async function groupModeration(origin:string,token:string,spaceId:string,action?:{id:string;status:"approved"|"rejected"},request:typeof fetch=fetch){
  const url=new URL(origin);
  if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||!token||!uuid.test(spaceId))throw Error("Moderation access could not be verified.");
  if(action&&(!uuid.test(action.id)||!["approved","rejected"].includes(action.status)))throw Error("Invalid moderation action.");
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
    url.pathname="/api/hoopgroups/moderate";
    const response=await request(url.toString(),{method:action?"PATCH":"GET",headers:{Authorization:"Bearer "+token,...(action?{"Content-Type":"application/json"}:{})},...(action?{body:JSON.stringify(action)}:{}),redirect:"error",cache:"no-store",signal:controller.signal});
    if(!response.ok)throw Error(response.status===503?"Community moderation is not active yet.":"Moderation could not be verified.");
    const value=await response.json();
    if(action){if(value?.post?.id!==action.id||value.post.moderation_status!==action.status)throw Error("Moderation action could not be confirmed.");return [];}
    if(!Array.isArray(value?.posts)||value.posts.length>100||value.posts.some((p:PendingGroupPost)=>!p||!uuid.test(p.id)||!uuid.test(p.space_id)||!uuid.test(p.channel_id)||typeof p.body!=="string"||p.body.length>1200||p.moderation_status!=="pending"))throw Error("Moderation queue could not be verified.");
    return (value.posts as PendingGroupPost[]).filter(p=>p.space_id===spaceId);
  }finally{clearTimeout(timer);}
}
