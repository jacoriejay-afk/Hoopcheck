/** Shared input normalization. This never grants affiliation or review eligibility. */
export type CareerSeason = { startYear: number; endYear: number; label: string };
export function parseCareerSeason(input: unknown, nowYear: number): CareerSeason | null {
 if (typeof input !== "string" || input.length > 24 || !Number.isInteger(nowYear)) return null;
 const match = input.trim().match(/^(\d{4})(?:\s*[-–—/]\s*(\d{2}|\d{4}))?$/);
 if (!match) return null;
 const startYear = Number(match[1]);
 if (startYear < 1900 || startYear > Math.min(nowYear, 2200)) return null;
 let endYear = match[2] ? Number(match[2]) : startYear;
 if (match[2]?.length === 2) {
   endYear += Math.floor(startYear / 100) * 100;
   if (endYear < startYear) endYear += 100;
 }
 // An explicit range must represent consecutive years, not a multi-season claim.
 if (match[2] ? endYear !== startYear + 1 : endYear !== startYear) return null;
 return { startYear, endYear, label: startYear === endYear ? String(startYear) : startYear + "-" + endYear };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type CareerTeamSelection = { id: string; source: "teams" | "womens_teams" };
export function careerClaimTarget(selection: CareerTeamSelection) {
 if (!selection || typeof selection.id !== "string" || !uuid.test(selection.id)) return null;
 if (selection.source === "teams") return { team_id: selection.id, womens_team_id: null };
 if (selection.source === "womens_teams") return { team_id: null, womens_team_id: selection.id };
 return null;
}
