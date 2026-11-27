/** Only render data for the currently authenticated member and channel. */
export function groupChannelScope(uid:string,channelId:string|undefined,member:boolean){
  return uid&&channelId&&member?JSON.stringify([uid,channelId]):"";
}
export function scopedGroupValue<T>(snapshot:{scope:string;value:T}|null,scope:string,fallback:T):T{
  return scope&&snapshot?.scope===scope?snapshot.value:fallback;
}
export function visibleGroupPosts<T extends {author_id:string;moderation_status:string}>(rows:T[],uid:string,blocked:Set<string>):T[]{
  return rows.filter(row=>!blocked.has(row.author_id)&&(row.moderation_status==="approved"||row.author_id===uid&&row.moderation_status==="pending"));
}
