import { parseCareerSeason } from "./claim-input";
export const webExactSeasonReviewsEnabled=process.env.NEXT_PUBLIC_HOOPCHECK_EXACT_SEASON_REVIEWS_ENABLED==="true";
export function parseVerifiedSeasonAccess(input:unknown,nowYear:number):string[]{
 if(!input||typeof input!=="object")throw Error("Verified season access unavailable.");
 const row=input as Record<string,unknown>;
 if(row.exactSeasonRequired!==true||typeof row.canWrite!=="boolean"||!Array.isArray(row.verifiedSeasons))throw Error("Verified season access unavailable.");
 if(!row.canWrite)return [];
 const result=new Set<string>();
 for(const value of row.verifiedSeasons){const season=parseCareerSeason(value,nowYear);if(!season||season.label!==value)throw Error("Invalid verified season.");result.add(season.label);}
 return [...result];
}
export async function readVerifiedSeasonChoices(token:string,id:string,type:"team"|"womens-team",signal?:AbortSignal,request:typeof fetch=fetch){
 if(!token||!id)throw Error("Sign in to check verified seasons.");
 const response=await request("/api/review-access?"+new URLSearchParams({entityType:type,entityId:id}),{headers:{Authorization:"Bearer "+token},cache:"no-store",signal});
 if(!response.ok)throw Error("Verified season access unavailable.");
 return parseVerifiedSeasonAccess(await response.json(),new Date().getUTCFullYear());
}

// A form is tied to its first authenticated identity. Token refresh and
// repeated same-user SIGNED_IN events must not clear valid season choices.
// Once invalidated, even a switch back to the original account cannot
// revive an earlier asynchronous request or its private draft.
export function createReviewSessionGuard(onInvalidate:()=>void){
 let owner:string|undefined;
 let invalidated=false;
 return {
  observe(userId:string|null|undefined):boolean{
   if(invalidated)return false;
   if(!userId||(owner!==undefined&&owner!==userId)){
    invalidated=true;
    onInvalidate();
    return false;
   }
   owner=userId;
   return true;
  },
 };
}
