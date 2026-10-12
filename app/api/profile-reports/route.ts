import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 4_096;

async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: unknown;
  try {
    const rawBytes = await readLimitedBody(req, MAX_BODY_BYTES);
    if (rawBytes === null) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(new TextDecoder().decode(rawBytes));
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const profileId = typeof payload.profileId === "string" ? payload.profileId.trim() : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  if (!UUID_RE.test(profileId)) {
    return NextResponse.json({ error: "A valid profile is required." }, { status: 400 });
  }
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "A reason of 1–500 characters is required." }, { status: 400 });
  }
  if (profileId === user.id) {
    return NextResponse.json({ error: "You cannot report your own profile." }, { status: 400 });
  }

  const { error } = await supabase.from("profile_reports").insert({
    profile_id: profileId,
    reporter_id: user.id,
    reason,
  });
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }
    console.error("Profile report insert failed:", error);
    return NextResponse.json({ error: "We couldn't submit your report. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}