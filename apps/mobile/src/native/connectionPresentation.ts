export type PublicConnection = { target_type: "team" | "fan" | "player"; target_id: string; id: string | null; display_name: string | null; account_type: string | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Same public-list projection and fan filtering as app/connections/page.tsx. */
export function visibleConnections(input: unknown, accountType: string): PublicConnection[] {
  if (!Array.isArray(input)) throw new Error("Connections unavailable");
  return input.filter((row): row is PublicConnection => Boolean(row && typeof row === "object" && typeof row.target_id === "string" && uuid.test(row.target_id) && ["team", "fan", "player"].includes(row.target_type) && (accountType !== "fan" || ["team", "fan"].includes(row.target_type)))).map(row => ({ target_type: row.target_type, target_id: row.target_id, id: typeof row.id === "string" && uuid.test(row.id) ? row.id : null, display_name: typeof row.display_name === "string" ? row.display_name.slice(0, 200) : null, account_type: typeof row.account_type === "string" ? row.account_type : null }));
}
export function connectionPath(row: PublicConnection, viewerType: string): string | null {
  if (row.target_type === "team") return `/teams/${row.target_id}`;
  if (row.target_type === "fan") return `/fans/${row.id || row.target_id}`;
  if (viewerType !== "fan" && row.target_type === "player" && row.account_type === "player") return `/players/${row.id || row.target_id}`;
  return null;
}
