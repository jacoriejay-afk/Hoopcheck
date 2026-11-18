import { NextResponse } from "next/server";
import { appleAppSiteAssociation } from "../../../lib/apple-app-site-association";

export const dynamic = "force-dynamic";

export function GET() {
  const association = appleAppSiteAssociation(process.env.HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX);
  if (!association) {
    return NextResponse.json({ error: "iOS association is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(association, { headers: { "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" } });
}
