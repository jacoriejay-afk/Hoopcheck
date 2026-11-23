import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live & Upcoming Basketball Games",
  description: "Follow live and upcoming basketball games, teams and leagues worldwide in the HoopCheck Live Games hub.",
  alternates: { canonical: "/live-games" },
};

export default function LiveGamesLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
