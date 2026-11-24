import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GET as bootstrap } from "../../mobile/bootstrap/route";
import { curatedReelCatalog } from "../../../../lib/hoopreels-video-source";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** A curated, read-only catalog linked to existing approved feed_posts.
 * No caller-supplied asset IDs or URLs, no service-role signing, no raw storage
 * paths. Same authoritative entitlement resolver as native bootstrap.
 */
export async function GET(request: Request) {
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") || "")?.[1];
  if (!token || token.length > 16384) return reply({ error: "Authentication required." }, 401);
  try {
    const access = await bootstrap(request);
    if (!access.ok) return reply({ error: "Account access could not be verified." }, access.status);
    const account = await access.json();
    if (account?.entitlements?.canReadHoopFeed !== true || typeof account?.user?.id !== "string") return reply({ error: "Membership required." }, 403);
    const catalog = curatedReelCatalog(process.env.HOOPREELS_STREAMING_PROVIDER, process.env.HOOPREELS_ADMIN_HLS_CATALOG);
    if (!catalog.configured || !catalog.assets.length) return reply({ configured: catalog.configured, posts: [] });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return reply({ error: "Reels unavailable." }, 503);
    const scoped = createClient(url, key, { global: { headers: { Authorization: "Bearer " + token } }, auth: { autoRefreshToken: false, persistSession: false } });
    const ids = catalog.assets.map(asset => asset.postId);
    const [posts, blocks, archives] = await Promise.all([
      scoped.from("feed_posts").select("id,author_id,body,created_at,expires_at,post_kind,club_id,womens_club_id,league_id,womens_league_id,profiles:profiles!feed_posts_author_id_fkey(display_name,username,account_type,avatar_url,avatar_moderation_status)")
        .eq("status", "approved").is("shared_post_id", null).in("id", ids).or("expires_at.is.null,expires_at.gt." + new Date().toISOString()),
      scoped.from("user_blocks").select("blocked_id").eq("blocker_id", account.user.id),
      scoped.from("feed_post_archives").select("post_id").eq("user_id", account.user.id).in("post_id", ids),
    ]);
    if (posts.error || blocks.error || archives.error) return reply({ error: "Reel access could not be verified." }, 503);
    const blocked = new Set((blocks.data || []).map(row => row.blocked_id));
    const archived = new Set((archives.data || []).map(row => row.post_id));
    const sources = new Map(catalog.assets.map(source => [source.postId, source]));
    const allowed = (posts.data || []).filter(post => sources.has(post.id) && !blocked.has(post.author_id) && !archived.has(post.id));
    const teamIds = [...new Set(allowed.map(post => post.club_id).filter(Boolean))];
    const womenIds = [...new Set(allowed.map(post => post.womens_club_id).filter(Boolean))];
    const [teams, women] = await Promise.all([
      teamIds.length ? scoped.from("teams").select("id,name").in("id", teamIds) : Promise.resolve({ data: [], error: null }),
      womenIds.length ? scoped.from("womens_teams").select("id,name").in("id", womenIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const teamNames = new Map((teams.error ? [] : teams.data || []).map(row => [row.id, row.name]));
    const womenNames = new Map((women.error ? [] : women.data || []).map(row => [row.id, row.name]));
    const result = allowed.map(post => {
      const teamId = post.club_id || post.womens_club_id;
      const name = post.club_id ? teamNames.get(post.club_id) : womenNames.get(post.womens_club_id);
      return {
        ...post, image_url: null, image_urls: null, video_url: null, poll_options: null,
        profiles: Array.isArray(post.profiles) ? post.profiles[0] || null : post.profiles,
        reel_source: sources.get(post.id),
        reel_team: teamId && typeof name === "string" && name.trim() ? { id: teamId, name, women: !post.club_id } : null,
      };
    });
    return reply({ configured: true, posts: result });
  } catch { return reply({ error: "Reel access could not be verified." }, 503); }
}
