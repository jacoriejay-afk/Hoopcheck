import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Women's Professional Basketball Teams",
  description: "Explore women's basketball clubs and leagues worldwide. Discover international teams and research opportunities on HoopCheck.",
  alternates: { canonical: "/womens" },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
