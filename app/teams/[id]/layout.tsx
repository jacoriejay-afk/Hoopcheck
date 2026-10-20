import type { Metadata } from "next";
import { getProfileSeo, profileMetadata } from "../../../lib/seo-metadata";

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return profileMetadata(await getProfileSeo("team", id), `/teams/${encodeURIComponent(id)}`);
}
export default async function TeamSeoLayout({ children, params }: Props) {
  const { id } = await params;
  const profile = await getProfileSeo("team", id);
  return <>{profile?.jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profile.jsonLd).replace(/</g, "\\u003c") }} />}{children}</>;
}
