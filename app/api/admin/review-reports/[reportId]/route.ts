import { NextResponse } from "next/server";
import { authorizeModeratorRequest } from "../../../../../lib/server/review-moderation";

const reportStatuses = ["resolved", "dismissed"] as const;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const auth = await authorizeModeratorRequest(request);
  if (!auth.ok) return auth.response;

  const { reportId } = await params;
  if (!uuidPattern.test(reportId)) {
    return NextResponse.json(
      { error: "Invalid report ID." },
      { status: 400 }
    );
  }

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (
    typeof body?.status !== "string" ||
    !reportStatuses.includes(
      body.status as (typeof reportStatuses)[number]
    )
  ) {
    return NextResponse.json(
      { error: "Invalid report status." },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("review_reports")
    .update({ status: body.status })
    .eq("id", reportId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error updating report status:", error);
    return NextResponse.json(
      { error: "Unable to update report status." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Report not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
