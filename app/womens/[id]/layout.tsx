import type { Metadata } from "next";
import { PublicTeamProvider } from "../../teams/[id]/PublicTeamContext";
import { getProfileSeo, profileMetadata } from "../../../lib/seo-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return profileMetadata(await getProfileSeo("womens_team", id), `/womens/${encodeURIComponent(id)}`);
}
export default async function WomensTeamSeoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfileSeo("womens_team", id);
  return <PublicTeamProvider identity={profile ? { name: profile.name, location: profile.location, leagueName: profile.leagueName, leagueId: profile.leagueId } : null}>{children}</PublicTeamProvider>;
}
