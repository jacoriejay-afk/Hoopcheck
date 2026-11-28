import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Authorization",
};
const limit = 100;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const types = new Set(["access", "correction", "deletion", "export", "privacy_question"]);
const statuses = new Set(["open", "in_progress", "waiting_on_user", "completed", "denied"]);
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

// A bounded export of the request history already available to the requester.
// Not a full account export or evidence of fulfillment of a privacy request.
export async function POST(request: Request) {
  if (process.env.PRIVACY_HISTORY_EXPORT_ENABLED !== "true") return fail("Privacy history export is unavailable.", 503);
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]{1,16384})$/i)?.[1];
  if (!token) return fail("Sign in again.", 401);
  if (new URL(request.url).search) return fail("This export does not accept query parameters.", 400);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail("Privacy history export is unavailable.", 503);
  try {
    const scoped = createClient(url, key, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
    const unavailable = () => fail("Privacy history could not be verified.", 503);
    if (deadline.aborted) return unavailable();
    async function verifiedOwner() {
      if (deadline.aborted) return null;
      const { data, error } = await scoped.auth.getUser(token!);
      const user = data.user;
      if (error || !user?.email_confirmed_at || !uuid.test(user.id) || user.is_anonymous) return null;
      const claims = await scoped.auth.getClaims(token!);
      const verified = claims.data?.claims;
      if (claims.error || !verified || verified.sub !== user.id || verified.role !== "authenticated" ||
          "client_id" in verified || (verified.is_anonymous !== undefined && verified.is_anonymous !== false)) return null;
      if (assuranceForVerifiedUser(token!, user).required) return null;
      const active = await scoped.rpc("confirm_active_account_session");
      if (deadline.aborted || active.error || active.data !== true) return null;
      return user.id;
    }
    const owner = await verifiedOwner();
    if (deadline.aborted) return unavailable();
    if (!owner) return fail("Verify your account and sign in again.", 403);
    const result = await scoped.from("privacy_requests")
      .select("id,requester_id,request_type,status,details,created_at", { count: "exact" })
      .eq("requester_id", owner).order("created_at", { ascending: false })
      .order("id", { ascending: false }).limit(limit)
      .abortSignal(deadline);
    if (deadline.aborted || result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count === null)
      return fail("Privacy history could not be verified.", 503);
    if (result.count > limit) return fail("Your request history exceeds this download limit. Contact support for a complete copy.", 409);
    if (result.count !== result.data.length || new Set(result.data.map(row => row.id)).size !== result.data.length)
      return fail("Privacy history could not be verified.", 503);
    const rows = result.data.map(row => {
      if (row.requester_id !== owner || typeof row.id !== "string" || !uuid.test(row.id) ||
          !types.has(row.request_type) || !statuses.has(row.status) ||
          typeof row.details !== "string" || row.details.length > 20000 ||
          typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)))
        throw Error("Invalid privacy history row.");
      return { id: row.id, request_type: row.request_type, status: row.status, details: row.details, created_at: row.created_at };
    });
    if (deadline.aborted) return unavailable();
    const finalOwner = await verifiedOwner();
    if (deadline.aborted) return unavailable();
    if (finalOwner !== owner) return fail("Verify your account and sign in again.", 403);
    return NextResponse.json({
      format: 1, scope: "privacy_request_history_only",
      note: "This is not a full account data export or confirmation that any request was fulfilled.",
      requests: rows,
    }, { headers: { ...headers, "Content-Disposition": 'attachment; filename="hoopcheck-privacy-request-history.json"' } });
  } catch {
    // Do not log tokens, rows, user details or provider error payloads.
    return fail("Privacy history could not be verified.", 503);
  }
}
