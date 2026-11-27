import { NextResponse } from "next/server";
import { getAmbassadorWorkspace } from "../../../../lib/ambassador/server";
import { workspaceAccountIsActive } from "../../../../lib/ambassador/session-access";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";
import { createAuthClient } from "../../../../lib/server/supabase-auth";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const denied = { owner: false, staff: false, ambassador: false };
  const auth = await createAuthClient(true);
  const { data: session, error: sessionError } = await auth.auth.getSession();
  const token = session.session?.access_token;
  if (!token || sessionError) {
    return NextResponse.json({ error: "Sign in to view your workspaces." }, { status: 401, headers });
  }
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Sign in to view your workspaces." }, { status: 401, headers });
  }

  try {
    const { data } = await auth.auth.getClaims(token);
    if (!user.email_confirmed_at || data?.claims.role !== "authenticated" || data.claims.sub !== user.id ||
        assuranceForVerifiedUser(token, user).required || !await workspaceAccountIsActive(auth, user.id)) {
      return NextResponse.json(denied, { headers });
    }
  } catch {
    return NextResponse.json(denied, { headers });
  }

  const [owner, staff, grant] = await Promise.all([
    auth.rpc("is_approved_claim_owner"),
    auth.rpc("is_current_user_admin_or_moderator"),
    getAmbassadorWorkspace(user.id),
  ]);

  return NextResponse.json({
    owner: !owner.error && owner.data === true,
    staff: !staff.error && staff.data === true,
    ambassador: grant,
  }, { headers });
}
