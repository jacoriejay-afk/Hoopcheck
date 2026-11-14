import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "../../../lib/server/supabase-auth";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = new URL("/login", request.url);
  if (!tokenHash || (type !== "email" && type !== "signup" && type !== "recovery")) {
    destination.searchParams.set("auth_error", "invalid_link");
    return NextResponse.redirect(destination);
  }

  const supabase = await createAuthClient(true);
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type === "recovery" ? "recovery" : type,
  });
  if (error) {
    destination.searchParams.set("auth_error", "expired_or_invalid");
    return NextResponse.redirect(destination);
  }
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password?recovery_verified=1", request.url));
  }
  destination.searchParams.set("verified", "1");
  return NextResponse.redirect(destination);
}
