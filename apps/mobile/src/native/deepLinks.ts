const host = "hoopcheck.online";
const safeId = /^[A-Za-z0-9_-]{1,100}$/;

export function nativeDestination(path: string): string {
  try {
    if (path.length > 8192) return "/";
    const isRelative = path.startsWith("/") && !path.startsWith("//");
    let url = new URL(path, `https://${host}`);
    if (!isRelative && url.protocol === "hoopcheck:") {
      if (url.username || url.password || url.port) return "/";
      const nativePath = url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
      url = new URL(`${nativePath}${url.search}${url.hash}`, `https://${host}`);
    }
    if (url.protocol !== "https:" || url.hostname !== host || url.username || url.password || url.port) return "/";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 3 && parts[0] === "womens" && parts[1] === "leagues" && safeId.test(parts[2])) return `/womens/leagues/${parts[2]}`;
    if (parts.length === 2 && ["teams", "womens", "leagues", "players"].includes(parts[0]) && safeId.test(parts[1])) return `/${parts[0]}/${parts[1]}`;
    if (parts.length === 1 && ["teams", "womens", "leagues", "players", "coaches", "dashboard", "settings"].includes(parts[0])) return url.pathname;
    if (url.pathname === "/auth/callback" || url.pathname === "/reset-password") {
      // Re-encode only the PKCE/error fields understood by native auth screens.
      // Invalid percent sequences must not reach the router's legacy decoder.
      const query = new URLSearchParams();
      const code = url.searchParams.get("code");
      if (code && code.length <= 2048) query.set("code", code);
      for (const field of ["error", "error_description", "error_code"]) {
        const value = url.searchParams.get(field);
        if (value) query.set(field, value.slice(0, 512));
      }
      const serialized = query.toString();
      return url.pathname + (serialized ? `?${serialized}` : "");
    }

    if (["r", "referral"].includes(parts[0]) && parts.length === 2 && /^[A-Za-z0-9_-]{4,40}$/.test(parts[1])) {
      // Reuse the server-issued, httpOnly referral cookie and existing web signup.
      // No client-side attribution claim or user_metadata authorization is introduced.
      return `/web?path=${encodeURIComponent(`/referral/${parts[1].toUpperCase()}`)}`;
    }
    // No pretend native post/group route: keep the actual canonical web path.
    return `/web?path=${encodeURIComponent(url.pathname + url.search + url.hash)}`;
  } catch { return "/"; }
}

export function canonicalWebUrl(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  try {
    const url = new URL(path, `https://${host}`);
    return url.origin === `https://${host}` ? url.toString() : null;
  } catch { return null; }
}
