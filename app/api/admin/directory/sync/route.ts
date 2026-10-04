import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDirectoryConnector } from "../../../../../lib/directory-sync/connectors";
import { syncNormalizedDirectory } from "../../../../../lib/directory-sync/sync-directory";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 50;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: isAdmin, error: roleError } = await supabase.rpc("is_current_user_admin_or_moderator");
  if (roleError || !isAdmin) return NextResponse.json({ error: "Admin or moderator access required" }, { status: 403 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server directory sync is not configured" }, { status: 503 });
  }

  // The route performs privileged server-side directory writes only after the
  // caller has been authenticated and authorized above. The service-role
  // client bypasses RLS for those writes and is never exposed to the browser.
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const body = await req.json().catch(() => ({}));
  const sourceId = typeof body.source_id === "string" ? body.source_id : null;
  const entityType = ["leagues", "teams", "coaches"].includes(body.entity_type)
    ? body.entity_type as "leagues"|"teams"|"coaches"
    : null;
  if (!sourceId || !entityType) {
    return NextResponse.json({ error: "source_id and entity_type are required" }, { status: 400 });
  }

  const offset = typeof body.offset === "number" && Number.isFinite(body.offset)
    ? Math.max(0, Math.floor(body.offset))
    : 0;
  const requestedLimit = typeof body.limit === "number" && Number.isFinite(body.limit)
    ? Math.floor(body.limit)
    : DEFAULT_BATCH_SIZE;
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, requestedLimit));

  const { data: source, error: sourceError } = await adminSupabase
    .from("directory_sources")
    .select("id,name,active,connector_key")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  if (!source.active) return NextResponse.json({ error: "Provider is paused" }, { status: 409 });

  const connector = getDirectoryConnector(source.connector_key);
  if (!connector) return NextResponse.json({ error: "Connector not configured for this provider" }, { status: 409 });

  const { data: run, error: runError } = await adminSupabase.from("directory_sync_runs").insert({
    source_id: sourceId,
    entity_type: entityType === "leagues" ? "league" : entityType === "teams" ? "team" : "coach",
    status: "running",
    records_seen: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
  }).select("id,source_id,entity_type,status,started_at").single();

  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });

  try {
    const normalized = await connector.getDirectory({
      entityType,
      sourceId,
      options: { offset, limit },
    });

    const result = await syncNormalizedDirectory(adminSupabase, sourceId, entityType, normalized);

    const batchHasMore =
      entityType !== "coaches" &&
      normalized.leagues.length === Math.min(limit, Math.max(0, normalized.leagues.length));
    const nextOffset = batchHasMore ? offset + limit : null;

    await adminSupabase.from("directory_sync_runs").update({
      status: "completed",
      records_seen: result.seen,
      records_created: result.created,
      records_updated: result.updated,
      records_skipped: result.skipped,
      finished_at: new Date().toISOString(),
    }).eq("id", run.id);

    return NextResponse.json({
      run: { ...run, status: "completed" },
      ...result,
      batch: { offset, limit, next_offset: nextOffset, has_more: batchHasMore },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await adminSupabase.from("directory_sync_runs").update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString(),
    }).eq("id", run.id);

    return NextResponse.json({
      error: message,
      run: { ...run, status: "failed" },
    }, { status: 500 });
  }
}
