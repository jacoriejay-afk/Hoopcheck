"use client";

import { createContext, useContext, type ReactNode } from "react";

type PublicTeamIdentity = { name: string; location: string; leagueName?: string; leagueId?: string };
const Context = createContext<PublicTeamIdentity | null>(null);

export function PublicTeamProvider({ identity, children }: { identity: PublicTeamIdentity | null; children: ReactNode }) {
  return <Context.Provider value={identity}>{children}</Context.Provider>;
}

export function usePublicTeamIdentity() {
  return useContext(Context);
}
