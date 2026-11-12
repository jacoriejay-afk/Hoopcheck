/** LIVECHAT-1: country > league > game presentation model.
 * Feed only fixtures approved by the server-side SEASON-1 resolver.
 * Do not use this client-side grouping as an authorization or season gate.
 */
export type LiveChatGame = {
  id: string;
  country: string | null;
  league_name: string | null;
  status: string;
  scheduled_at: string | null;
};
export type LiveChatLeagueGroup<T extends LiveChatGame> = { name: string; games: T[] };
export type LiveChatCountryGroup<T extends LiveChatGame> = { name: string; leagues: LiveChatLeagueGroup<T>[] };
const LIVE = new Set(["live", "in_progress"]);
const UPCOMING = new Set(["scheduled", "upcoming"]);
const safeName = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;
function gameSort<T extends LiveChatGame>(a: T, b: T): number {
  const rank = (status: string) => LIVE.has(status.toLowerCase()) ? 0 : UPCOMING.has(status.toLowerCase()) ? 1 : 2;
  const difference = rank(a.status) - rank(b.status);
  if (difference) return difference;
  const aTime = a.scheduled_at ? Date.parse(a.scheduled_at) : NaN;
  const bTime = b.scheduled_at ? Date.parse(b.scheduled_at) : NaN;
  return (Number.isFinite(aTime) ? aTime : Infinity) - (Number.isFinite(bTime) ? bTime : Infinity) || a.id.localeCompare(b.id);
}
/** countryOrder must come from the same canonical ordering used by /teams. */
export function groupLiveChatGames<T extends LiveChatGame>(
  games: readonly T[],
  countryOrder: readonly string[] = [],
  search = "",
): LiveChatCountryGroup<T>[] {
  const countries = new Map<string, Map<string, T[]>>();
  const filter = search.trim().toLocaleLowerCase();
  for (const game of games) {
    const country = safeName(game.country, "Other countries");
    const league = safeName(game.league_name, "Other leagues");
    if (filter && !country.toLocaleLowerCase().includes(filter) && !league.toLocaleLowerCase().includes(filter)) continue;
    if (!countries.has(country)) countries.set(country, new Map());
    const leagues = countries.get(country)!;
    if (!leagues.has(league)) leagues.set(league, []);
    leagues.get(league)!.push(game);
  }
  const order = new Map(countryOrder.map((name, index) => [name.toLocaleLowerCase(), index]));
  return [...countries.entries()].sort(([a], [b]) =>
    (order.get(a.toLocaleLowerCase()) ?? Infinity) - (order.get(b.toLocaleLowerCase()) ?? Infinity) ||
    a.localeCompare(b)
  ).map(([name, leagues]) => ({
    name,
    leagues: [...leagues.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([leagueName, fixtures]) => ({ name: leagueName, games: fixtures.slice().sort(gameSort) })),
  }));
}
