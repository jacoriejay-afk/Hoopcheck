import { NextResponse } from "next/server";
import { getAmbassadorWorkspace } from "../../../../lib/ambassador/server";
import { createAuthClient } from "../../../../lib/server/supabase-auth";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const auth = await createAuthClient(true);
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Sign in to view your workspaces." }, { status: 401, headers });
  }

  const { data } = await auth.auth.getClaims();
  if (!user.email_confirmed_at || data?.claims.role !== "authenticated") {
    return NextResponse.json({ owner: false, staff: false, ambassador: false }, { headers });
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
