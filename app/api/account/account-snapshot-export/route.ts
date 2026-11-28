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
const maxBytes = 4 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
// Keep this allowlist within the reviewed get_own_profile RPC projection.
const profileFields = ["id","display_name","username","first_name","last_name","bio","account_type","current_country","current_country_public","current_team","position","years_pro","profile_visibility","free_agent","created_at","updated_at","agreed_to_terms"] as const;
const sections = [
  { name:"reviews", table:"reviews", owner:"author_id", fields:["id","title","body","status","overall_rating","player_season","team_id","coach_id","league_id","is_anonymous","created_at"] },
  { name:"womens_reviews", table:"womens_team_reviews", owner:"author_id", fields:["id","title","body","status","overall_rating","womens_team_id","is_anonymous","created_at"] },
  { name:"player_posts", table:"feed_posts", owner:"author_id", fields:["id","body","created_at"] },
  { name:"fan_posts", table:"fan_feed_posts", owner:"author_id", fields:["id","body","created_at"] },
  { name:"membership_sources", table:"membership_sources", owner:"user_id", fields:["id","plan","status","access_status","current_period_end","cancel_at_period_end","billing_interval","provider"] },
] as const;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid record.");
  return value as Record<string, unknown>;
}
function project(row: Record<string, unknown>, fields: readonly string[]) {
  const result: Record<string, string | number | boolean | null> = {};
  for (const field of fields) {
    const value = row[field];
    if (value === undefined) throw Error("Missing requested field.");
    if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
      throw Error("Invalid field.");
    if (typeof value === "number" && !Number.isFinite(value)) throw Error("Invalid number.");
    if (typeof value === "string" && value.length > 100000) throw Error("Field exceeds download limit.");
    result[field] = value;
  }
  return result;
}
// Intentionally a limited snapshot of records visible to the current caller.
// RLS may hide older or restricted data. Exact counts cover visible rows only.
// Full data-rights fulfillment, media, billing history, messages and other
// personal records require a separate reviewed workflow, not elevated reads here.
export async function POST(request: Request) {
  if (process.env.ACCOUNT_SNAPSHOT_EXPORT_ENABLED !== "true") return fail("Account snapshot is unavailable.",503);
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]{1,16384})$/i)?.[1];
  if (!token) return fail("Sign in again.",401);
  if (new URL(request.url).search) return fail("This export does not accept query parameters.",400);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail("Account snapshot is unavailable.",503);
  try {
    const scoped = createClient(url,key,{
      global:{headers:{Authorization:"Bearer "+token}},
      auth:{autoRefreshToken:false,persistSession:false},
    });
    async function verifyOwner() {
      const {data,error} = await scoped.auth.getUser(token!);
      const user = data.user;
      if (error || !user?.email_confirmed_at || user.is_anonymous || !uuid.test(user.id)) return null;
      const claims = await scoped.auth.getClaims(token!);
      if (claims.error || claims.data?.claims.sub !== user.id || claims.data.claims.role !== "authenticated") return null;
      if (assuranceForVerifiedUser(token!,user).required) return null;
      const active = await scoped.rpc("confirm_active_account_session");
      return !active.error && active.data === true ? user.id : null;
    }
    const owner = await verifyOwner();
    if (!owner) return fail("Verify your account and sign in again.",403);
    const deadline = AbortSignal.timeout(15000);
    const own = await scoped.rpc("get_own_profile").abortSignal(deadline);
    if (own.error) return fail("Account snapshot could not be verified.",503);
    const profile = record(own.data);
    if (profile.id !== owner) return fail("Account snapshot could not be verified.",503);
    const data: Record<string,unknown> = { profile:project(profile,profileFields) };
    for (const section of sections) {
      const query = await scoped.from(section.table)
        .select([section.owner,...section.fields].join(","),{count:"exact"})
        .eq(section.owner,owner).order("id",{ascending:true}).limit(limit).abortSignal(deadline);
      if (query.error || !Array.isArray(query.data) || query.count === null || !Number.isSafeInteger(query.count))
        return fail("Account snapshot could not be verified.",503);
      if (query.count > limit) return fail("Account snapshot exceeds the download limit. Request a complete copy through Privacy Center.",409);
      if (query.count !== query.data.length) return fail("Account snapshot could not be verified.",503);
      const seen = new Set<string>();
      data[section.name] = query.data.map(value => {
        const row = record(value);
        if (row[section.owner] !== owner || typeof row.id !== "string" || !uuid.test(row.id) || seen.has(row.id))
          throw Error("Account snapshot scope mismatch.");
        seen.add(row.id);
        return project(row,section.fields);
      });
    }
    const payload = { format:1, scope:"currently_accessible_account_snapshot_only", complete:false,
      note:"These are selected records visible to your current session, not a complete copy of personal data. Some records and fields may be omitted by access policies. Use Privacy Center to request a full copy. This does not complete a privacy request.",
      data };
    const json = JSON.stringify(payload);
    if (Buffer.byteLength(json,"utf8") > maxBytes) return fail("Account snapshot exceeds the download limit. Request a complete copy through Privacy Center.",409);
    if (deadline.aborted) return fail("Account snapshot could not be verified.",503);
    if (await verifyOwner() !== owner) return fail("Verify your account and sign in again.",403);
    if (deadline.aborted) return fail("Account snapshot could not be verified.",503);
    return new Response(json,{headers:{...headers,"Content-Type":"application/json; charset=utf-8",
      "Content-Disposition":'attachment; filename="hoopcheck-account-snapshot.json"'}});
  } catch {
    // Never log personal data, tokens, or provider error payloads.
    return fail("Account snapshot could not be verified.",503);
  }
}
