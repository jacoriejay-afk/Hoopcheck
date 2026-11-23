import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Basketball Agents & Scouts",
  description: "Discover basketball agents and scouts and research recruiting connections through HoopCheck's global basketball network.",
  alternates: { canonical: "/agents" },
};

export default function AgentsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
