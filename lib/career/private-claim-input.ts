import { parseCareerSeason, careerClaimTarget, type CareerTeamSelection } from "./claim-input";
type ClaimInput =
 | { kind: "claim"; row: { team_id: string | null; womens_team_id: string | null; season_start_year: number; season_end_year: number } }
 | { kind: "missing_club"; row: { historical_name: string; country: string; city: string | null; league_name: string; division: string | null; basketball_type: "mens" | "womens"; season_start_year: number; season_end_year: number } };
function cleanText(value:unknown,max:number):string|null {
 if(typeof value!=="string"||value.length>max||/[\x00-\x1f\x7f]/.test(value)) return null;
 return value.trim()||null;
}
export function parsePrivateCareerClaim(value:unknown,nowYear:number):ClaimInput|null {
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const body=value as Record<string,unknown>;
 const season=parseCareerSeason(body.season,nowYear);
 if(!season)return null;
 const years={season_start_year:season.startYear,season_end_year:season.endYear};
 if(body.kind==="claim"){
   if(Object.keys(body).some(k=>!["kind","season","id","source"].includes(k)))return null;
   const target=careerClaimTarget({id:body.id,source:body.source} as CareerTeamSelection);
   return target?{kind:"claim",row:{...target,...years}}:null;
 }
 if(body.kind==="missing_club"){
   if(Object.keys(body).some(k=>!["kind","season","name","country","city","league","division","basketballType"].includes(k)))return null;
   const name=cleanText(body.name,160),country=cleanText(body.country,100),league=cleanText(body.league,160);
   const city=body.city==null||body.city===""?null:cleanText(body.city,100);
   const division=body.division==null||body.division===""?null:cleanText(body.division,100);
   if(!name||!country||!league||(body.city!=null&&body.city!==""&&!city)||(body.division!=null&&body.division!==""&&!division)||(body.basketballType!=="mens"&&body.basketballType!=="womens"))return null;
   return {kind:"missing_club",row:{historical_name:name,country,city,league_name:league,division,basketball_type:body.basketballType,...years}};
 }
 return null;
}
export const privateClaimFields="id,team_id,womens_team_id,season_start_year,season_end_year,start_date,end_date,verification_status,created_at";
export const missingClubFields="id,historical_name,country,city,league_name,division,basketball_type,season_start_year,season_end_year,status,resolved_snapshot_id,created_at";
