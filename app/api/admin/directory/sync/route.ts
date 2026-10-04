import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDirectoryConnector } from "@/lib/directory-sync/connectors";
import { syncNormalizedDirectory } from "@/lib/directory-sync/sync-directory";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: isAdmin, error: roleError } = await supabase.rpc("is_current_user_admin_or_moderator");
  if (roleError || !isAdmin) return NextResponse.json({ error: "Admin or moderator access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sourceId = typeof body.source_id === "string" ? body.source_id : null;
  const entityType = ["leagues", "teams", "coaches"].includes(body.entity_type) ? body.entity_type : null;
  if (!sourceId || !entityType) return NextResponse.json({ error: "source_id and entity_type are required" }, { status: 400 });

  const { data: source, error: sourceError } = await supabase
    .from("directory_sources").select("id,name,active,connector_key").eq("id", sourceId).single();
  if (sourceError || !source) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  if (!source.active) return NextResponse.json({ error: "Provider is paused" }, { status: 409 });
  const connector = getDirectoryConnector(source.connector_key);
  if (!connector) return NextResponse.json({ error: "Connector not configured for this provider" }, { status: 409 });

  const { data: run, error: runError } = await supabase
    .from("directory_sync_runs")
    .insert({ source_id: sourceId, entity_type: entityType, status: "queued", records_seen: 0, records_created: 0, records_updated: 0, records_skipped: 0 })
    .select("id,source_id,entity_type,status,started_at")
    .single();

  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });

  return NextResponse.json({
    run,
    message: "Sync run queued. A provider connector must supply the normalized records before data is changed."
  });
}    const normalized = await connector.getDirectory({ entityType, sourceId });
    const result = await syncNormalizedDirectory(supabase, sourceId, entityType, normalized);

