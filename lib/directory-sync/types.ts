export type SyncEntityType = "leagues" | "teams" | "coaches";

export type NormalizedLeague = {
  externalId?: string | null; name: string; country?: string | null; level?: string | null; season?: string | null;
};
export type NormalizedTeam = {
  externalId?: string | null; name: string; country?: string | null; city?: string | null;
  leagueExternalId?: string | null; leagueName?: string | null; season?: string | null;
};
export type NormalizedCoach = {
  externalId?: string | null; name: string; country?: string | null; city?: string | null;
  role?: string | null; teamExternalId?: string | null; teamName?: string | null; season?: string | null;
};
export type NormalizedDirectory = {
  leagues: NormalizedLeague[]; teams: NormalizedTeam[]; coaches: NormalizedCoach[];
};

export interface DirectoryProviderConnector {
  key: string;
  getDirectory(input: { entityType: SyncEntityType; sourceId: string }): Promise<NormalizedDirectory>;
}
