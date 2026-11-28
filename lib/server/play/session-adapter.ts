import "server-only";
import {appleRequest} from "../apple/service";
import {validPlaySandbox} from "./verification";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Reuses the same verified Auth/MFA/active-session checks as Apple. JWT
 * session_id is inspected only AFTER verification of the exact bearer. */
export function createPlaySessionAuthorizer(enabled:()=>boolean,verify:typeof appleRequest=appleRequest){
 return async(request:Request)=>{
  try{
   if(!enabled()||!validPlaySandbox(process.env))return null;
   const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]{1,16384})$/i)?.[1];
   if(!token)return null;
   const {scoped,user}=await verify(request);
   const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString());
   if(claims.sub!==user.id||claims.role!=="authenticated"||typeof claims.session_id!=="string"||!uuid.test(claims.session_id))return null;
   const [profile,deletion]=await Promise.all([
    scoped.from("profiles").select("account_type,moderation_status").eq("id",user.id).maybeSingle(),
    scoped.from("account_deletion_requests").select("status").eq("user_id",user.id).in("status",["pending","processing","failed"]).limit(1).maybeSingle()
   ]);
   if(!enabled()||!validPlaySandbox(process.env)||profile.error||deletion.error||deletion.data||typeof profile.data?.account_type!=="string"||["suspended","banned","removed"].includes(profile.data.moderation_status??""))return null;
   return {owner:user.id,sessionId:claims.session_id as string,role:profile.data.account_type as string};
  }catch{return null;}
 };
}
