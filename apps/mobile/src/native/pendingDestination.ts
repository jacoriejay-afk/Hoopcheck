let pending: string | null = null;
export function rememberDestination(path: string) {
  if (path.length > 8192 || !path.startsWith("/") || path.startsWith("//")) return;
  try {
    const url = new URL(path, "https://hoopcheck.online");
    if (url.origin !== "https://hoopcheck.online" || !/^\/(team-hub\/groups|fan-live|notifications|hoopgroups|connections|feed|fan-feed|reels|account|search|teams|womens|leagues|players|coaches|dashboard|settings|membership)(\/|$)/.test(url.pathname)) return;
    const query = new URLSearchParams();
    if (["/feed", "/fan-feed"].includes(url.pathname)) {
      const post = url.searchParams.get("post"); if (post && /^[0-9a-f-]{36}$/i.test(post)) query.set("post", post);
    }
    if (url.pathname === "/fan-live") {
      const game = url.searchParams.get("gameId"); if (game && /^[0-9a-f-]{36}$/i.test(game)) query.set("gameId", game);
      const side=url.searchParams.get("side"); if(side==="mens"||side==="womens")query.set("side",side);
    }
    if (url.pathname === "/hoopgroups") {
      const group=url.searchParams.get("group"); if(group&&/^[a-z0-9][a-z0-9-]{0,59}$/.test(group))query.set("group",group);
    }
    if (url.pathname === "/notifications") {
      const tab=url.searchParams.get("tab"); if(tab==="activity"||tab==="chat"||tab==="requests")query.set("tab",tab);
    }
    if (url.pathname === "/search") {
      const term = url.searchParams.get("q"); if (term) query.set("q", term.slice(0, 100));
    }
    const suffix = query.toString();
    pending = url.pathname + (suffix ? `?${suffix}` : "");
  } catch { /* Untrusted links cannot retain credentials or affect sign-in. */ }
}
export function takeDestination(): string | null {
  const path = pending;
  pending = null;
  return path;
}
