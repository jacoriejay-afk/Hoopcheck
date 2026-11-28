import type { SupabaseClient } from "@supabase/supabase-js";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Confirm the desired membership state under one pinned, live caller.
 * A zero-row write, transport error or hidden row is not itself proof.
 * This uses existing member RLS, never a privileged client. */
export async function setGroupMembership(client:SupabaseClient,uid:string,spaceId:string,join:boolean,signal:AbortSignal){
  if(!uuid.test(uid)||!uuid.test(spaceId)||signal.aborted)throw Error("Invalid group membership request.");
  const session=await client.auth.getSession();
  const token=session.data.session?.access_token;
  if(session.error||session.data.session?.user.id!==uid||!token||signal.aborted)throw Error("Verify your account.");
  const header="Bearer "+token;
  async function verify(){
    const user=await client.auth.getUser(token);
    const latest=await client.auth.getSession();
    if(signal.aborted||user.error||user.data.user?.id!==uid||latest.error||latest.data.session?.user.id!==uid||latest.data.session.access_token!==token)throw Error("Account changed.");
    const proof=await client.rpc("confirm_active_account_session").setHeader("Authorization",header).abortSignal(signal);
    if(signal.aborted||proof.error||proof.data!==true)throw Error("Group membership could not be verified.");
  }
  await verify();
  const change=join
    ? await client.from("hoop_group_members").insert({space_id:spaceId,user_id:uid}).setHeader("Authorization",header).abortSignal(signal)
    : await client.from("hoop_group_members").delete().eq("space_id",spaceId).eq("user_id",uid).setHeader("Authorization",header).abortSignal(signal);
  if(signal.aborted||(change.error&&!(join&&change.error.code==="23505")))throw Error("Group membership change could not be confirmed. Refresh before retrying.");
  const confirmed=await client.from("hoop_group_members").select("space_id,user_id").eq("space_id",spaceId).eq("user_id",uid).setHeader("Authorization",header).abortSignal(signal).maybeSingle();
  if(confirmed.error||signal.aborted||(join?(confirmed.data?.space_id!==spaceId||confirmed.data?.user_id!==uid):confirmed.data!==null))throw Error("Group membership change could not be confirmed. Refresh before retrying.");
  await verify();
  return {spaceId,joined:join};
}
