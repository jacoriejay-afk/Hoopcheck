/** Deliberately disabled until a reviewed, consent-aware backend projection exists. */
export const courtsideFeatures = {
  playerBoxScores: false,
  playerAchievements: false,
  playerHighlightCollection: false,
  groupMemberDirectory: false,
  teamRoster: false, // Current-club identity projection is still unavailable.
  teamRosterHistory: true,
  rosterOpportunities: true,
  careerStatistics: true,
  professionalVerification: true,
} as const;
