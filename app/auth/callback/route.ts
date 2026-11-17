import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_SIGNUP_COOKIE, GOOGLE_SIGNUP_PATH, GOOGLE_SIGNUP_ROLE } from "../../../lib/google-auth";
import { ambassadorDb, getActiveReferral, referralCookie } from "../../../lib/ambassador/server";
import { createAuthClient } from "../../../lib/server/supabase-auth";

export async function GET(request: NextRequest) {
  const login = new URL("/login", request.url);
  const code = request.nextUrl.searchParams.get("code");
  const failure = request.nextUrl.searchParams.get("error_code") || request.nextUrl.searchParams.get("error");
  if (failure || !code) {
    login.searchParams.set("google_error", failure || "failed");
    return NextResponse.redirect(login);
  }

  const supabase = await createAuthClient(true);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    login.searchParams.set("google_error", error?.code || "failed");
    return NextResponse.redirect(login);
  }

  const { data: auth } = await supabase.auth.getClaims(data.session.access_token);
  if (!auth?.claims) {
    await supabase.auth.signOut({ scope: "local" });
    login.searchParams.set("google_error", "failed");
    return NextResponse.redirect(login);
  }

  if (auth.claims.role === GOOGLE_SIGNUP_ROLE) {
    const response = NextResponse.redirect(new URL(GOOGLE_SIGNUP_PATH, request.url));
    response.cookies.set(GOOGLE_SIGNUP_COOKIE, "1", {
      httpOnly: true, path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:",
    });
    const referral = await getActiveReferral();
    if (referral) {
      const { error } = await ambassadorDb().rpc("ambassador_capture_google", {
        p_user: data.session.user.id, p_token: referral,
      });
      if (error) {
        console.error("Ambassador Google attribution could not be saved", error.code);
      } else {
        response.cookies.delete(referralCookie);
      }
    }
    return response;
  }

  const { data: profile } = await supabase.from("profiles")
    .select("id").eq("id", auth.claims.sub).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    login.searchParams.set("google_error", "failed");
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
