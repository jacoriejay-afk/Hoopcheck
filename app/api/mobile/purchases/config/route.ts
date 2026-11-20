import { appleRequest,readAppleCatalog } from "../../../../../lib/server/apple/service";
import { appleReply,appleFailure } from "../../../../../lib/server/apple/http";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
 const {scoped,db,user}=await appleRequest(request);const result=await readAppleCatalog(scoped,db,user.id);
 return appleReply({owner:result.owner,environment:result.environment,products:result.products,canPurchase:result.canPurchase,reason:result.reason});
}catch(error){return appleFailure(error);}}
