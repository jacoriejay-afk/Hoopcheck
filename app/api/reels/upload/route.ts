import { NextResponse } from "next/server";
import { authorizeReelPublisher } from "../../../../lib/reels-publisher-auth";
import { REELS_MEDIA_UPLOAD_ENABLED } from "../../../../lib/reels-rollout";

export const runtime = "nodejs";

/**
 * REELS-1 upload endpoint placeholder: authentication and entitlement checks
 * are enforced, but media ingestion stays hard-disabled until private storage,
 * server-side media verification and database RLS are ready.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\\s+(\\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const authorization = await authorizeReelPublisher(token);
  if (!authorization.ok)
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  if (!REELS_MEDIA_UPLOAD_ENABLED)
    return NextResponse.json(
      { error: "Reels video uploading is not available yet", uploadEnabled: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  // No enabled branch is implemented: even if the rollout constant changes,
  // the endpoint still fails closed rather than accepting uninspected bytes.
  return NextResponse.json({ error: "Upload pipeline not implemented" }, { status: 503 });
}
