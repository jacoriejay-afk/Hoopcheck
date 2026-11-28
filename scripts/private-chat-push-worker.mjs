// Offline adapter contract for a single leased private-chat push. No network
// provider, activation, scheduler or real credential is configured here.
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const token=/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{16,256}\]$/;
const message=Object.freeze({title:"HoopCheck",body:"You have a new update.",data:Object.freeze({path:"/notifications"})});
export async function deliverPrivateChatPush(client,provider){
 const claim=await client.rpc("claim_private_chat_push");
 if(claim.error)throw Error("Push claim unavailable.");
 const c=claim.data;
 if(["disabled","idle"].includes(c?.state))return c.state;
 if(c?.state!=="leased"||![c.notice_id,c.device_id,c.fence].every(v=>typeof v==="string"&&uuid.test(v)))throw Error("Invalid push lease.");
 const args={p_notice:c.notice_id,p_device:c.device_id,p_fence:c.fence};
 const resolved=await client.rpc("resolve_private_chat_push",args);
 if(resolved.error)throw Error("Push authorization unavailable.");
 let outcome="cancelled";
 if(resolved.data!==null){
  const d=resolved.data;
  if(!d||!["ios","android"].includes(d.platform)||typeof d.token!=="string"||!token.test(d.token))throw Error("Invalid push recipient.");
  try{
   // Never transmit the lease, notice, owner, sender, or conversation ID.
   const result=await provider.send({token:d.token,platform:d.platform,message});
   // Retry ONLY if the provider explicitly proves it did not accept the message.
   outcome=result==="accepted"?"sent":result==="not_accepted"?"retry":result==="invalid_token"?"invalid_token":"uncertain";
  }catch{outcome="uncertain";}
 }
 const ack=await client.rpc("finish_private_chat_push",{...args,p_outcome:outcome});
 if(ack.error||ack.data!==true)throw Error("Push outcome unconfirmed; do not replay automatically.");
 return outcome;
}
export function createOfflinePushProvider(outcome="accepted"){
 const receipts=[];
 return {receipts,async send(input){receipts.push(structuredClone(input.message));return outcome;}};
}
