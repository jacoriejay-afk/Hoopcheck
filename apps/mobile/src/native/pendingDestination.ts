let pending: string | null = null;

export function rememberDestination(path: string) {
  if (/^\/(account|search|teams|womens|leagues|players)(\/|$)/.test(path.split(/[?#]/)[0])) pending = path;


}
export function takeDestination(): string | null {
  const path = pending;
  pending = null;
  return path;
}
