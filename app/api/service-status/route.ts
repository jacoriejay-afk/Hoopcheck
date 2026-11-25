import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// This endpoint establishes only that the web API answered. It does not
// assert database, payment, media or basketball-provider health.
export function GET() {
  const maintenance = process.env.HOOPCHECK_MAINTENANCE_NOTICE === "true";
  return NextResponse.json(
    { version: 1, status: maintenance ? "maintenance_announced" : "reachable", observedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
