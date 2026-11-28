import { supportTopic } from "./supportTopic.ts";
import { appRecoveryPath, recoveryLink } from "../../../../lib/auth/password-recovery.ts";

/** A shared group slug is a navigation hint, never an access credential. */
export function parseGroupInvite(value:unknown):string|null {
  return typeof value==="string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value) ? value : null;
}
export function findInvitedGroup<T extends {slug:string}>(visibleGroups:readonly T[],slug:unknown):T|null {
  const valid=parseGroupInvite(slug);
  return valid ? visibleGroups.find(group=>group.slug===valid) ?? null : null;
}

const host = "hoopcheck.online";
export const canonicalWebOrigin = `https://${host}`;
const safeId = /^[A-Za-z0-9_-]{1,100}$/;

export function nativeDestination(path: string): string {
  try {
    if (path.length > 8192) return "/";
    const isRelative = path.startsWith("/") && !path.startsWith("//");
    let url = new URL(path, canonicalWebOrigin);
    if (!isRelative && url.protocol === "hoopcheck:") {
      if (url.username || url.password || url.port) return "/";
      const nativePath = url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
      url = new URL(`${nativePath}${url.search}${url.hash}`, canonicalWebOrigin);
    }
    if (url.protocol !== "https:" || url.hostname !== host || url.username || url.password || url.port) return "/";
    const parts = url.pathname.split("/").filter(Boolean);
    if (["/account/edit", "/account/security", "/account/career-history", "/account/owner-hq", "/account/ambassador-hq"].includes(url.pathname)) return url.pathname;
    if (url.pathname === "/account/network" || ["/agents", "/creators"].includes(url.pathname)) {
      const kind = url.pathname === "/agents" ? "agents" : url.pathname === "/creators" ? "creators" : url.searchParams.get("kind");
      return "/account/network" + (kind === "agents" || kind === "creators" || kind === "safety" ? "?kind=" + kind : "");
    }
    if (url.pathname === "/owner-hq") return "/account/owner-hq";
    if (url.pathname === "/ambassador-hq") return "/account/ambassador-hq";
    if (parts.length === 3 && parts[0] === "teams" && parts[2] === "review" && safeId.test(parts[1])) return `/teams/${parts[1]}/review`;
    if (url.pathname === "/privacy-center" || url.pathname === "/account/privacy-center") return "/account/privacy-center";
    if (url.pathname === "/support" || url.pathname === "/account/support") {
      const reel = url.searchParams.get("reportReel");
      if (reel && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(reel)) return "/account/support?reportReel=" + reel;
      const topic = supportTopic(url.searchParams.get("topic"))
        ?? (url.searchParams.get("scamAlert") === "1" ? "scam" : null)
        ?? (url.searchParams.get("accountCompromised") === "1" ? "compromised" : null)
        ?? (url.searchParams.get("membershipCancellation") === "1" ? "billing" : null)
        ?? (url.searchParams.get("agentVerification") === "1" ? "verification" : null);
      return "/account/support" + (topic ? "?topic=" + topic : "");
    }
    if (url.pathname === "/privacy" || url.pathname === "/terms" || url.pathname === "/account/policies") {
      const kind = url.pathname === "/terms" || (url.pathname === "/account/policies" && url.searchParams.get("kind") === "terms") ? "terms" : "privacy";
      return "/account/policies?kind=" + kind;
    }
    if (parts[0] === "team-hub" && parts[1] === "groups") {
      if (parts.length === 2) return "/team-hub/groups";
      if (parts.length === 3 && safeId.test(parts[2])) return `/team-hub/groups/${parts[2]}`;
    }
    if (url.pathname === "/") return "/";
    if (url.pathname === "/pre-sign") return "/pre-sign";
    if (url.pathname === "/copyright") return "/account/support?topic=copyright";
    if (url.pathname === "/company") return "/about";
    if (url.pathname === "/community-guidelines") return "/legal?document=community-guidelines";
    if (url.pathname === "/legal") {
      const doc=url.searchParams.get("document");
      return "/legal?document="+(doc==="terms"||doc==="community-guidelines"?doc:"privacy");
    }
    if (url.pathname === "/login" && !url.search && !url.hash) return "/sign-in";
    if (url.pathname === "/signup" && !url.search && !url.hash) return "/sign-up";
    if (url.pathname === "/feed/welcome") return "/feed-welcome";
    if (parts.length === 3 && parts[0] === "womens" && parts[1] === "teams" && safeId.test(parts[2])) return `/womens/${parts[2]}`;
    if (parts.length === 3 && parts[0] === "womens" && parts[1] === "leagues" && safeId.test(parts[2])) return `/womens/leagues/${parts[2]}`;
    if (parts.length === 2 && ["teams", "womens", "leagues", "players", "coaches"].includes(parts[0]) && safeId.test(parts[1])) return `/${parts[0]}/${parts[1]}`;
    if (url.pathname === "/messages") {
      const thread=url.searchParams.getAll("thread");const id=thread.length===1&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(thread[0])?thread[0].toLowerCase():null;
      return "/messages"+(id?"?thread="+id:"");
    }
    if (parts.length === 1 && ["account", "teams", "womens", "leagues", "players", "coaches", "dashboard", "settings", "membership", "messages", "feed-welcome", "about", "sign-in", "sign-up", "forgot-password", "choose-username"].includes(parts[0])) return url.pathname;
    if (url.pathname === "/feed" || url.pathname === "/fan-feed") {
      const post = url.searchParams.get("post") || /^#post-([0-9a-f-]{36})$/i.exec(url.hash)?.[1];
      return "/feed" + (post && /^[0-9a-f-]{36}$/i.test(post) ? `?post=${post}` : "");
    }
    if (url.pathname === "/fan-live" || url.pathname === "/live-games") {
      const query = new URLSearchParams();
      const id = url.searchParams.get("gameId"), side = url.searchParams.get("side");
      if (id && /^[0-9a-f-]{36}$/i.test(id)) query.set("gameId",id);
      if (side === "mens" || side === "womens") query.set("side",side);
      const suffix = query.toString();
      return "/fan-live" + (suffix ? "?" + suffix : "");
    }
    if (url.pathname === "/notifications") {
      const tab = url.searchParams.get("tab");
      return "/notifications" + (tab === "chat" || tab === "requests" || tab === "activity" ? "?tab=" + tab : "");
    }
    if (url.pathname === "/connections") return "/connections";
    if (url.pathname === "/reels") return "/reels";
    if (url.pathname === "/hoopgroups") {
      for(const field of ["invitation","channel"]){const values=url.searchParams.getAll(field);if(values.length===1&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(values[0]))return "/hoopgroups?"+field+"="+values[0].toLowerCase();}
      const slug = parseGroupInvite(url.searchParams.get("group"));
      return "/hoopgroups" + (slug ? `?group=${encodeURIComponent(slug)}` : "");
    }
    if (url.pathname === "/search") {
      const query = new URLSearchParams();
      const term = url.searchParams.get("q");
      if (term) query.set("q", term.slice(0, 100));
      const serialized = query.toString();
      return "/search" + (serialized ? `?${serialized}` : "");
    }

    if (url.pathname === "/reset-password" || url.pathname === appRecoveryPath) {
      const fragment = new URLSearchParams(url.hash.slice(1));
      const link = recoveryLink(url.searchParams, fragment);
      if (link?.token) return `/reset-password?token_hash=${link.token}&type=recovery`;
      if (link?.code && url.pathname === "/reset-password") return `/reset-password?code=${link.code}`;
      return url.search || url.hash ? "/reset-password?error_code=invalid_link" : "/reset-password";
    }
    if (url.pathname === "/auth/callback") {
      // Re-encode only the PKCE/error fields understood by native auth screens.
      // Invalid percent sequences must not reach the router's legacy decoder.
      const query = new URLSearchParams();
      const code = url.searchParams.get("code");
      if (code && code.length <= 2048 && url.searchParams.getAll("code").length === 1) query.set("code", code);
      const fragment = new URLSearchParams(url.hash.slice(1));
      for (const field of ["error", "error_description", "error_code"]) {
        const value = url.searchParams.get(field) ?? fragment.get(field);
        if (value) query.set(field, value.slice(0, 512));
      }
      const serialized = query.toString();
      return url.pathname + (serialized ? `?${serialized}` : "");
    }
    return "/link-unavailable";
  } catch { return "/"; }
}
