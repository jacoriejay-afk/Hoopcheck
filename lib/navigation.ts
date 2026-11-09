export type NavigationLink = { href: string; label: string };

/** Discoverability only. Destination pages, APIs and RLS retain authorization. */
export function getRoleNavigation(accountType: string | null, signedIn: boolean) {
  const fan = accountType === 'fan';
  const professional = accountType === 'agent' || accountType === 'scout';
  const team = accountType === 'manager' || accountType === 'admin';
  const player = accountType === 'player';
  const workspace: NavigationLink = !signedIn ? { href: '/', label: 'Home' }
    : fan ? { href: '/team-hub', label: 'Fan HQ' }
    : professional ? { href: '/agents-hq', label: 'Agents HQ' }
    : team ? { href: '/team-dashboard', label: 'Team HQ' }
    : { href: '/dashboard', label: 'Home' };
  const feed: NavigationLink | null = fan ? { href: '/fan-feed', label: 'Fan Feed' }
    : player || professional ? { href: '/feed', label: 'HoopFeed' } : null;
  const live: NavigationLink | null = fan ? { href: '/fan-live', label: 'Live Games' }
    : player ? { href: '/live-games', label: 'Live Games' } : null;
  const tools: NavigationLink[] = fan ? [{ href: '/fans', label: 'Find Fans' }]
    : professional ? [{ href: '/connections', label: 'Connections' }]
    : player ? [{ href: '/connections', label: 'Connections' }, { href: '/pre-sign', label: 'Pre-Sign Check' }, { href: '/verification', label: 'Verification' }]
    : accountType === 'coach' ? [{ href: '/coach-placement', label: 'Coach Placement' }, { href: '/team-dashboard', label: 'Manage Team' }, { href: '/verification', label: 'Verification' }] : [];
  return { workspace, feed, live, tools };
}
