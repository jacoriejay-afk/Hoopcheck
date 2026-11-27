import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // Never enable until the ledger, full fulfillment/retention workflow,
  // completion notices, provider revocation and end-to-end tests are approved.
  if (process.env.ACCOUNT_DELETION_WORKFLOW_ENABLED !== "true")
    return fail("Account deletion is temporarily unavailable. No changes were made.", 503);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return fail("Sign in again to request deletion.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail("Account deletion is unavailable.", 503);
  try {
    // The body can contain only a short explicit confirmation and timing option.
    const reader = request.body?.getReader();
    if (!reader) return fail("Invalid request.", 400);
    const chunks: Uint8Array[] = []; let total = 0;
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      total += part.value.byteLength;
      if (total > 512) { await reader.cancel(); return fail("Invalid request.", 413); }
      chunks.push(part.value);
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return fail("Invalid request.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !["confirm", "mode"].includes(k)) ||
      body.confirm !== "DELETE" || (body.mode !== "as_soon_as_possible" && body.mode !== "after_30_days"))
      return fail("Confirm the account deletion request.", 400);
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const verified = await client.auth.getUser(token);
    if (verified.error || !verified.data.user || !verified.data.user.email_confirmed_at) return fail("Verify your account first.", 401);
    const owner = verified.data.user;
    const claims = await client.auth.getClaims(token);
    const c = claims.data?.claims;
    if (claims.error || !c || c.sub !== owner.id || c.role !== "authenticated" ||
      typeof c.session_id !== "string" || !uuid.test(c.session_id) || !uuid.test(owner.id) || c.is_anonymous === true || c.client_id)
      return fail("Verify your account first.", 401);
    if (assuranceForVerifiedUser(token, owner).required) return fail("Verify your authenticator first.", 403);
    const now = Math.floor(Date.now() / 1000);
    const recent = Array.isArray(c.amr) && c.amr.some(entry =>
      entry && ["password", "oauth"].includes(entry.method) && Number.isFinite(entry.timestamp) &&
      entry.timestamp <= now + 5 && entry.timestamp >= now - 300);
    if (!recent) return fail("Sign in again using your original sign-in method, then return here.", 403);
    // The database independently checks signed owner, live session, MFA and fresh AMR.
    const { data, error } = await client.rpc("record_verified_account_deletion_request", {
      p_confirm: body.confirm, p_mode: body.mode,
    });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row || !uuid.test(row.request_id) || !["pending", "processing", "failed"].includes(row.request_status))
      return fail("The request could not be confirmed. Try again.", 503);
    return NextResponse.json({ requestId: row.request_id, status: row.request_status, requestedAt: row.requested_at, scheduledFor: row.scheduled_for }, { status: 202, headers });
  } catch { return fail("The request could not be confirmed. Try again.", 503); }
}
