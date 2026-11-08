export type ProfileCompletionSource = {
  account_type?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  hometown?: string | null;
  nationality?: string | null;
  interests?: string | null;
  favorite_leagues?: string | null;
};

/** One shared contract for Home, Account, Edit Profile, and public profile.
 * Only user-editable fields that persist through the Account editor or avatar upload count.
 * Weights: display name 25, bio 25, profile photo 20, hometown 10,
 * nationality 10, basketball interests 5, favorite leagues 5 = exactly 100.
 */
export const PROFILE_COMPLETION_FIELDS = [
  { key: "display_name", label: "display name", weight: 25 },
  { key: "bio", label: "bio", weight: 25 },
  { key: "avatar_url", label: "profile photo", weight: 20 },
  { key: "hometown", label: "hometown", weight: 10 },
  { key: "nationality", label: "nationality", weight: 10 },
  { key: "interests", label: "basketball interests", weight: 5 },
  { key: "favorite_leagues", label: "favorite leagues", weight: 5 },
] as const;

const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim().length > 0;

export function calculateProfileCompletion(profile: ProfileCompletionSource | null | undefined) {
  // Only include fields the account editor actually exposes for this role.
  // A fan should never be asked to upload a player-only avatar; players
  // should never be asked for scout-only league interests.
  const role = profile?.account_type || "player";
  const applicable = PROFILE_COMPLETION_FIELDS.filter(field => {
    if (field.key === "avatar_url") return role === "player";
    if (field.key === "interests") return ["fan", "coach", "scout", "agent"].includes(role);
    if (field.key === "favorite_leagues") return ["scout", "agent"].includes(role);
    return true;
  });
  const fields = applicable.map(field => ({ ...field, complete: hasValue(profile?.[field.key]) }));
  const totalWeight = fields.reduce((sum, field) => sum + field.weight, 0);
  const percentage = totalWeight ? Math.round(100 * fields.reduce((sum, field) => sum + (field.complete ? field.weight : 0), 0) / totalWeight) : 100;
  const nextMissing = fields.find(field => !field.complete) ?? null;
  return { percentage, fields, nextMissing };
}
