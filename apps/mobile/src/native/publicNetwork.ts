export type NetworkKind = "agents" | "creators";
export type NetworkEntry = { id: string; name: string; country: string; headline: string; agency: string; description: string; category: string; identityChecked: boolean; professionallyReviewed: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export const creatorCategories: Record<string, string> = { media: "Media", podcast: "Podcaster", trainer: "Trainer", photographer: "Photographer", analyst: "Analyst", other: "Creator" };
export function parsePublicNetwork(input: unknown, kind: NetworkKind): NetworkEntry[] {
  const payload = record(input);
  const list = kind === "agents" ? payload?.people : payload?.creators;
  if (!Array.isArray(list) || list.length > 200) throw new Error("Invalid directory response");
  const seen = new Set<string>();
  return list.map(raw => {
    const row = record(raw);
    if (!row) throw new Error("Invalid directory profile");
    const profile = kind === "agents" ? row : record(row.profiles);
    const id = kind === "agents" ? row.id : row.profile_id;
    if (!profile || typeof id !== "string" || !uuid.test(id) || profile.id !== id || seen.has(id)) throw new Error("Invalid directory identity");
    seen.add(id);
    const category = kind === "agents" ? text(row.account_type, 30) : text(row.category, 30);
    if (kind === "agents" && !["agent", "scout"].includes(category)) throw new Error("Invalid professional role");
    if (kind === "creators" && !Object.prototype.hasOwnProperty.call(creatorCategories, category)) throw new Error("Invalid creator category");
    const name = text(profile.display_name, 120);
    if (!name) throw new Error("Invalid directory name");
    return { id, name, country: text(profile.country, 100), headline: text(kind === "agents" ? row.experience_summary : row.headline, 200), agency: kind === "agents" ? text(row.agency_name, 160) : "",
      description: text(kind === "agents" ? row.bio : row.description, 1000), category,
      identityChecked: kind === "agents" && row.identity_checked === true, professionallyReviewed: kind === "agents" && row.professionally_reviewed === true };
  });
}
export function filterPublicNetwork(entries: NetworkEntry[], query: string, category: string) {
  const term = query.trim().toLowerCase().slice(0, 100);
  return entries.filter(row => (category === "all" || (category === "reviewed" ? row.professionallyReviewed : row.category === category)) &&
    (!term || [row.name, row.country, row.headline, row.agency, row.description, row.category, creatorCategories[row.category] || ""].some(value => value.toLowerCase().includes(term))));
}
export async function readPublicNetwork(origin: string, kind: NetworkKind, signal?: AbortSignal, request: typeof fetch = fetch) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !["agents", "creators"].includes(kind)) throw new Error("Invalid directory request");
  url.pathname = "/api/network/" + kind;
  const response = await request(url.toString(), { method: "GET", cache: "no-store", redirect: "error", signal, credentials: "omit" });
  if (!response.ok) throw new Error("Directory temporarily unavailable");
  return parsePublicNetwork(await response.json(), kind);
}
