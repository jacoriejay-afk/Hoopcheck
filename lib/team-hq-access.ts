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
  if (data?.length) {
    return {
      clubId, role: "owner",
      editProfile: true, manageRoster: true, answerVerifications: true,
      replyReviews: true, moderateFanGroup: true, manageStaff: true,
      publishUpdates: true,
    };
  }
  // Staff grants are scoped to a club, require an accepted invitation, and
  // never inherit owner-only staff management or ownership transfer rights.
  const { data: staff, error: staffError } = await db.from("team_hq_staff")
    .select("user_id,invited_by,accepted_at,revoked_at")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (staffError) throw new Error("Team HQ staff verification failed.");
  if (!staff?.accepted_at) return null;
  // Staff rows alone are insufficient: require a matching, accepted, unrevoked
  // invitation, accepted within its original seven-day validity window.
  const { data: invitations, error: invitationError } = await db.from("team_hq_invitations")
    .select("id,accepted_at,created_at,expires_at")
    .eq("club_id", clubId)
    .eq("invited_by", staff.invited_by)
    .eq("accepted_by", userId)
    .is("revoked_at", null)
    .not("accepted_at", "is", null)
    .limit(20);
  if (invitationError) throw new Error("Team HQ invitation verification failed.");
  const accepted = invitations?.some((invite) => {
    const acceptedAt = Date.parse(invite.accepted_at);
    const createdAt = Date.parse(invite.created_at);
    const expiresAt = Date.parse(invite.expires_at);
    return acceptedAt === Date.parse(staff.accepted_at) && Number.isFinite(acceptedAt) && Number.isFinite(createdAt) &&
      Number.isFinite(expiresAt) && acceptedAt >= createdAt &&
      acceptedAt <= expiresAt && acceptedAt <= createdAt + 7 * 86400000;
  });
  if (!accepted) return null;
  // An invitation grant is only valid while its inviting owner still holds
  // an approved claim for this exact club.
  const { data: ownerClaim, error: ownerError } = await db.from("profile_claim_requests")
    .select("id")
    .eq("entity_type", "team")
    .eq("entity_id", clubId)
    .eq("requester_id", staff.invited_by)
    .eq("status", "approved")
    .limit(1);
  if (ownerError) throw new Error("Team HQ owner verification failed.");
  if (!ownerClaim?.length) return null;
  return {
    clubId, role: "manager",
    editProfile: true, manageRoster: true, answerVerifications: true,
    replyReviews: true, moderateFanGroup: true, manageStaff: false,
    publishUpdates: true,
  };
}

export function canManageClub(grant: ClubGrant | null, clubId: string, capability: ClubCapability): boolean {
  return grant?.clubId === clubId && grant[capability] === true;
}
