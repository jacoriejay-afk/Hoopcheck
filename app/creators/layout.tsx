import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Basketball Creators & Media",
  description: "Explore basketball creators, media personalities and training voices in the HoopCheck basketball community.",
  alternates: { canonical: "/creators" },
};

export default function CreatorsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
