import type { ContactMessage } from "./hoopChatHistory";
export type ReplyTarget = {scope:string;id:string};
export function scopedReplyTarget(scope:string,target:ReplyTarget|null,rows:ContactMessage[]):string|undefined {
 if(!scope||target?.scope!==scope||!rows.some(row=>row.id===target.id))return undefined;
 return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(target.id)?target.id:undefined;
}
export function makeReplyTarget(scope:string,thread:string,row:ContactMessage,rows:ContactMessage[]):ReplyTarget|null{
 if(!scope||row.request_id!==thread||!rows.some(item=>item.id===row.id&&item.request_id===thread))return null;
 return {scope,id:row.id};
}
