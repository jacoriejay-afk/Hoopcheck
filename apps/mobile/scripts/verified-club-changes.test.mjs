import test from "node:test";
import assert from "node:assert/strict";
import {verifiedClubChanges} from "../src/native/verifiedClubChanges.ts";
const a={id:"a",team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",womens_team_id:null,season_start_year:2024,season_end_year:2025,verification_status:"verified",start_date:"2024-09-01",end_date:"2025-05-01",historicalClub:{name:"Club A"}};
const b={...a,id:"b",team_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",season_start_year:2025,season_end_year:2026,start_date:"2025-09-01",end_date:"2026-05-01",historicalClub:{name:"Club B"}};
test("only complete, ordered verified distinct club records generate private chronology",()=>{
 assert.deepEqual(verifiedClubChanges([b,a],false),{state:"available",changes:[{id:"a:b",from:"Club A",to:"Club B",lastRecordedEnd:"2025-05-01",nextRecordedStart:"2025-09-01"}]});
 assert.deepEqual(verifiedClubChanges([a,{...b,team_id:a.team_id,historicalClub:{name:"Renamed A"}}],false).changes,[]);
 for(const status of ["pending","rejected","revoked"])assert.deepEqual(verifiedClubChanges([a,{...b,verification_status:status}],false).changes,[]);
});
test("partial records, overlaps, missing names and invalid dates abstain",()=>{
 assert.equal(verifiedClubChanges([a,b],true).state,"unavailable");
 for(const change of [{start_date:"2025-05-01"},{start_date:"2025-02-30"},{start_date:null},{historicalClub:null},{womens_team_id:b.team_id},{season_start_year:2026}])assert.equal(verifiedClubChanges([a,{...b,...change}],false).state,"unavailable");
});
