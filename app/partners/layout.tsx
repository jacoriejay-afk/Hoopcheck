import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner With HoopCheck",
  description: "Explore athlete partnerships, sponsorships and other ways to collaborate with HoopCheck and the global basketball community.",
  alternates: { canonical: "/partners" },
};

export default function PartnersLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
