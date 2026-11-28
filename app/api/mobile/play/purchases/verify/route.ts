import {appleRequest} from "../../../../../../lib/server/apple/service";
import {validPlaySandbox,createPlayVerificationClient} from "../../../../../../lib/server/play/verification";
import {verifyPlayRequest} from "../../../../../../lib/server/play/verify-request";
export const dynamic="force-dynamic";
export const runtime="nodejs";
// Isolated test endpoint only. A second independent switch is required.
// No purchase fulfillment, acknowledgment, public access or production writes.
const enabled=()=>process.env.HOOPCHECK_PLAY_TEST_API_ENABLED==="true"&&validPlaySandbox(process.env);
export async function POST(request:Request){
 return verifyPlayRequest(request,{
  enabled,
  async authorize(req){
   try{
    // Shared verified Auth user, confirmed email, MFA, session and freeze checks.
    const {scoped,user}=await appleRequest(req);
    const [profile,deletion]=await Promise.all([
     scoped.from("profiles").select("account_type,moderation_status").eq("id",user.id).maybeSingle(),
     scoped.from("account_deletion_requests").select("status").eq("user_id",user.id).in("status",["pending","processing","failed"]).limit(1).maybeSingle()
    ]);
    if(profile.error||deletion.error||!profile.data||deletion.data||typeof profile.data.account_type!=="string"||["suspended","banned","removed"].includes(profile.data.moderation_status??""))return null;
    return {owner:user.id,role:profile.data.account_type};
   }catch{return null;}
  },
  async takeBudget(req,session){
   if(!enabled())throw Error("Test verification unavailable");
   const {db,user}=await appleRequest(req);
   if(user.id!==session.owner)throw Error("Session changed");
   const result=await db.rpc("play_take_test_verification_budget",{p_owner:user.id});
   if(result.error||typeof result.data!=="boolean")throw Error("Verification budget unavailable");
   return result.data;
  },
  verify:(owner,token)=>createPlayVerificationClient().verify(owner,token),
  now:Date.now
 });
}
