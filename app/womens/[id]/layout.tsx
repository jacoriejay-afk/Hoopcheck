import type { Metadata } from "next";
import { getProfileSeo, profileMetadata } from "../../../lib/seo-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return profileMetadata(await getProfileSeo("womens_team", id), `/womens/${encodeURIComponent(id)}`);
}
export default function WomensTeamSeoLayout({ children }: { children: React.ReactNode }) { return children; }
