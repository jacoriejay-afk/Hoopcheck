import type { Metadata } from "next";
import { getProfileSeo, profileMetadata } from "../../../lib/seo-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return profileMetadata(await getProfileSeo("player", id), `/players/${encodeURIComponent(id)}`);
}
export default function PlayerSeoLayout({ children }: { children: React.ReactNode }) { return children; }
