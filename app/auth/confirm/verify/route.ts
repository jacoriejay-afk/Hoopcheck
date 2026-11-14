import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "../../../../lib/server/supabase-auth";

export async function POST(request: NextRequest) {
  const login = new URL("/login", request.url);
  login.searchParams.set("auth_error", "invalid_link");
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.redirect(login, 303);
  }

  const form = await request.formData().catch(() => null);
  const tokenHash = form?.get("token_hash");
  const type = form?.get("type");
  if (typeof tokenHash !== "string" || !/^[a-f0-9]{56,128}$/i.test(tokenHash)
    || (type !== "email" && type !== "signup")) {
    return NextResponse.redirect(login, 303);
  }

  const supabase = await createAuthClient(true);
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.session) {
    login.searchParams.set("auth_error", "expired_or_invalid");
    return NextResponse.redirect(login, 303);
  }
  return NextResponse.redirect(new URL("/signup/complete?verified=1", request.url), 303);
}
