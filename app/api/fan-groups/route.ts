import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { getHoopCheckEntitlements } from "../../../lib/membership-tier";

export const runtime = "nodejs";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 2000;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing server Supabase configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function moderate(text: string, image: File | null) {
  const input: any[] = [];
  if (text.trim()) input.push({ type: "text", text });
  if (image) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > MAX_IMAGE_BYTES)
      return { allowed: false, status: 400, message: "Choose a JPG, PNG, or WebP image up to 4 MB." };
    const bytes = Buffer.from(await image.arrayBuffer());
    input.push({ type: "image_url", image_url: { url: "data:" + image.type + ";base64," + bytes.toString("base64") } });
  }
  if (!input.length) return { allowed: false, status: 400, message: "Add text or a photo before posting." };
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { allowed: false, status: 503, message: "Group safety moderation is temporarily unavailable." };
  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input }), signal: AbortSignal.timeout(15000), cache: "no-store"
    });
    if (!response.ok) return { allowed: false, status: 502, message: "Group safety moderation is temporarily unavailable." };
    const result = (await response.json().catch(() => null))?.results?.[0];
    if (!result || typeof result.flagged !== "boolean") return { allowed: false, status: 502, message: "Group safety moderation returned no valid result." };
    return result.flagged
      ? { allowed: false, status: 400, message: "This content did not pass HoopCheck safety moderation." }
      : { allowed: true, status: 200, message: "ok" };
  } catch {
    return { allowed: false, status: 502, message: "Group safety moderation is temporarily unavailable." };
  }
}

async function notify(db: ReturnType<typeof adminClient>, userIds: string[], teamId: string, type: string, title: string, body: string) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  const { data: prefs } = await db.from("user_preferences").select("user_id,notifications_enabled").in("user_id", unique);
  const disabled = new Set((prefs || []).filter((p: any) => p.notifications_enabled === false).map((p: any) => p.user_id));
  const rows = unique.filter(id => !disabled.has(id)).map(user_id => ({ user_id, target_type: "team", target_id: teamId, notification_type: type, title, body }));
  if (rows.length) await db.from("notifications").insert(rows);
}

