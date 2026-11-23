import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Professional Basketball Player Directory",
  description: "Discover professional basketball players worldwide, explore public career profiles and research the global game on HoopCheck.",
  alternates: { canonical: "/players" },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
