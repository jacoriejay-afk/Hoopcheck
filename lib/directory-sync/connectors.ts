import type { DirectoryProviderConnector } from "./types";
import { mockDirectoryConnector } from "./mock-connector";

const connectors: Record<string, DirectoryProviderConnector> = {
  mock: mockDirectoryConnector,
};

export function getDirectoryConnector(key: string | null | undefined) {
  if (!key) return null;
  return connectors[key] ?? null;
}

export function listConnectorKeys() {
  return Object.keys(connectors);
}
