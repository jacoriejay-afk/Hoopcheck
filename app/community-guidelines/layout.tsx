import type { Metadata } from "next";

export const metadata: Metadata = { title: "Community Guidelines", description: "Read HoopCheck's community standards for genuine basketball experiences and professional discussion.", alternates: { canonical: "/community-guidelines" } };

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
