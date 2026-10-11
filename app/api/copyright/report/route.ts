import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const requiredFields = [
  "claimant_name",
  "claimant_email",
  "copyrighted_work_description",
  "infringing_content_url",
  "infringement_description",
  "good_faith_statement",
  "accuracy_statement",
  "electronic_signature",
] as const;

const fieldLimits: Record<string, number> = {
  claimant_name: 200,
  claimant_email: 320,
  claimant_address: 1000,
  claimant_phone: 80,
  copyrighted_work_description: 5000,
  original_work_url: 2000,
  infringing_content_url: 2000,
  infringement_description: 5000,
  good_faith_statement: 2000,
  accuracy_statement: 2000,
  electronic_signature: 200,
  counter_notice_basis: 5000,
  counter_notice_statement: 5000,
};

export async function POST(req: Request) {
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > 32_768) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 32_768) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  for (const field of requiredFields) {
    if (typeof payload[field] !== "string" || !payload[field].trim()) {
      return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
    }
  }

  for (const [field, limit] of Object.entries(fieldLimits)) {
    const value = payload[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      return NextResponse.json({ error: `${field} must be text.` }, { status: 400 });
    }
    if (typeof value === "string" && value.length > limit) {
      return NextResponse.json({ error: `${field} exceeds the maximum length.` }, { status: 400 });
    }
  }

  const claimantEmail = (payload.claimant_email as string).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claimantEmail)) {
    return NextResponse.json({ error: "Enter a valid claimant email address." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Copyright reporting is temporarily unavailable." }, { status: 503 });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Only trust the hosting platform's edge-provided client IP header. Do not use
  // x-forwarded-for as a fallback because clients may be able to spoof it.
  // Hash the key so raw IPs are not retained; use claimant email if no trusted IP exists.
  const ipAddress = req.headers.get("x-real-ip")?.trim() || "";
  const rateLimitSubject = ipAddress ? `ip:${ipAddress}` : `email:${claimantEmail.toLowerCase()}`;
  const rateLimitKey = createHash("sha256").update(rateLimitSubject).digest("hex");
  const { data: allowed, error: rateLimitError } = await db.rpc(
    "consume_copyright_report_rate_limit",
    { p_key_hash: rateLimitKey },
  );

  if (rateLimitError) {
    console.error("Copyright report rate limiter failed:", rateLimitError);
    return NextResponse.json({ error: "Copyright reporting is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
  if (allowed !== true) {
    return NextResponse.json(
      { error: "Too many submissions from this source. Please wait an hour before submitting another notice." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const optional = (field: string) => {
    const value = payload[field];
    return typeof value === "string" && value.trim() ? value.trim().slice(0, fieldLimits[field]) : null;
  };

  const { error } = await db.from("copyright_reports").insert({
    report_type: payload.report_type === "counter_notice" ? "counter_notice" : "dmca_notice",
    status: "received",
    claimant_name: (payload.claimant_name as string).trim().slice(0, 200),
    claimant_email: claimantEmail.slice(0, 320),
    claimant_address: optional("claimant_address"),
    claimant_phone: optional("claimant_phone"),
    copyrighted_work_description: (payload.copyrighted_work_description as string).trim().slice(0, 5000),
    original_work_url: optional("original_work_url"),
    infringing_content_url: (payload.infringing_content_url as string).trim().slice(0, 2000),
    infringement_description: (payload.infringement_description as string).trim().slice(0, 5000),
    good_faith_statement: (payload.good_faith_statement as string).trim().slice(0, 2000),
    accuracy_statement: (payload.accuracy_statement as string).trim().slice(0, 2000),
    electronic_signature: (payload.electronic_signature as string).trim().slice(0, 200),
    counter_notice_basis: optional("counter_notice_basis"),
    counter_notice_statement: optional("counter_notice_statement"),
  });

  if (error) {
    console.error("Copyright report insert failed:", error);
    return NextResponse.json({ error: "We could not record the report. Please contact Support." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
