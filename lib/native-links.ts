/**
 * Canonical HoopCheck URLs used by native deep links and share actions.
 *
 * Keep this module dependency-free so the web app continues to build before
 * Capacitor platform packages are installed. A native bridge can call these
 * helpers; URL validation is not an authentication or authorization check.
 */
export const HOOPCHECK_ORIGIN = "https://hoopcheck.online";

const ALLOWED_PATHS = [
  /^\/teams\/[^/]+\/?$/,
  /^\/players\/[^/]+\/?$/,
  /^\/womens\/[^/]+\/?$/,
  /^\/coaches\/[^/]+\/?$/,
  /^\/leagues\/[^/]+\/?$/,
];

export function canonicalHoopCheckUrl(input: string | URL): URL | null {
  try {
    const url = input instanceof URL ? new URL(input.href) : new URL(input, HOOPCHECK_ORIGIN);
    if (url.protocol !== "https:" || url.origin !== HOOPCHECK_ORIGIN) return null;
    if (!ALLOWED_PATHS.some((path) => path.test(url.pathname))) return null;
    // Fragments are not needed for entity links and may be used to confuse
    // route comparisons between native and web entry points.
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function getShareableEntityUrl(path: string): string | null {
  const url = canonicalHoopCheckUrl(path);
  return url?.href ?? null;
}

export type ShareResult = "shared" | "copied" | "unsupported" | "failed";

/**
 * Uses the browser/OS share sheet where Web Share is available, then clipboard
 * as a fallback. Capacitor native Share plugin can be wired here once installed.
 */
export async function shareHoopCheckEntity(input: {
  url: string;
  title: string;
  text?: string;
}): Promise<ShareResult> {
  const url = canonicalHoopCheckUrl(input.url);
  if (!url) return "failed";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: input.title, text: input.text, url: url.href });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "failed";
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url.href);
      return "copied";
    } catch {
      return "failed";
    }
  }

  return "unsupported";
}
