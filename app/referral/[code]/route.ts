import { NextRequest, NextResponse } from "next/server";
import { ambassadorDb, referralCookie } from "../../../lib/ambassador/server";

import { referralCodePattern } from "../../../lib/ambassador/identifiers";

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const code = (await context.params).code.toUpperCase();
  const signupUrl = new URL("/signup", request.url);

  // Prefetch is not a visitor action. Never consume a referral or clear its cookie.
  if (request.headers.has("next-router-prefetch") || request.headers.get("sec-purpose")?.includes("prefetch")) {
    const prefetchResponse = NextResponse.redirect(signupUrl);
    prefetchResponse.headers.set("Cache-Control", "private, no-store");
    return prefetchResponse;
  }

  // A paused, expired, invalid, or unreachable campaign must not silently
  // produce an uncredited signup. Clear any earlier referral cookie too.
  const unavailable = () => {
    const destination = new URL("/signup?referral=unavailable", request.url);
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "private, no-store");
    response.cookies.delete(referralCookie);
    return response;
  };

  if (!referralCodePattern.test(code) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return unavailable();
  }

  // Every explicit valid visit gets a fresh, single-use token, not a stale cookie.
  const { data, error } = await ambassadorDb().rpc("ambassador_open_referral", { p_code: code });
  if (error) console.error("Ambassador referral lookup failed", error.code);
  if (error || typeof data !== "string") return unavailable();

  const response = NextResponse.redirect(signupUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(referralCookie, data, {
    maxAge: 30 * 60, httpOnly: true, path: "/", sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}
