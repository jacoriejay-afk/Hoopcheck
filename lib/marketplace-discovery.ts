/** Filters only records already returned by the existing consent-aware directory. */
export function availablePlayerMatches<T extends {free_agent?: boolean | null}>(rows: readonly T[], onlyAvailable: boolean): T[] {
  return onlyAvailable ? rows.filter(row => row.free_agent === true) : [...rows];
}
export type ProfessionalScope = "all" | "agent" | "scout" | "verified" | "identity";
type Showcase = {account_type: "agent" | "scout"; professionally_reviewed: boolean; identity_checked: boolean; display_name?: string | null; username?: string | null; country?: string | null; bio?: string | null; experience_summary?: string | null; agency_name?: string | null};
export function filterProfessionalShowcases<T extends Showcase>(rows: readonly T[], scope: ProfessionalScope, query: string): T[] {
  const term = query.trim().toLowerCase();
  return rows.filter(row => {
    const matchesScope = scope === "all" || scope === "verified" && row.professionally_reviewed === true ||
      scope === "identity" && row.identity_checked === true || row.account_type === scope;
    return matchesScope && (!term || [row.display_name,row.username,row.country,row.bio,row.experience_summary,row.agency_name].some(value => value?.toLowerCase().includes(term)));
  });
}
