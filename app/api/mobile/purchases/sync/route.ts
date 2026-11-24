import { appleRequest,synchronizeApple } from "../../../../../lib/server/apple/service";
import { appleReply,appleFailure,appleJson } from "../../../../../lib/server/apple/http";
export const dynamic="force-dynamic";
export async function POST(request:Request){try{
 const {db,user}=await appleRequest(request);const body=await appleJson(request);return appleReply({owner:user.id,...await synchronizeApple(db,user.id,body.signedTransaction)});
}catch(error){return appleFailure(error);}}
