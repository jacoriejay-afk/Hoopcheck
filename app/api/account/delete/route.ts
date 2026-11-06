import { NextResponse } from "next/server";

/**
 * Safety stop for the legacy immediate-deletion endpoint.
 *
 * The account deletion experience is being migrated to the required 30-day
 * request/cancellation lifecycle. Until password re-verification, sign-in
 * cancellation, write restrictions, review anonymization, retention handling,
 * and a tested finalizer are all deployed together, this endpoint must not
 * delete Auth users or cascade through profile-owned records.
 *
 * Keep this route as an explicit conflict response so old clients fail closed
 * rather than accidentally invoking irreversible deletion.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Account deletion is temporarily unavailable while the 30-day protected deletion process is being prepared. Your account and subscriptions have not been changed. Please try again later or contact HoopCheck support.",
      code: "ACCOUNT_DELETION_LIFECYCLE_NOT_READY",
    },
    { status: 409 }
  );
}
