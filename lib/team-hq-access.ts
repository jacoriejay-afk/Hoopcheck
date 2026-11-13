import { createClient } from "@supabase/supabase-js";

export type ClubCapability =
  | "editProfile" | "manageRoster" | "answerVerifications"
  | "replyReviews" | "moderateFanGroup" | "manageStaff" | "publishUpdates";

export type ClubGrant = Readonly<{
  clubId: string;
  role: "owner" | "manager";
  editProfile: boolean;
  manageRoster: boolean;
  answerVerifications: boolean;
  replyReviews: boolean;
  moderateFanGroup: boolean;
  manageStaff: boolean;
  publishUpdates: boolean;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Server-only club grant resolver. Never authorize via profiles.account_type
 * or platform admin_roles. The approved team claim is the existing owner
 * record; invited managers will be added only with audited DB grants.
 */
export async function resolveClubGrant(userId: string, clubId: string): Promise<ClubGrant | null> {
  if (!UUID.test(userId) || !UUID.test(clubId)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Team HQ server authorization is not configured.");
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await db.from("profile_claim_requests")
    .select("id")
    .eq("entity_type", "team")
    .eq("entity_id", clubId)
    .eq("requester_id", userId)
    .eq("status", "approved")
    .limit(1);
  if (error) throw new Error("Team HQ claim verification failed.");
  if (!data?.length) return null;
  return {
    clubId, role: "owner",
    editProfile: true, manageRoster: true, answerVerifications: true,
    replyReviews: true, moderateFanGroup: true, manageStaff: true,
    publishUpdates: true,
  };
}

export function canManageClub(grant: ClubGrant | null, clubId: string, capability: ClubCapability): boolean {
  return grant?.clubId === clubId && grant[capability] === true;
}
