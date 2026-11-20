import { appleRequest,purchaseIntent } from "../../../../../lib/server/apple/service";
import { appleReply,appleFailure,appleJson } from "../../../../../lib/server/apple/http";
export const dynamic="force-dynamic";
export async function POST(request:Request){try{
 const {scoped,db,user}=await appleRequest(request);return appleReply(await purchaseIntent(scoped,db,user.id,await appleJson(request)));
}catch(error){return appleFailure(error);}}
