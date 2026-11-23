import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Basketball Teams, Players & Leagues",
  description: "Browse HoopCheck's global basketball directory for professional teams, coaches, players, leagues and firsthand basketball experiences.",
  alternates: { canonical: "/directory" },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
