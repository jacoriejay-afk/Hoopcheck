import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "International Basketball Leagues",
  description: "Explore professional basketball leagues around the world with HoopCheck. Research league options and gather context before signing overseas.",
  openGraph: {
    title: "International Basketball Leagues | HoopCheck",
    description: "Explore professional basketball leagues around the world.",
  },
};

export default function LeaguesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
