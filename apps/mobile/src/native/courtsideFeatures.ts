/** Source-only roster/career candidates are absent from the audited hosted catalog. Explicit fixture/approved-rollout opt-in is not an authorization grant. */
const rosterCandidate = process.env.EXPO_PUBLIC_ROSTER_RESEARCH_CANDIDATE === "1";
export const courtsideFeatures = {
  playerBoxScores: false,
  playerAchievements: false,
  playerHighlightCollection: false,
  groupMemberDirectory: false,
  teamRoster: false, // Current-club identity projection is still unavailable.
  teamRosterHistory: rosterCandidate,
  rosterOpportunities: rosterCandidate,
  careerStatistics: rosterCandidate,
  professionalVerification: true,
} as const;
