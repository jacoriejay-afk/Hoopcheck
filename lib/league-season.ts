/**
 * Canonical recurring season resolver. All callers must supply a league-local
 * calendar date (YYYY-MM-DD), computed on the server in the league timezone.
 */
export type LeagueSeasonWindow = {
  season_start_month: number;
  season_start_day: number;
  season_end_month: number;
  season_end_day: number;
  season_label?: string | null;
};
const md = (month: number, day: number) => month * 100 + day;
const daysInMonth = (month: number) => new Date(Date.UTC(2024, month, 0)).getUTCDate();
function valid(month: number, day: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12 &&
    Number.isInteger(day) && day >= 1 && day <= daysInMonth(month);
}
function leapBoundary(month: number, day: number, year: number): number {
  const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
  return md(month, month === 2 && day === 29 && !leap ? 28 : day);
}
function parts(date: Date | string): { year: number; md: number } {
  if (typeof date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Expected YYYY-MM-DD");
    const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7)), day = Number(date.slice(8, 10));
    if (!valid(month, day) || new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) throw new Error("Invalid date");
    return { year, md: md(month, day) };
  }
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return { year: date.getUTCFullYear(), md: md(date.getUTCMonth() + 1, date.getUTCDate()) };
}
function bounds(league: LeagueSeasonWindow, year: number) {
  const sm = league.season_start_month, sd = league.season_start_day;
  const em = league.season_end_month, ed = league.season_end_day;
  if (!valid(sm, sd) || !valid(em, ed)) throw new Error("Invalid season window");
  if (md(sm, sd) === md(em, ed)) throw new Error("Season start and end must differ");
  return { start: leapBoundary(sm, sd, year), end: leapBoundary(em, ed, year), wraps: md(sm, sd) > md(em, ed) };
}
export function isLeagueInSeason(league: LeagueSeasonWindow, date: Date | string): boolean {
  const { year, md: day } = parts(date);
  const { start, end, wraps } = bounds(league, year);
  return wraps ? day >= start || day <= end : day >= start && day <= end;
}
/** Season whose roster is currently shown, or most recently completed season off-season. */
export function currentSeasonLabel(league: LeagueSeasonWindow, date: Date | string): string {
  const { year, md: day } = parts(date);
  const { start, end, wraps } = bounds(league, year);
  const startYear = wraps
    ? (day >= start ? year : year - 1)
    : (day < start ? year - 1 : year);
  const computed = wraps ? `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}` : String(startYear);
  // Stored labels are only trustworthy for their explicitly configured season;
  // use the computed label after a year rollover instead of displaying stale labels.
  const stored = league.season_label?.trim();
  if (!stored) return computed;
  const normalized = stored.replace(/-/g, "–");
  return normalized.includes(String(startYear)) ? stored : computed;
}
export function leagueSeasonStartMonth(league: LeagueSeasonWindow): string {
  if (!valid(league.season_start_month, league.season_start_day)) throw new Error("Invalid season start");
  return new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, league.season_start_month - 1, 1))
  );
}
