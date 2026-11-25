import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Basketball Team, Coach & League Reviews",
  description: "Research basketball teams, coaches and leagues with firsthand player experiences on HoopCheck. Review access depends on membership.",
  alternates: { canonical: "/reviews" },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
