import type {SupabaseClient} from "@supabase/supabase-js";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
// The caller's RLS is the permission authority. No privileged client,
// subscription payload, or persisted local ACL may authorize a channel.
export async function readGroupChannelAccess(client:SupabaseClient,space:string,channel:string,bearer:string,signal:AbortSignal){
 if(!uuid.test(space)||!uuid.test(channel)||!/^Bearer [^\s]+$/.test(bearer)||signal.aborted)throw Error("Channel access unavailable.");
 const [s,c]=await Promise.all([
  client.from("hoop_group_spaces").select("id,visibility").eq("id",space).setHeader("Authorization",bearer).abortSignal(signal).maybeSingle(),
  client.from("hoop_group_channels").select("id,space_id,visibility").eq("id",channel).eq("space_id",space).setHeader("Authorization",bearer).abortSignal(signal).maybeSingle()
 ]);
 if(signal.aborted||s.error||c.error)throw Error("Channel access unavailable.");
 if(!s.data)return {spaceVisible:false,channelVisible:false,private:true};
 if(s.data.id!==space||!["public","private"].includes(s.data.visibility))throw Error("Unexpected community access.");
 if(!c.data)return {spaceVisible:true,channelVisible:false,private:true};
 if(c.data.id!==channel||c.data.space_id!==space||!["public","private"].includes(c.data.visibility))throw Error("Unexpected channel access.");
 return {spaceVisible:true,channelVisible:true,private:s.data.visibility==="private"||c.data.visibility==="private"};
}
