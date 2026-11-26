/** Own-account chronology of verified club affiliations, never a public transfer announcement. */
export type VerifiedClubClaim={id:string;team_id:string|null;womens_team_id:string|null;season_start_year:number;season_end_year:number;verification_status:string;start_date?:string|null;end_date?:string|null;historicalClub?:{name:string;league?:string|null;country?:string|null}|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function day(value:unknown){if(typeof value!=="string"||!/^\d{4}-\d\d-\d\d$/.test(value))return null;const t=Date.parse(value+"T00:00:00Z");return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?t:null;}
type Change={id:string;from:string;to:string;lastRecordedEnd:string;nextRecordedStart:string};
type Result={state:"available"|"unavailable";changes:Change[]};
export function verifiedClubChanges(rows:readonly VerifiedClubClaim[],partial:boolean):Result{
 if(partial||rows.length>100)return {state:"unavailable",changes:[]};
 const verified=rows.filter(row=>row.verification_status==="verified");
 if(!verified.length)return {state:"available",changes:[]};
 const complete=[];
 for(const row of verified){
  const id=row.team_id??row.womens_team_id;
  const start=day(row.start_date),end=day(row.end_date);
  const name=row.historicalClub?.name?.trim();
  if(!id||!uuid.test(id)||Boolean(row.team_id)===Boolean(row.womens_team_id)||start===null||end===null||end<start||!name||name.length>160||!Number.isInteger(row.season_start_year)||!Number.isInteger(row.season_end_year)||row.season_end_year<row.season_start_year||row.season_end_year>row.season_start_year+1||new Date(start).getUTCFullYear()<row.season_start_year||new Date(end).getUTCFullYear()>row.season_end_year)return {state:"unavailable",changes:[]};
  complete.push({key:(row.womens_team_id?"womens:":"mens:")+id.toLowerCase(),name,start,end,row});
 }
 complete.sort((a,b)=>a.start-b.start||a.end-b.end);
 const changes:Change[]=[];
 for(let i=1;i<complete.length;i++){
  const before=complete[i-1],after=complete[i];
  if(after.start<=before.end)return {state:"unavailable",changes:[]};
  if(after.key===before.key)continue; // same canonical club despite name or league changes
  changes.push({id:before.row.id+":"+after.row.id,from:before.name,to:after.name,lastRecordedEnd:before.row.end_date!,nextRecordedStart:after.row.start_date!});
 }
 return {state:"available",changes:changes.reverse()};
}
