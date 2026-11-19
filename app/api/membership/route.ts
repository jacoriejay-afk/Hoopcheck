import { appleRequest } from "../../../lib/server/apple/service";
import { readEffectiveMembership } from "../../../lib/server/apple/membership";
import { appleReply,appleFailure } from "../../../lib/server/apple/http";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
 const {scoped,db,user}=await appleRequest(request,false);return appleReply({owner:user.id,subscription:await readEffectiveMembership(scoped,db,user.id)});
}catch(error){return appleFailure(error);}}
