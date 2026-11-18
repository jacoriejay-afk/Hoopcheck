import type { SupabaseClient } from "@supabase/supabase-js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pageSize = 24;
export type ClubGroup = { team_id: string; group_name: string };
export type GroupPost = { id: string; team_id: string; author_id: string; body: string; image_url: string | null; is_pinned: boolean; created_at: string; profiles: { display_name: string | null } | null };
export type GroupComment = { id: string; post_id: string; author_id: string; body: string; created_at: string; profiles: { display_name: string | null } | null };
function validId(value: string) { if (!uuid.test(value)) throw new Error("Invalid group request"); }
function deadline() { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000); return { signal: controller.signal, clear: () => clearTimeout(timer) }; }
export async function readClubGroups(client: SupabaseClient, search: string, page = 0) {
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new Error("Invalid group page");
  const timer = deadline();
  try {
    const term = search.slice(0, 120).replace(/[%_*\\(),.]/g, " ").trim();
    let query = client.from("team_fan_groups").select("team_id,group_name").order("group_name").order("team_id").range(page * pageSize, page * pageSize + pageSize);
    if (term) query = query.ilike("group_name", `%${term}%`);
    const result = await query.abortSignal(timer.signal);
    if (result.error) throw new Error("Club groups could not load.");
    const rows = (result.data ?? []) as ClubGroup[];
    if (rows.some(row => !uuid.test(row.team_id) || typeof row.group_name !== "string")) throw new Error("Invalid group directory");
    return { groups: rows.slice(0, pageSize), more: rows.length > pageSize };
  } finally { timer.clear(); }
}
export async function readClubGroupAccess(client: SupabaseClient, teamId: string, userId: string) {
  validId(teamId); validId(userId);
  const timer = deadline();
  try {
    const [summary, member, moderator, team] = await Promise.all([
      client.rpc("get_team_fan_group_summary", { p_team_id: teamId }).abortSignal(timer.signal),
      client.from("team_fan_group_members").select("user_id").eq("team_id", teamId).eq("user_id", userId).abortSignal(timer.signal).maybeSingle(),
      client.rpc("is_team_fan_group_moderator", { p_team_id: teamId }).abortSignal(timer.signal),
      client.from("teams").select("name,basketball_type").eq("id", teamId).abortSignal(timer.signal).maybeSingle(),
    ]);
    if (summary.error || member.error || moderator.error || typeof moderator.data !== "boolean") throw new Error("Group access could not be verified.");
    const row = Array.isArray(summary.data) ? summary.data[0] : summary.data;
    if (!row || typeof row.group_name !== "string") throw new Error("This club group is unavailable.");
    const count = Number(row.member_count);
    return {
      name: row.group_name as string,
      memberCount: Number.isSafeInteger(count) && count >= 0 ? count : null,
      member: member.data?.user_id === userId, // Summary membership is not an authorization grant.
      moderator: moderator.data === true,
      teamName: !team.error && typeof team.data?.name === "string" ? team.data.name : "Club",
      teamPath: (team.data?.basketball_type === "womens" ? "/womens/" : "/teams/") + teamId,
    };
  } finally { timer.clear(); }
}
export async function readClubGroupPosts(client: SupabaseClient, teamId: string, page = 0) {
  validId(teamId);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new Error("Invalid group page");
  const timer = deadline();
  try {
    const result = await client.from("team_fan_group_posts").select("id,team_id,author_id,body,image_url,is_pinned,created_at,profiles:profiles!team_fan_group_posts_author_id_fkey(display_name)")
      .eq("team_id", teamId).eq("status", "published").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * pageSize, page * pageSize + pageSize).abortSignal(timer.signal);
    if (result.error) throw new Error("Group posts could not load.");
    const rows = (result.data ?? []) as unknown as GroupPost[];
    if (rows.some(row => !uuid.test(row.id) || row.team_id !== teamId)) throw new Error("Invalid group posts");
    return { posts: rows.slice(0, pageSize).map(row => ({ ...row, profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles })), more: rows.length > pageSize };
  } finally { timer.clear(); }
}
export async function readGroupComments(client: SupabaseClient, postId: string, page = 0) {
  validId(postId);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new Error("Invalid comment page");
  const timer = deadline();
  try {
    const result = await client.from("team_fan_group_comments").select("id,post_id,author_id,body,created_at,profiles:profiles!team_fan_group_comments_author_id_fkey(display_name)")
      .eq("post_id", postId).order("created_at").order("id").range(page * 50, page * 50 + 50).abortSignal(timer.signal);
    if (result.error) throw new Error("Group comments could not load.");
    const rows = (result.data ?? []) as unknown as GroupComment[];
    if (rows.some(row => !uuid.test(row.id) || row.post_id !== postId || typeof row.body !== "string")) throw new Error("Invalid group comments");
    return { comments: rows.slice(0, 50).map(row => ({ ...row, profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles })), more: rows.length > 50 };
  } finally { timer.clear(); }
}
export type GroupAction = "join" | "leave" | "create_post" | "comment" | "report_post" | "pin_post" | "remove_post";
export async function clubGroupAction(origin: string, token: string, teamId: string, action: GroupAction, values: { text?: string; postId?: string } = {}, request: typeof fetch = fetch) {
  validId(teamId);
  if (!["join", "leave", "create_post", "comment", "report_post", "pin_post", "remove_post"].includes(action)) throw new Error("Invalid group action");
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !token) throw new Error("Invalid group API request");
  url.pathname = "/api/fan-groups";
  const form = new FormData(); form.append("action", action); form.append("team_id", teamId);
  if (["comment", "report_post", "pin_post", "remove_post"].includes(action)) { validId(values.postId || ""); form.append("post_id", values.postId!); }
  if (["create_post", "comment", "report_post"].includes(action)) {
    const text = (values.text || "").trim();
    if (!text || text.length > (action === "create_post" ? 2000 : action === "comment" ? 1000 : 500) || (action === "report_post" && text.length < 3)) throw new Error("Check your text before submitting.");
    form.append(action === "report_post" ? "reason" : "body", text);
  }
  const timer = deadline();
  try {
    const response = await request(url.toString(), { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store", redirect: "error", signal: timer.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) throw new Error(typeof result?.message === "string" ? result.message.slice(0, 300) : "The group action could not be confirmed. Your draft is retained.");
  } finally { timer.clear(); }
}
export async function signedGroupImage(client: SupabaseClient, projectOrigin: string, teamId: string, reference: string) {
  validId(teamId);
  const project = new URL(projectOrigin);
  const parts = reference.split("/");
  if (project.protocol !== "https:" || project.username || project.password || project.pathname !== "/" || project.search || project.hash || parts.length !== 3 || parts[0] !== teamId || !uuid.test(parts[1]) || !/^[a-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(parts[2])) throw new Error("Invalid group image reference");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      client.storage.from("fan-group-images").createSignedUrl(reference, 600),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Image access timed out.")), 15000); }),
    ]);
    if (result.error || !result.data?.signedUrl) throw new Error("Group image unavailable.");
    const url = new URL(result.data.signedUrl);
    if (url.origin !== project.origin || url.pathname !== `/storage/v1/object/sign/fan-group-images/${reference}` || url.username || url.password) throw new Error("Invalid group image URL");
    return url.toString();
  } finally { clearTimeout(timer); }
}
