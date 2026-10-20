import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Membership Plans",
  description: "View HoopCheck membership options for researching overseas professional basketball teams, coaches, and leagues.",
  alternates: { canonical: "/membership" },
  openGraph: {
    title: "HoopCheck Membership Plans",
    description: "Explore membership options for overseas basketball research.",
  },
};

export default function MembershipLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
