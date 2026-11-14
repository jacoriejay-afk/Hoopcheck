import { supabase } from "./supabase";

export const ENTITY_TAGS = {
  club_id: { table: "teams", href: "/teams" },
  womens_club_id: { table: "womens_teams", href: "/womens" },
  league_id: { table: "leagues", href: "/leagues" },
  womens_league_id: { table: "womens_leagues", href: "/womens/leagues" },
} as const;

export type TagColumn = keyof typeof ENTITY_TAGS;
export type Entity = { id: string; name: string; country?: string | null };
export type EntityTag = Entity & { column: TagColumn };
export type TaggedPost = Partial<Record<TagColumn, string | null>>;
export type Segment = "All" | "Following" | "My World";
export type FeedSort = "Top" | "Latest";
export const SEGMENTS: Segment[] = ["All", "Following", "My World"];

export function entityHref(tag: EntityTag) {
  return `${ENTITY_TAGS[tag.column].href}/${tag.id}`;
}

export function compareFeedPosts(
  a: { id: string; created_at: string },
  b: { id: string; created_at: string },
  sort: FeedSort,
  checks: Record<string, number>,
  now: number,
) {
  const recent = now - 48 * 60 * 60 * 1000;
  const aTime = Date.parse(a.created_at);
  const bTime = Date.parse(b.created_at);
  if (sort === "Top") {
    const aRecent = aTime >= recent;
    const bRecent = bTime >= recent;
    if (aRecent !== bRecent) return aRecent ? -1 : 1;
    if (aRecent) {
      const difference = (checks[b.id] ?? 0) - (checks[a.id] ?? 0);
      if (difference) return difference;
    }
  }
  return bTime - aTime || b.id.localeCompare(a.id);
}

export async function loadFeedWorld(userId: string, profile: {
  selected_team_id?: string | null;
  selected_womens_team_id?: string | null;
  basketball_type?: string | null;
}) {
  const clubColumn: "club_id" | "womens_club_id" = profile.basketball_type === "womens" && profile.selected_womens_team_id
    ? "womens_club_id" : profile.selected_team_id ? "club_id" : "womens_club_id";
  const leagueColumn: "league_id" | "womens_league_id" = clubColumn === "club_id" ? "league_id" : "womens_league_id";
  const clubId = clubColumn === "club_id" ? profile.selected_team_id : profile.selected_womens_team_id;
  const profileColumn = clubColumn === "club_id" ? "selected_team_id" : "selected_womens_team_id";
  const [clubResult, groupsResult, leagueFollows] = await Promise.all([
    clubId ? supabase.from(ENTITY_TAGS[clubColumn].table).select("id,name,league_id").eq("id", clubId).maybeSingle() : null,
    supabase.from("team_fan_group_members").select("team_id").eq("user_id", userId),
    supabase.from("follow_relationships").select("target_id").eq("follower_id", userId).eq("target_type", "league"),
  ]);
  const club = clubResult?.data ? { ...clubResult.data, column: clubColumn } : null;
  const leagueId = club?.league_id;
  const groups = (groupsResult.data ?? []).map(row => row.team_id as string);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const leagueIds = [...new Set([leagueId, ...(leagueFollows.data ?? []).map(row => row.target_id)].filter(Boolean))] as string[];
  const worldClubIds = [...new Set([club?.id, ...groups].filter(Boolean))] as string[];
  const [leagueResult, members, rosterClubs, fixtures, reviews, womensReviews] = await Promise.all([
    leagueId ? supabase.from(ENTITY_TAGS[leagueColumn].table).select("id,name").eq("id", leagueId).maybeSingle() : null,
    club ? supabase.from("profiles").select("id").eq("account_type", "player").eq("selected_team_verified", true).eq(profileColumn, club.id) : null,
    leagueId ? supabase.from(ENTITY_TAGS[clubColumn].table).select("id").eq("league_id", leagueId).eq("active", true) : null,
    leagueIds.length ? supabase.from("fan_live_games").select("id,team_id,opponent_name,status,scheduled_at,started_at,ends_at,league_name")
      .in("league_id", leagueIds).gte("scheduled_at", start.toISOString()).lt("scheduled_at", end.toISOString())
      .not("status", "in", "(cancelled,canceled,postponed,abandoned)").order("scheduled_at").limit(3) : null,
    worldClubIds.length ? supabase.from("reviews").select("team_id,created_at,teams(name)").eq("status", "approved").in("team_id", worldClubIds)
      .order("created_at", { ascending: false }).limit(1).maybeSingle() : null,
    worldClubIds.length ? supabase.from("womens_team_reviews").select("womens_team_id,created_at,womens_teams(name)").eq("status", "approved")
      .in("womens_team_id", worldClubIds).order("created_at", { ascending: false }).limit(1).maybeSingle() : null,
  ]);
  const rosterIds = [...new Set([club?.id, ...(rosterClubs?.data ?? []).map(row => row.id)].filter(Boolean))] as string[];
  const { data: suggestions } = rosterIds.length ? await supabase.from("profiles").select("id,display_name")
    .eq("account_type", "player").eq("profile_visibility", "public").eq("player_verified", true)
    .eq("selected_team_verified", true).neq("id", userId).in(profileColumn, rosterIds)
    .not("display_name", "is", null).order("display_name").limit(10) : { data: [] };
  const fixtureRows = fixtures?.data ?? [];
  const fixtureTeamIds = [...new Set(fixtureRows.map(row => row.team_id))];
  const { data: homeTeams } = fixtureTeamIds.length
    ? await supabase.from("teams").select("id,name").in("id", fixtureTeamIds) : { data: [] };
  const review = reviews?.data;
  const reviewTeam = Array.isArray(review?.teams) ? review.teams[0] : review?.teams;
  const womensReview = womensReviews?.data;
  const womensReviewTeam = Array.isArray(womensReview?.womens_teams) ? womensReview.womens_teams[0] : womensReview?.womens_teams;
  const newestReview = womensReviewTeam && womensReview && (!review || womensReview.created_at > review.created_at)
    ? { href: `/womens/${womensReview.womens_team_id}#reviews`, name: womensReviewTeam.name as string }
    : reviewTeam?.name && review?.team_id ? { href: `/teams/${review.team_id}#reviews`, name: reviewTeam.name as string } : null;
  return {
    club,
    league: leagueResult?.data ? { ...leagueResult.data, column: leagueColumn } : null,
    groups,
    members: (members?.data ?? []).map(row => row.id as string),
    suggestions: suggestions ?? [],
    fixtures: fixtureRows.flatMap(row => {
      const home = homeTeams?.find(team => team.id === row.team_id);
      return home && row.opponent_name ? [{ ...row, home: home.name as string }] : [];
    }),
    review: newestReview,
  };
}

export type FeedWorld = Awaited<ReturnType<typeof loadFeedWorld>>;
