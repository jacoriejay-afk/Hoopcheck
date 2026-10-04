import type { DirectoryProviderConnector } from "./types";

export const mockDirectoryConnector: DirectoryProviderConnector = {
  key: "mock",
  async getDirectory() {
    // Intentionally empty: never seed fake basketball data into production.
    return { leagues: [], teams: [], coaches: [] };
  },
};
