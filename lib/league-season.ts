/**
 * Canonical recurring league season date resolver.
 * Pass the league-local calendar date (YYYY-MM-DD) from the server.
 * Date-only values avoid timezone-dependent midnight shifts.
 */
export type LeagueSeasonWindow = {
  season_start_month: number;
  season_start_day: number;
  season_end_month: number;
  season_end_day: number;
  season_label?: string | null;
};

function monthDay(month: number, day: number): number {
  return month * 100 + day;
}

function valid(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) return false;
  // Allow Feb 29 as a recurring boundary; non-leap years resolve it to Feb 28.
  return day >= 1 && day <= new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

function boundary(month: number, day: number, year: number): number {
  if (month === 2 && day === 29 && new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1) return 228;
  return monthDay(month, day);
}

function parts(date: Date | string): { year: number; md: number } {
  if (typeof date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Expected league-local YYYY-MM-DD");
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    if (!valid(month, day) || new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) throw new Error("Invalid calendar date");
    return { year, md: monthDay(month, day) };
  }
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return { year: date.getUTCFullYear(), md: monthDay(date.getUTCMonth() + 1, date.getUTCDate()) };
}

function windowBounds(league: LeagueSeasonWindow, year: number) {
  const { season_start_month: sm, season_start_day: sd, season_end_month: em, season_end_day: ed } = league;
  if (!valid(sm, sd) || !valid(em, ed)) throw new Error("Invalid league season window");
  const start = boundary(sm, sd, year);
  const end = boundary(em, ed, year);
  return { start, end, wraps: monthDay(sm, sd) > monthDay(em, ed) };
}

export function isLeagueInSeason(league: LeagueSeasonWindow, date: Date | string): boolean {
  const { year, md } = parts(date);
  const { start, end, wraps } = windowBounds(league, year);
  return wraps ? md >= start || md <= end : md >= start && md <= end;
}

export function currentSeasonLabel(league: LeagueSeasonWindow, date: Date | string): string {
  const { year, md } = parts(date);
  const { start, wraps } = windowBounds(league, year);
  const seasonStartYear = wraps && md < start ? year - 1 : year;
  const computed = wraps ? `${seasonStartYear}–${String((seasonStartYear + 1) % 100).padStart(2, "0")}` : String(seasonStartYear);
  return league.season_label?.trim() || computed;
}
