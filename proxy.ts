import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const userId = typeof data.claims.sub === "string" ? data.claims.sub : null;
  if (userId) {
    const [{ data: profile }, { data: preferences }] = await Promise.all([
      supabase.from("profiles").select("preferred_language").eq("id", userId).maybeSingle(),
      supabase.from("user_preferences").select("language").eq("user_id", userId).maybeSingle(),
    ]);
    const language = profile?.preferred_language || preferences?.language;
    const supported = ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar"];
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
    "/search/:path*",
    "/players/:path*",
    "/coaches/:path*",
    "/teams/:path*",
    "/leagues/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/feed/:path*",
    "/admin/:path*",
  ],
};
