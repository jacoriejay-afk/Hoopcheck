import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Basketball Team, Coach & League Reviews",
  description: "Discover the HoopCheck reviews directory. Research professional basketball organizations and learn about firsthand player experiences; access depends on membership.",
  alternates: { canonical: "/reviews" },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
