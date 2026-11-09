import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const TYPES = new Set(["sponsor", "donate", "inquire"]);
const responseHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const json = (message: string, status: number) => NextResponse.json({ message }, { status, headers: responseHeaders });

export async function POST(request: NextRequest) {
  // Fail closed until both CAPTCHA and server-side storage are configured.
  if (process.env.BUSINESS_INQUIRIES_API_ENABLED !== "true")
    return json("Public inquiries are temporarily unavailable.", 503);
  const origin = request.headers.get("origin");
  const allowedOrigin = process.env.BUSINESS_INQUIRIES_ALLOWED_ORIGIN;
  if (!allowedOrigin || origin !== allowedOrigin) return json("Origin not allowed.", 403);
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceKey) return json("Public inquiries are temporarily unavailable.", 503);

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return json("JSON content type required.", 415);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 12000) return json("Request too large.", 413);

  let body: Record<string, unknown>;
  try {
    // Enforce a real byte limit even if Content-Length is absent or inaccurate.
    const reader = request.body?.getReader();
    if (!reader) return json("Invalid request.", 400);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 12000) {
        await reader.cancel();
        return json("Request too large.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json("Invalid request.", 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json("Invalid request.", 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  // A filled honeypot is an automated submission; do not spend CAPTCHA verification calls.
  if (body.website !== "") return json("Please check the inquiry details.", 400);
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
    const { data, error } = await admin.rpc("submit_business_inquiry", {
      p_name: name, p_email: email, p_type: type, p_message: message,
    });
    if (error) return json("Could not save your inquiry. Please try again.", 503);
    if (data !== true) return json("Too many inquiries from this email. Please try again tomorrow.", 429);
    return NextResponse.json({ message: "Thanks! Your inquiry has been received." }, { status: 201, headers: responseHeaders });
  } catch {
    return json("Submission unavailable. Please try again later.", 503);
  }
}
