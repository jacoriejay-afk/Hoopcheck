let pending: string | null = null;

export function rememberDestination(path: string) {
  const pathname = path.split(/[?#]/)[0];
  if (/^\/(team-hub\/groups|fan-live|notifications|feed|fan-feed|reels|account|search|teams|womens|leagues|players)(\/|$)/.test(pathname)) pending = path;
}
export function takeDestination(): string | null {
  const path = pending;
  pending = null;
  return path;
}
