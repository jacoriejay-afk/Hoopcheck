import "server-only";
import { currentSeasonLabel, isLeagueInSeason, leagueSeasonStartMonth, type LeagueSeasonWindow } from "./league-season";

export type LeagueSeasonStatus = {
  inSeason: boolean;
  seasonLabel: string;
  nextStartMonth: string;
  localDate: string;
};

/** Resolve the calendar date at the league's venue/competition timezone. */
export function leagueLocalDate(at: Date, timeZone: string): string {
  if (Number.isNaN(at.getTime())) throw new Error("Invalid instant");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(at);
  const part = (type: string) => {
    const value = parts.find((item) => item.type === type)?.value;
    if (!value) throw new Error(`Missing ${type}`);
    return value;
  };
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function resolveLeagueSeason(
  league: LeagueSeasonWindow,
  at: Date,
  timeZone: string,
): LeagueSeasonStatus {
  const localDate = leagueLocalDate(at, timeZone);
  return {
    inSeason: isLeagueInSeason(league, localDate),
    seasonLabel: currentSeasonLabel(league, localDate),
    nextStartMonth: leagueSeasonStartMonth(league),
    localDate,
  };
}
