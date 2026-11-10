import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_SIGNUP_COOKIE, GOOGLE_SIGNUP_PATH, GOOGLE_SIGNUP_ROLE } from "./lib/google-auth";

const protectedPage = /^\/(?:dashboard|settings|profile|feed|admin)(?:\/|$)|^\/(?:teams|coaches|leagues)\/[^/]+\/review\/?$/;
const pendingAllowed = new Set([GOOGLE_SIGNUP_PATH, "/auth/callback", "/login", "/terms", "/privacy", "/community-guidelines"]);

function isPendingBearer(header: string | null) {
  // An unverified payload can only trigger a denial. API handlers still verify
  // credentials before granting access.
  const payload = header?.trim().match(/^(?:Bearer\s+)?[\w-]+\.([\w-]+)\.[\w-]+$/i)?.[1];
  if (!payload) return false;
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role === GOOGLE_SIGNUP_ROLE;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) {
    if (isPendingBearer(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Finish setting up your HoopCheck account first." }, { status: 403 });
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const needsSession = protectedPage.test(path);
  const hasSetupCookie = request.cookies.has(GOOGLE_SIGNUP_COOKIE);
  if (!needsSession && (!hasSetupCookie || path === "/auth/callback")) return supabaseResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // CI-only visual regression uses a synthetic session and mocked Supabase endpoints.
  // The invalid CI URL guard ensures this can never disable auth for a real project.
  if (process.env.HOOPCHECK_THEME_TEST_MODE === "true" && process.env.NEXT_PUBLIC_SUPABASE_URL === "https://ci.invalid") {
    return supabaseResponse;
  }

  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.role === GOOGLE_SIGNUP_ROLE) {
    if (pendingAllowed.has(path)) return supabaseResponse;
    const response = NextResponse.redirect(new URL(GOOGLE_SIGNUP_PATH, request.url));
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie);
    return response;
  }

  if (hasSetupCookie) supabaseResponse.cookies.delete(GOOGLE_SIGNUP_COOKIE);
  if (!needsSession) return supabaseResponse;

  if (!data?.claims) {
    const url = request.nextUrl.clone();
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("returnTo", returnTo);
    const response = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie);
    return response;
  }

  const userId = typeof data.claims.sub === "string" ? data.claims.sub : null;
  if (userId) {
    const [{ data: profile }, { data: preferences }] = await Promise.all([
      supabase.from("profiles").select("preferred_language").eq("id", userId).maybeSingle(),
      supabase.from("user_preferences").select("language").eq("user_id", userId).maybeSingle(),
    ]);
    const language = profile?.preferred_language || preferences?.language;
    const supported = ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar", "ru", "az", "pl", "zh", "ja", "sr", "fi", "he", "lt", "uk"];
    if (typeof language === "string" && supported.includes(language) && request.cookies.get("hoopcheck-language")?.value !== language) {
      const responseCookies = supabaseResponse.cookies.getAll();
      request.cookies.set("hoopcheck-language", language);
      supabaseResponse = NextResponse.next({ request });
      responseCookies.forEach(({ name, value, ...options }) => supabaseResponse.cookies.set(name, value, options));
      supabaseResponse.cookies.set("hoopcheck-language", language, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        httpOnly: false,
      });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/teams/:id/review",
    "/coaches/:id/review",
    "/leagues/:id/review",
    "/dashboard/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/feed/:path*",
    "/admin/:path*",
    "/api/:path*",
    { source: "/((?!_next|api/|.*\\..*).*)", has: [{ type: "cookie", key: "hoopcheck-google-setup" }] },
  ],
};
