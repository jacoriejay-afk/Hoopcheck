export const nativeCareerClaimsEnabled=process.env.EXPO_PUBLIC_HOOPCHECK_CAREER_CLAIMS_ENABLED==="true";
export type Club={id:string;team_id:string|null;womens_team_id:string|null;historical_name:string;historical_league:string;historical_division:string|null;historical_country:string;club_state:string};
export type HistoricalClubLabel={name:string;league:string;division:string|null;country:string};
export type Claim={id:string;start_date?:string|null;end_date?:string|null;season_start_year:number;season_end_year:number;verification_status:string;team_id:string|null;womens_team_id:string|null;historicalClub?:HistoricalClubLabel|null};
export type MissingClub={id:string;historical_name:string;season_start_year:number;season_end_year:number;status:string};
export type History={claims:Claim[];missingClubs:MissingClub[];hasMore:boolean};
export function careerRequestUrl(origin:string,path:"claims"|"historical-clubs",query?:URLSearchParams){
 const u=new URL(origin);
 if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash)throw Error("Invalid career service configuration.");
 u.pathname="/api/career/"+path;
 if(query)u.search=query.toString();
 return u.toString();
}
export async function requestCareer<T>(origin:string,token:string,path:"claims"|"historical-clubs",options:{query?:URLSearchParams;body?:object;signal?:AbortSignal}={},request:typeof fetch=fetch):Promise<T>{
 if(!token)throw Error("Sign in to manage career history.");
 const response=await request(careerRequestUrl(origin,path,options.query),{method:options.body?"POST":"GET",cache:"no-store",redirect:"error",headers:{Authorization:"Bearer "+token,...(options.body?{"Content-Type":"application/json"}:{})},...(options.body?{body:JSON.stringify(options.body)}:{}),signal:options.signal});
 if(!response.ok){const message=response.status===409?"This claim already exists.":response.status===401||response.status===403?"Career history is not available to this session.":response.status===400?"Check your team and season details.":"Career history is unavailable. Try again.";throw Error(message);}
 return await response.json() as T;
}

export function careerTimeline(rows:readonly Claim[]){
 return [...rows].sort((a,b)=>b.season_start_year-a.season_start_year||b.season_end_year-a.season_end_year).map(row=>{
  const club=row.historicalClub;
  const clean=(value:unknown)=>typeof value==="string"?value.trim():"";
  const season=row.season_start_year===row.season_end_year?String(row.season_start_year):row.season_start_year+"–"+row.season_end_year;
  const status=({pending:"Pending verification",verified:"Verified",rejected:"Rejected",revoked:"Verification revoked"} as Record<string,string>)[row.verification_status];
  return {id:row.id,name:clean(club?.name)||"Historical club name unavailable",detail:[season,row.womens_team_id?"Women’s":"Men’s",clean(club?.league),clean(club?.division),clean(club?.country)].filter(Boolean).join(" · "),status:typeof status==="string"?status:"Verification status unavailable"};
 });
}
