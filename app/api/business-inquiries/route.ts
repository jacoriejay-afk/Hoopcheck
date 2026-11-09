import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const TYPES = new Set(["sponsor", "donate", "inquire"]);
const json = (message: string, status: number) => NextResponse.json({ message }, { status });

export async function POST(request: NextRequest) {
  // Fail closed until both CAPTCHA and server-side storage are configured.
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceKey) return json("Public inquiries are temporarily unavailable.", 503);

  const length = Number(request.headers.get("content-length") || 0);
  if (length > 12000) return json("Request too large.", 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json("Invalid request.", 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (name.length < 2 || name.length > 120 || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      message.length < 10 || message.length > 3000 || !TYPES.has(type) ||
      token.length < 10 || token.length > 2048) return json("Please check the inquiry details.", 400);

  try {
    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: request.headers.get("x-real-ip") || "",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!verification.ok) return json("Verification unavailable. Try again.", 503);
    const result = await verification.json() as { success?: boolean; hostname?: string };
    const allowedHost = process.env.TURNSTILE_ALLOWED_HOSTNAME;
    if (!result.success || !allowedHost || result.hostname !== allowedHost)
      return json("Verification failed. Please retry.", 403);

    // This separate table has no anonymous read/write grants; only this server route inserts.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.from("public_business_inquiries").insert({
      name, email, type, message,
    });
    if (error) return json("Could not save your inquiry. Please try again.", 503);
    return NextResponse.json({ message: "Thanks! Your inquiry has been received." }, { status: 201 });
  } catch {
    return json("Submission unavailable. Please try again later.", 503);
  }
}
