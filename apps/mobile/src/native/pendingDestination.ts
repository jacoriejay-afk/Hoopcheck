let pending: string | null = null;

export function rememberDestination(path: string) {
  if (/^\/(account|teams|womens|leagues|players)(\/|$)/.test(path)) pending = path;

}
export function takeDestination(): string | null {
  const path = pending;
  pending = null;
  return path;
}
