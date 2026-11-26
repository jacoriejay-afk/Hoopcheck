export const nativeExactSeasonReviewsEnabled=process.env.EXPO_PUBLIC_HOOPCHECK_EXACT_SEASON_REVIEWS_ENABLED==="true";
export type ReviewDirectory="team"|"womens-team";
export function verifiedSeasonChoices(input:unknown,year:number):string[]{
 if(!input||typeof input!=="object")throw Error("Review access unavailable.");
 const row=input as Record<string,unknown>;
 if(row.exactSeasonRequired!==true||typeof row.canWrite!=="boolean"||!Array.isArray(row.verifiedSeasons))throw Error("Review access unavailable.");
 if(!row.canWrite)return [];
 const seasons=new Set<string>();
 for(const value of row.verifiedSeasons){
  if(typeof value!=="string"||!/^\d{4}(-\d{4})?$/.test(value))throw Error("Invalid verified season.");
  const [start,end]=value.split("-").map(Number);
  if(start<1900||start>year||(end!==undefined&&end!==start+1))throw Error("Invalid verified season.");
  seasons.add(value);
 }
 return [...seasons];
}
export function nativeReviewTarget(directory:ReviewDirectory,id:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error("Invalid team.");
 return directory==="womens-team"?{path:"/api/womens-reviews",payload:{womens_team_id:id}}:{path:"/api/reviews",payload:{team_id:id}};
}
export async function readNativeVerifiedSeasons(origin:string,token:string,id:string,directory:ReviewDirectory,signal?:AbortSignal,request:typeof fetch=fetch){
 nativeReviewTarget(directory,id);
 const u=new URL(origin);
 if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash||!token)throw Error("Invalid review access request.");
 u.pathname="/api/review-access";u.searchParams.set("entityType",directory);u.searchParams.set("entityId",id);
 const response=await request(u.toString(),{headers:{Authorization:"Bearer "+token},cache:"no-store",redirect:"error",signal});
 if(!response.ok)throw Error("Verified seasons unavailable.");
 return verifiedSeasonChoices(await response.json(),new Date().getUTCFullYear());
}
