let pending: string | null = null;
export function rememberDestination(path: string) {
  if (path.length > 8192 || !path.startsWith("/") || path.startsWith("//")) return;
  try {
    const url = new URL(path, "https://hoopcheck.online");
    if (url.origin !== "https://hoopcheck.online" || url.username || url.password) return;
    const root = /^\/(fan-live|notifications|hoopgroups|connections|feed|fan-feed|feed-welcome|reels|account|search|teams|womens|leagues|players|coaches|dashboard|settings|membership|messages|choose-username)$/;
    const account = /^\/account\/(edit|security|support|career-history|network|owner-hq|ambassador-hq|policies|privacy-center)$/;
    const entity = /^\/(teams|womens|leagues|players|coaches)\/[A-Za-z0-9_-]{1,100}$/;
    const nested = /^\/(?:team-hub\/groups(?:\/[A-Za-z0-9_-]{1,100})?|womens\/leagues\/[A-Za-z0-9_-]{1,100}|teams\/[A-Za-z0-9_-]{1,100}\/review)$/;
    if (![root,account,entity,nested].some(pattern=>pattern.test(url.pathname))) return;
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
    if (url.pathname === "/account/support" && url.searchParams.get("topic")==="scam") query.set("topic","scam");
    if (url.pathname === "/account/support") {
      const reel=url.searchParams.get("reportReel"); if(reel&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(reel)) query.set("reportReel",reel);
    }
    if (url.pathname === "/account/policies") {
      const kind=url.searchParams.get("kind"); if(kind==="privacy"||kind==="terms")query.set("kind",kind);
    }
    if (url.pathname === "/account/network") {
      const kind=url.searchParams.get("kind"); if(kind==="agents"||kind==="creators"||kind==="safety")query.set("kind",kind);
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
