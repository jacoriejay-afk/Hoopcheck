import { parseCareerSeason } from "./claim-input";
export type HistoricalClubSearch = { name: string; season: ReturnType<typeof parseCareerSeason> & object; basketballType: "mens" | "womens" };
export function historicalClubSearch(params: URLSearchParams, nowYear: number): HistoricalClubSearch | null {
 const name = (params.get("q") || "").trim();
 const season = parseCareerSeason(params.get("season"), nowYear);
 const basketballType = params.get("basketballType");
 // Require a literal search, rather than allow user-supplied wildcard filters.
 if (name.length < 2 || name.length > 100 || /[%_*\\\x00-\x1f\x7f]/.test(name) || !season || (basketballType !== "mens" && basketballType !== "womens")) return null;
 return {name,season,basketballType};
}
export const historicalClubFields = "id,team_id,womens_team_id,season_start_year,season_end_year,historical_name,historical_league,historical_division,historical_country,club_state";
export const historicalClubResultLimit = 30;
