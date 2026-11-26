/** Only public canonical directory paths, never arbitrary or signed URLs. */
export type PublicDirectoryKind = "teams" | "womens" | "leagues";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function publicDirectoryShare(kind: PublicDirectoryKind, id: string, name: string) {
  if (!["teams", "womens", "leagues"].includes(kind) || typeof id !== "string" || !uuid.test(id) || typeof name !== "string") return null;
  const title = name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  if (!title) return null;
  return {title, message: title + "\nhttps://hoopcheck.online/" + kind + "/" + id.toLowerCase()};
}
