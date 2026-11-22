/**
 * A local-only, user-scoped shortcut allowlist for native My Court.
 * This is navigation presentation, never an entitlement or authorization grant.
 */
export const COURT_ACTIONS = [
  { id: "teams", label: "Check teams", href: "/teams", icon: "shield-checkmark-outline", tone: "orange" },
  { id: "live", label: "Live games", href: "/fan-live", icon: "radio-outline", tone: "blue" },
  { id: "clubgroups", label: "Fan groups", href: "/team-hub/groups", icon: "people-outline", tone: "green" },
  { id: "chat", label: "HoopChat", href: "/messages", icon: "chatbubbles-outline", tone: "violet" },
  { id: "feed", label: "HoopFeed", href: "/feed", icon: "flame-outline", tone: "orange" },
  { id: "players", label: "Find players", href: "/players", icon: "person-outline", tone: "blue" },
  { id: "leagues", label: "Leagues", href: "/leagues", icon: "trophy-outline", tone: "green" },
  { id: "hoopgroups", label: "HoopGroups", href: "/hoopgroups", icon: "chatbubbles-outline", tone: "violet" },
] as const;

export type CourtActionId = (typeof COURT_ACTIONS)[number]["id"];
export type CourtFeatures = { feed: boolean; hoopgroups: boolean };

const roleDefaults: Record<string, readonly CourtActionId[]> = {
  player: ["teams", "live", "chat", "feed"],
  fan: ["live", "clubgroups", "teams", "chat"],
  coach: ["players", "teams", "chat", "leagues"],
  agent: ["players", "leagues", "chat", "teams"],
  scout: ["players", "leagues", "chat", "teams"],
  manager: ["teams", "clubgroups", "chat", "live"],
  club_admin: ["teams", "clubgroups", "chat", "live"],
};

export function courtChoices(_role: string, features: CourtFeatures) {
  return COURT_ACTIONS.filter(action =>
    (action.id !== "feed" || features.feed) &&
    (action.id !== "hoopgroups" || features.hoopgroups)
  );
}

export function defaultCourtActions(role: string, features: CourtFeatures): CourtActionId[] {
  const allowed = new Set(courtChoices(role, features).map(action => action.id));
  const preferred = roleDefaults[role] ?? ["teams", "live", "chat", "leagues"];
  const ordered = [...preferred, ...COURT_ACTIONS.map(action => action.id)];
  return [...new Set(ordered)].filter(id => allowed.has(id)).slice(0, 4);
}

/** Never trust local preferences to introduce routes or feature-flagged entries. */
export function normalizeCourtActions(saved: unknown, role: string, features: CourtFeatures): CourtActionId[] {
  if (!Array.isArray(saved)) return defaultCourtActions(role, features);
  const allowed = new Set(courtChoices(role, features).map(action => action.id));
  const selected = [...new Set(saved.filter((id): id is CourtActionId =>
    typeof id === "string" && allowed.has(id as CourtActionId)
  ))].slice(0, 4);
  return selected.length ? selected : defaultCourtActions(role, features);
}

/** A user always retains at least one shortcut and at most four. */
export function toggleCourtAction(current: readonly CourtActionId[], id: CourtActionId, role: string, features: CourtFeatures): CourtActionId[] {
  const safe = normalizeCourtActions([...current], role, features);
  if (!courtChoices(role, features).some(action => action.id === id)) return safe;
  if (safe.includes(id)) return safe.length === 1 ? safe : safe.filter(value => value !== id);
  return safe.length >= 4 ? safe : [...safe, id];
}
