// The local journal contains only the opaque, owner-scoped publication UUID.
// No caption, attachment, token, or response body is persisted.
export const publicationIdPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function publicationStorageKey(owner:string){
 if(!publicationIdPattern.test(owner))throw Error("Invalid publication owner.");
 return "hoopcheck:feed-publication:v1:"+owner;
}
export type ReceiptState="published"|"removed"|"cancelled"|"missing";
export async function resolvePublication(origin:string,token:string,key:string,cancelMissing:boolean,request:typeof fetch=fetch):Promise<ReceiptState>{
 if(!publicationIdPattern.test(key)||!token)throw Error("Publication verification unavailable.");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await request(origin+"/api/hoopfeed/publication",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({publication_id:key,cancel_missing:cancelMissing}),cache:"no-store",redirect:"error",signal:controller.signal});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.publication_id!==key||!["published","removed","cancelled","missing"].includes(result.state)||cancelMissing&&result.state==="missing")throw Error("Publication could not be verified. Your pending request was kept.");
  return result.state;
 }finally{clearTimeout(timer);}
}
export function requirePublicationAck(key:string|undefined,result:unknown){
 if(!key)return;
 const row=result as {publication_id?:unknown;post_id?:unknown}|null;
 if(row?.publication_id!==key||typeof row.post_id!=="string"||!publicationIdPattern.test(row.post_id))throw Error("Publication receipt missing. Check the previous request before retrying.");
}
export const recoveryMessage=(state:ReceiptState)=>state==="published"?"Your previous post was published. Review the feed before posting again.":state==="removed"?"The previous publication was removed. It cannot be replayed.":state==="cancelled"?"Unfinished publication cancelled. A delayed request cannot publish it. You may now post again.":"Publication is still unresolved.";
