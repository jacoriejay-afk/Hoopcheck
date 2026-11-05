export type ProfileCompletionSource = {
  account_type?: string | null;
  display_name?: string | null;
  bio?: string | null;
  position?: string | null;
  years_pro?: number | null;
  current_country?: string | null;
  current_team?: string | null;
  avatar_url?: string | null;
  hometown?: string | null;
  nationality?: string | null;
  interests?: string | null;
  favorite_leagues?: string | null;
  experience_summary?: string | null;
};

/**
 * Single completion contract for Home, Account, Edit Profile, and public profile.
 * Counted fields are editable and saved by Account's profile editor.
 * Weights: display name 15, bio 15, position 15, years pro 10,
 * current country 10, current team 10, avatar 10, hometown 5,
 * nationality 5, interests 3, favorite leagues 2 = exactly 100.
 */
export const PROFILE_COMPLETION_FIELDS = [
  { key: "display_name", label: "display name", weight: 15 },
  { key: "bio", label: "bio", weight: 15 },
  { key: "position", label: "position", weight: 15 },
  { key: "years_pro", label: "years as a professional", weight: 10 },
  { key: "current_country", label: "current country", weight: 10 },
  { key: "current_team", label: "current team", weight: 10 },
  { key: "avatar_url", label: "profile photo", weight: 10 },
  { key: "hometown", label: "hometown", weight: 5 },
  { key: "nationality", label: "nationality", weight: 5 },
  { key: "interests", label: "basketball interests", weight: 3 },
  { key: "favorite_leagues", label: "favorite leagues", weight: 2 },
] as const;

const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim().length > 0;

export function calculateProfileCompletion(profile: ProfileCompletionSource | null | undefined) {
  const fields = PROFILE_COMPLETION_FIELDS.map(field => ({
    ...field,
    complete: hasValue(profile?.[field.key]),
  }));
  const percentage = Math.round(fields.reduce((sum, field) => sum + (field.complete ? field.weight : 0), 0));
  const nextMissing = fields.find(field => !field.complete) ?? null;
  return { percentage, fields, nextMissing };
}
