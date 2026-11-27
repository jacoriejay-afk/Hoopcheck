import type { SupabaseClient } from "@supabase/supabase-js";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export type ForwardSelection={scope:string;sourceId:string;messageId:string};
type Thread={id:string;requester_id:string;player_id:string;status:string};
export function forwardDestinations(rows:Thread[],viewer:string,sourceId:string){
 return rows.filter(row=>uuid.test(row.id)&&row.id!==sourceId&&row.status==="accepted"&&[row.requester_id,row.player_id].includes(viewer));
}
export function forwardDraft(body:string,existing:string):string|null{
 const text=body.trim();
 if(!text||text.startsWith(">")||text.length>2000||existing.trim())return null;
 return text;
}
/** Read-only. Forwarding never copies another sender's message, creates a share token,
 * transfers a reply relationship, or sends a message. The destination composer
 * uses the existing verified delivery path after explicit review. */
export async function readForwardDraft(client:SupabaseClient,viewer:string,source:string,message:string,destination:string,signal:AbortSignal):Promise<string>{
 if(![viewer,source,message,destination].every(x=>uuid.test(x))||source===destination||signal.aborted)throw Error("Invalid forward request.");
 const session=await client.auth.getSession();
 if(session.error||session.data.session?.user.id!==viewer||signal.aborted)throw Error("Verify your account.");
 const token=session.data.session.access_token,header="Bearer "+token;
 const identity=await client.auth.getUser(token);
 if(identity.error||identity.data.user?.id!==viewer||signal.aborted)throw Error("Verify your account.");
 const threads=await client.from("player_contact_requests").select("id,requester_id,player_id,status").in("id",[source,destination]).eq("status","accepted").setHeader("Authorization",header).abortSignal(signal);
 if(threads.error||!Array.isArray(threads.data)||threads.data.length!==2||signal.aborted)throw Error("Conversation unavailable.");
 const rows=threads.data;
 if(![source,destination].every(id=>rows.some(row=>row.id===id&&row.status==="accepted"&&[row.requester_id,row.player_id].includes(viewer))))throw Error("Conversation unavailable.");
 const peers=rows.map(row=>row.requester_id===viewer?row.player_id:row.requester_id);
 if(peers.some(peer=>!uuid.test(peer)||peer===viewer))throw Error("Conversation unavailable.");
 const blocked=await client.from("user_blocks").select("blocked_id").eq("blocker_id",viewer).in("blocked_id",peers).limit(2).setHeader("Authorization",header).abortSignal(signal);
 if(blocked.error||!Array.isArray(blocked.data)||blocked.data.length||signal.aborted)throw Error("Conversation unavailable.");
 const result=await client.from("player_contact_messages").select("id,request_id,sender_id,body").eq("id",message).eq("request_id",source).eq("sender_id",viewer).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
 const row=result.data;
 if(result.error||!row||row.id!==message||row.request_id!==source||row.sender_id!==viewer||typeof row.body!=="string"||signal.aborted)throw Error("Message unavailable.");
 const draft=forwardDraft(row.body,"");
 if(draft===null)throw Error("Only your own plain-text messages can be forwarded.");
 const current=await client.auth.getSession();
 if(current.error||current.data.session?.user.id!==viewer||current.data.session.access_token!==token||signal.aborted)throw Error("Account changed.");
 return draft;
}
