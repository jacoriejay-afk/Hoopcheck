/** Discovery only: caller supplies existing viewer-visible group rows. No additional reads or access grants. */
export type DiscoverableGroup = { id: string; category: string; owner_id: string | null; name: string };
export function groupCategoryForRole(role: string): string | null {
  switch (role.trim().toLowerCase()) {
    case "player": return "players";
    case "fan": return "fans";
    case "coach": return "coaches";
    case "agent": case "scout": return "agents";
    default: return null;
  }
}
export function orderGroupsForRole<T extends DiscoverableGroup>(groups: readonly T[], role: string): T[] {
  const category = groupCategoryForRole(role);
  return [...groups].sort((a,b) => Number(category !== null && b.category === category) -
    Number(category !== null && a.category === category) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function recommendedGroupIds(groups: readonly DiscoverableGroup[], role: string, viewerId: string, memberships: readonly string[]): Set<string> {
  const category = groupCategoryForRole(role);
  if (!category || !viewerId) return new Set();
  const joined = new Set(memberships);
  return new Set(groups.filter(group => group.category === category && group.owner_id !== viewerId && !joined.has(group.id)).map(group=>group.id));
}
