export type PlayerProfileCompletionRecord = {
  account_type?: string | null;
  id?: string | null;
  avatar_url?: string | null;
  position?: string | null;
  current_team?: string | null;
  current_country?: string | null;
  favorite_leagues?: string | null;
  height?: string | null;
  bio?: string | null;
  hometown?: string | null;
  profile_visibility?: string | null;
};

export const PLAYER_PROFILE_COMPLETION_FIELDS = [
  { key: "photo", label: "Profile photo" },
  { key: "position", label: "Playing position" },
  { key: "current_team", label: "Current team" },
  { key: "league_country", label: "League / country" },
  { key: "height", label: "Height" },
  { key: "bio", label: "Player bio" },
  { key: "location", label: "Location" },
] as const;

const hasValue = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

export function getPlayerProfileCompletion(profile: PlayerProfileCompletionRecord | null | undefined) {
  if (!profile || profile.account_type !== "player") {
    return { completed: 0, total: PLAYER_PROFILE_COMPLETION_FIELDS.length, percentage: 0, missing: PLAYER_PROFILE_COMPLETION_FIELDS.map((field) => field.key) };
  }

  const checks: Record<(typeof PLAYER_PROFILE_COMPLETION_FIELDS)[number]["key"], boolean> = {
    photo: hasValue(profile.avatar_url),
    position: hasValue(profile.position),
    current_team: hasValue(profile.current_team),
    league_country: hasValue(profile.current_country) || hasValue(profile.favorite_leagues),
    height: hasValue(profile.height),
    bio: hasValue(profile.bio),
    location: hasValue(profile.hometown),
  };
  const completed = Object.values(checks).filter(Boolean).length;
  return {
    completed,
    total: PLAYER_PROFILE_COMPLETION_FIELDS.length,
    percentage: Math.round((completed / PLAYER_PROFILE_COMPLETION_FIELDS.length) * 100),
    missing: PLAYER_PROFILE_COMPLETION_FIELDS.filter((field) => !checks[field.key]).map((field) => field.key),
  };
}