export async function POST(request: Request) {
  let db: ReturnType<typeof adminClient> | null = null;
  let uploadedPath: string | null = null;
  try {
    const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return NextResponse.json({ ok: false, message: "Sign in is required." }, { status: 401 });
    db = adminClient();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user) return NextResponse.json({ ok: false, message: "Your session is invalid." }, { status: 401 });
    const form = await request.formData();
    const action = String(form.get("action") || "");
    const teamId = String(form.get("team_id") || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId))
      return NextResponse.json({ ok: false, message: "Choose a valid team." }, { status: 400 });
    const { data: profile } = await db.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
    const entitlements = getHoopCheckEntitlements({ accountType: profile?.account_type });
    const { data: group } = await db.from("team_fan_groups").select("team_id,group_name,join_mode").eq("team_id", teamId).maybeSingle();
    if (!group) return NextResponse.json({ ok: false, message: "This team's Fan Group is not available." }, { status: 404 });

    const { data: explicitMod } = await db.from("team_fan_group_moderators").select("id").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
    const { data: platformMod } = await db.from("team_fan_group_moderators").select("id").eq("team_id", teamId).eq("moderator_type", "platform").maybeSingle();
    // Resolve the authenticated user's platform role explicitly; service-role RPCs
    // do not inherit the request user's auth.uid().
    const { data: platformRoles, error: platformRoleError } = await db.from("admin_roles")
      .select("role").eq("user_id", user.id);
    if (platformRoleError) throw platformRoleError;
    const isPlatformAdmin = (platformRoles || []).some((r: any) => String(r.role || "").trim().toLowerCase() === "admin");
    const isPlatformModerator = isPlatformAdmin || (platformRoles || []).some((r: any) => String(r.role || "").trim().toLowerCase() === "moderator");
    // Team moderation requires an explicit appointment or authorized platform role.
    const isModerator = Boolean(explicitMod || isPlatformAdmin || (platformMod && isPlatformModerator));
    const { data: membership } = await db.from("team_fan_group_members").select("user_id").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
    const isMember = Boolean(membership);

    if (action === "join") {
      if (!entitlements.canUseFanGroups) return NextResponse.json({ ok: false, message: "Only fan accounts can join team fan groups." }, { status: 403 });
      if (isMember) return NextResponse.json({ ok: true, joined: true });
      // All Fan HQ groups are open: joining never creates an approval request.
      const { error } = await db.from("team_fan_group_members").upsert(
        { team_id: teamId, user_id: user.id },
        { onConflict: "team_id,user_id" }
      );
      if (error) throw error;
      return NextResponse.json({ ok: true, joined: true });
    }

    if (action === "leave") {
      if (profile?.account_type !== "fan") return NextResponse.json({ ok: false, message: "Only fan accounts can leave Fan Groups." }, { status: 403 });
      if (!isMember) return NextResponse.json({ ok: true, left: true });
      // Remove any fan co-moderator appointment before deleting membership.
      // A cleanup error must not turn a successful leave into an error response.
      const { error: moderatorError } = await db.from("team_fan_group_moderators").delete().eq("team_id", teamId).eq("user_id", user.id).eq("moderator_type", "fan_co_moderator");
      if (moderatorError) throw moderatorError;
      const { error } = await db.from("team_fan_group_members").delete().eq("team_id", teamId).eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, left: true });
    }

    if (action === "create_post" || action === "comment") {
      if (profile?.account_type !== "fan" || !isMember) return NextResponse.json({ ok: false, message: "Join this Fan Group to post and comment." }, { status: 403 });
      const text = String(form.get("body") || "").trim();
      const imageValue = form.get("image");
      const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
      if (text.length > (action === "comment" ? 1000 : MAX_TEXT)) return NextResponse.json({ ok: false, message: "Your text is too long." }, { status: 413 });
      if (action === "comment" && !text) return NextResponse.json({ ok: false, message: "Write a comment first." }, { status: 400 });
      if (action === "comment" && image) return NextResponse.json({ ok: false, message: "Photos can be added to posts, not comments." }, { status: 400 });
      if (action === "create_post" && !text && !image) return NextResponse.json({ ok: false, message: "Add text or a photo before posting." }, { status: 400 });
      const decision = await moderate(text, image);
      if (!decision.allowed) return NextResponse.json({ ok: false, message: decision.message }, { status: decision.status });
      if (action === "comment") {
        const postId = String(form.get("post_id") || "");
        const { data: post } = await db.from("team_fan_group_posts").select("id,team_id,status").eq("id", postId).eq("team_id", teamId).maybeSingle();
        if (!post || post.status !== "published") return NextResponse.json({ ok: false, message: "This group post is no longer available." }, { status: 404 });
        const { data, error } = await db.from("team_fan_group_comments").insert({ post_id: postId, author_id: user.id, body: text }).select("id,post_id,author_id,body,created_at").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, comment: data });
      }
      let imageUrl: string | null = null;
      if (image) {
        const ext = image.type === "image/jpeg" ? "jpg" : image.type === "image/png" ? "png" : "webp";
        uploadedPath = teamId + "/" + user.id + "/" + randomUUID() + "." + ext;
        const bytes = Buffer.from(await image.arrayBuffer());
        const { error } = await db.storage.from("fan-group-images").upload(uploadedPath, bytes, { contentType: image.type, cacheControl: "31536000", upsert: false });
        if (error) throw error;
        imageUrl = uploadedPath;
      }
      const { data, error } = await db.from("team_fan_group_posts").insert({ team_id: teamId, author_id: user.id, body: text, image_url: imageUrl }).select("id,team_id,author_id,body,image_url,is_pinned,status,created_at").single();
      if (error) throw error;
      uploadedPath = null;
      return NextResponse.json({ ok: true, post: data });
    }

    if (action === "report_post") {
      if (!isMember) return NextResponse.json({ ok: false, message: "Join this Fan Group to report posts." }, { status: 403 });
      const postId = String(form.get("post_id") || "");
      const reason = String(form.get("reason") || "").trim().slice(0, 500);
      if (reason.length < 3) return NextResponse.json({ ok: false, message: "Add a short reason for the report." }, { status: 400 });
      const { data: reportedPost } = await db.from("team_fan_group_posts").select("id").eq("id", postId).eq("team_id", teamId).eq("status", "published").maybeSingle();
      if (!reportedPost) return NextResponse.json({ ok: false, message: "This group post is no longer available." }, { status: 404 });
      if (profile?.account_type !== "fan") return NextResponse.json({ ok: false, message: "Only fans can report group posts." }, { status: 403 });
      const { error } = await db.from("team_fan_group_reports").insert({ team_id: teamId, post_id: postId, reporter_id: user.id, reason });
      if (error?.code === "23505") return NextResponse.json({ ok: false, message: "You already reported this post." }, { status: 409 });
      if (error) throw error;
      const { data: mods } = await db.from("team_fan_group_moderators").select("user_id,moderator_type").eq("team_id", teamId);
      const moderatorIds = (mods || []).map((m: any) => m.user_id).filter(Boolean);
      if ((mods || []).some((m: any) => m.moderator_type === "platform")) {
        const { data: admins } = await db.from("profiles").select("id").eq("account_type", "admin");
        moderatorIds.push(...(admins || []).map((a: any) => a.id));
      }
      await notify(db, moderatorIds, teamId, "group_report", "Fan Group post reported", "A group post has been reported and needs moderator review.");
      return NextResponse.json({ ok: true });
    }

    if (!isModerator) return NextResponse.json({ ok: false, message: "Moderator access is required." }, { status: 403 });
    if (action === "set_join_mode") {
      const mode = String(form.get("join_mode") || "");
      if (mode !== "open") return NextResponse.json({ ok: false, message: "All Fan HQ groups are open to join." }, { status: 400 });
      const { error } = await db.from("team_fan_groups").update({ join_mode: mode, updated_at: new Date().toISOString() }).eq("team_id", teamId);
      if (error) throw error;
      if (mode === "open") {
        const { data: pending } = await db.from("team_fan_group_join_requests").select("id,user_id").eq("team_id", teamId).eq("status", "pending");
        if (pending?.length) {
          await db.from("team_fan_group_members").upsert(pending.map((r: any) => ({ team_id: teamId, user_id: r.user_id })), { onConflict: "team_id,user_id" });
          await db.from("team_fan_group_join_requests").update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id }).in("id", pending.map((r: any) => r.id));
          await notify(db, pending.map((r: any) => r.user_id), teamId, "group_approved", "Your Fan Group request was approved", "You're now a member of " + group.group_name + ".");
        }
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "review_request") {
      const requestId = String(form.get("request_id") || "");
      const decision = String(form.get("decision") || "");
      if (!["approved", "rejected"].includes(decision)) return NextResponse.json({ ok: false, message: "Choose approve or reject." }, { status: 400 });
      const { data: joinRequest, error } = await db.from("team_fan_group_join_requests").update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("id", requestId).eq("team_id", teamId).eq("status", "pending").select("user_id").maybeSingle();
      if (error) throw error;
      if (!joinRequest) return NextResponse.json({ ok: false, message: "That request is no longer pending." }, { status: 404 });
      if (decision === "approved") {
        await db.from("team_fan_group_members").upsert({ team_id: teamId, user_id: joinRequest.user_id }, { onConflict: "team_id,user_id" });
        await notify(db, [joinRequest.user_id], teamId, "group_approved", "Your Fan Group request was approved", "You're now a member of " + group.group_name + ".");
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "remove_member") {
      const memberId = String(form.get("user_id") || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberId))
        return NextResponse.json({ ok: false, message: "Choose a valid member." }, { status: 400 });
      const { data: existingMember, error: memberLookupError } = await db.from("team_fan_group_members")
        .select("user_id").eq("team_id", teamId).eq("user_id", memberId).maybeSingle();
      if (memberLookupError) throw memberLookupError;
      if (!existingMember) return NextResponse.json({ ok: false, message: "This member is no longer in the group." }, { status: 404 });
      const { error: moderatorError } = await db.from("team_fan_group_moderators").delete()
        .eq("team_id", teamId).eq("user_id", memberId).eq("moderator_type", "fan_co_moderator");
      if (moderatorError) throw moderatorError;
      const { error } = await db.from("team_fan_group_members").delete().eq("team_id", teamId).eq("user_id", memberId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "appoint_co_moderator" || action === "remove_co_moderator") {
      const memberId = String(form.get("user_id") || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberId))
        return NextResponse.json({ ok: false, message: "Choose a valid member." }, { status: 400 });
      if (action === "appoint_co_moderator") {
        const { data: target } = await db.from("profiles").select("account_type").eq("id", memberId).maybeSingle();
        const { data: member } = await db.from("team_fan_group_members").select("user_id").eq("team_id", teamId).eq("user_id", memberId).maybeSingle();
        if (target?.account_type !== "fan" || !member) return NextResponse.json({ ok: false, message: "Only current fan members can become co-moderators." }, { status: 400 });
        const { error } = await db.from("team_fan_group_moderators").upsert({ team_id: teamId, user_id: memberId, moderator_type: "fan_co_moderator" }, { onConflict: "team_id,user_id" });
        if (error) throw error;
      } else {
        const { error } = await db.from("team_fan_group_moderators").delete().eq("team_id", teamId).eq("user_id", memberId).eq("moderator_type", "fan_co_moderator");
        if (error) throw error;
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "pin_post" || action === "remove_post") {
      const postId = String(form.get("post_id") || "");
      if (action === "pin_post") {
        // Validate the target before unpinning the currently featured post.
        const { data: target, error: lookupError } = await db.from("team_fan_group_posts")
          .select("id").eq("id", postId).eq("team_id", teamId).eq("status", "published").maybeSingle();
        if (lookupError) throw lookupError;
        if (!target) return NextResponse.json({ ok: false, message: "This group post is no longer available." }, { status: 404 });
        const { error: unpinError } = await db.from("team_fan_group_posts").update({ is_pinned: false }).eq("team_id", teamId);
        if (unpinError) throw unpinError;
        const { data: pinned, error } = await db.from("team_fan_group_posts").update({ is_pinned: true })
          .eq("id", postId).eq("team_id", teamId).eq("status", "published").select("id").maybeSingle();
        if (error) throw error;
        if (!pinned) return NextResponse.json({ ok: false, message: "This group post is no longer available." }, { status: 404 });
      } else {
        const { data: removedPost, error: lookupError } = await db.from("team_fan_group_posts")
          .select("id,image_url").eq("id", postId).eq("team_id", teamId).eq("status", "published").maybeSingle();
        if (lookupError) throw lookupError;
        if (!removedPost) return NextResponse.json({ ok: false, message: "This group post is no longer available." }, { status: 404 });
        const { data: removed, error } = await db.from("team_fan_group_posts")
          .update({ status: "removed", is_pinned: false }).eq("id", postId).eq("team_id", teamId)
          .eq("status", "published").select("id").maybeSingle();
        if (error) throw error;
        if (!removed) return NextResponse.json({ ok: false, message: "This group post is no longer available." }, { status: 404 });
        if (removedPost.image_url) {
          const { error: storageError } = await db.storage.from("fan-group-images").remove([removedPost.image_url]);
          if (storageError) console.error("Fan Group image cleanup failed", { postId, code: storageError.message });
        }
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, message: "Unsupported Fan Group action." }, { status: 400 });
  } catch (error) {
    if (db && uploadedPath) { try { await db.storage.from("fan-group-images").remove([uploadedPath]); } catch { /* best effort */ } }
    console.error("Team Fan Group action failed", error);
    return NextResponse.json({ ok: false, message: "The Fan Group action could not be completed." }, { status: 500 });
  }
}
