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
