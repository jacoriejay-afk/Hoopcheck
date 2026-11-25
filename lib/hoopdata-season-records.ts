import type { BdlFixture } from "./hoopdata-balldontlie";

type RecordRow = { teamId: string; played: number; wins: number; losses: number; pointsFor: number; pointsAgainst: number };
/** A records summary, not official standings: no ranks or league tiebreak assumptions. */
export function regularSeasonRecords(input: { provider: BdlFixture["provider"]; season: number; paginationComplete: boolean; coverageCertified: boolean; fixtures: readonly BdlFixture[] }): { state: "unavailable" } | { state:"provisional"; records: RecordRow[]; finalGames: number } {
  if (!input.paginationComplete || !input.coverageCertified || !input.fixtures.length) return {state:"unavailable"};
  const seen = new Set<string>(), rows = new Map<string,RecordRow>();
  let finalGames=0;
  const row = (id:string) => {
    let existing=rows.get(id);
    if (!existing) {existing={teamId:id,played:0,wins:0,losses:0,pointsFor:0,pointsAgainst:0};rows.set(id,existing);}
    return existing;
  };
  for (const fixture of input.fixtures) {
    if (fixture.provider!==input.provider || fixture.season!==input.season || seen.has(fixture.id) || fixture.postseason===null || fixture.homeProviderId===fixture.awayProviderId) return {state:"unavailable"};
    seen.add(fixture.id);
    if (fixture.postseason) continue;
    if (fixture.status==="unknown" || fixture.status==="delayed") return {state:"unavailable"};
    if (fixture.status!=="final") continue;
    const h=fixture.homeScore,a=fixture.awayScore;
    if (h===null||a===null||!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||h<0||a<0||h===a) return {state:"unavailable"};
    const home=row(fixture.homeProviderId), away=row(fixture.awayProviderId);
    home.played++;away.played++;home.pointsFor+=h;home.pointsAgainst+=a;away.pointsFor+=a;away.pointsAgainst+=h;
    if(h>a){home.wins++;away.losses++;}else{away.wins++;home.losses++;}
    finalGames++;
  }
  return finalGames===0?{state:"unavailable"}:{state:"provisional",records:[...rows.values()].sort((a,b)=>a.teamId.localeCompare(b.teamId,"en",{numeric:true})),finalGames};
}
