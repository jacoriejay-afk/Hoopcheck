/** A shared group slug is a navigation hint, never an access credential. */
export function parseGroupInvite(value:unknown):string|null {
  return typeof value==="string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value) ? value : null;
}
export function findInvitedGroup<T extends {slug:string}>(visibleGroups:readonly T[],slug:unknown):T|null {
  const valid=parseGroupInvite(slug);
  return valid ? visibleGroups.find(group=>group.slug===valid) ?? null : null;
}
