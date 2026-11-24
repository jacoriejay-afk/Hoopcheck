export type CareerRecord = { id: string; team_name: string; country: string; seasons: string };
/** Summary of returned, authorized records only; not inferred game statistics or awards. */
export function summarizeCareer(rows: CareerRecord[]) {
  const distinct = [...new Map(rows.map(row => [row.id, row])).values()];
  const key = (value: string) => value.trim().toLocaleLowerCase();
  return { stops: distinct.length, teams: new Set(distinct.map(row => key(row.team_name)).filter(Boolean)).size, countries: new Set(distinct.map(row => key(row.country)).filter(Boolean)).size };
}
