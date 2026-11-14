import { NextRequest, NextResponse } from "next/server";
import { ambassadorDb, getActiveReferral, referralCookie } from "../../../lib/ambassador/server";

import { referralCodePattern } from "../../../lib/ambassador/identifiers";

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const code = (await context.params).code.toUpperCase();
  const response = NextResponse.redirect(new URL("/signup", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  if (!referralCodePattern.test(code) || await getActiveReferral() ||
      request.headers.has("next-router-prefetch") || request.headers.get("sec-purpose")?.includes("prefetch")) return response;

  const { data } = await ambassadorDb().rpc("ambassador_open_referral", { p_code: code });

  if (typeof data === "string") {
    response.cookies.set(referralCookie, data, {
      maxAge: 30 * 60, httpOnly: true, path: "/", sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}
