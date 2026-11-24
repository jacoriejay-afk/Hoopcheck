import { legacyMobileRead } from "../../../../../lib/billing/legacy-mobile-read";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return legacyMobileRead(request, "catalog"); }
